'use client'

import { useState, useRef, useEffect, useCallback, type ComponentProps } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '~/utils/supabase/client'
import { Activity, Loader2, Mail, Lock, ShieldCheck, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'

// ──────────────────────────────────────────────────────────────
// Types & Constants
// ──────────────────────────────────────────────────────────────

/**
 * The five possible screens the auth page can show:
 *  - login    : email + password sign-in
 *  - signup   : email + password sign-up
 *  - otp      : 6-digit OTP verification after sign-up
 *  - forgot   : enter email to receive a password-reset link
 *  - reset    : enter a new password (after clicking the reset email link)
 */
type AuthMode = 'login' | 'signup' | 'otp' | 'forgot' | 'reset'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MIN_PASSWORD_LENGTH = 8

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'> & {
  fieldLabel: string
}

function PasswordInput({ fieldLabel, className, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)
  const action = isVisible ? 'Hide' : 'Show'

  return (
    <div className="relative">
      <Input
        {...props}
        type={isVisible ? 'text' : 'password'}
        className={`${className ?? ''} pr-16`}
      />
      <button
        type="button"
        aria-label={`${action} ${fieldLabel.toLowerCase()}`}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((visible) => !visible)}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:scale-[0.98]"
      >
        {action}
      </button>
    </div>
  )
}

function getAuthExceptionMessage(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message.toLowerCase().includes('fetch') ||
      error.name === 'AuthRetryableFetchError'
    ) {
      return 'Could not reach the authentication service. Check your Supabase URL/key and network connection.'
    }

    return error.message
  }

  return 'Unexpected authentication error. Please try again.'
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  // ── State ──────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [otpEmail, setOtpEmail] = useState('') // email used when signup was initiated

  // Validation & feedback
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [newPasswordError, setNewPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Resend cooldown (seconds)
  const [resendCooldown, setResendCooldown] = useState(0)

  // OTP input refs for auto-focus
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // ── Listen for PASSWORD_RECOVERY event ─────────────────────
  // When the user clicks the password-reset link in their email,
  // Supabase redirects them back to the app and fires PASSWORD_RECOVERY.
  // We switch to the "reset" screen so they can set a new password.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset')
        setGeneralError('')
        setSuccessMessage('')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Cooldown timer ─────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCooldown])

  // ── Validators ─────────────────────────────────────────────

  const validateEmail = useCallback((value: string): boolean => {
    if (!value) {
      setEmailError('Email is required')
      return false
    }
    if (!EMAIL_REGEX.test(value)) {
      setEmailError('Please enter a valid email address (e.g. user@example.com)')
      return false
    }
    setEmailError('')
    return true
  }, [])

  const validatePassword = useCallback((value: string): boolean => {
    if (!value) {
      setPasswordError('Password is required')
      return false
    }
    if (value.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return false
    }
    setPasswordError('')
    return true
  }, [])

  const validateNewPassword = useCallback((value: string): boolean => {
    if (!value) {
      setNewPasswordError('New password is required')
      return false
    }
    if (value.length < MIN_PASSWORD_LENGTH) {
      setNewPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return false
    }
    setNewPasswordError('')
    return true
  }, [])

  const validateConfirmPassword = useCallback((pw: string, confirm: string): boolean => {
    if (!confirm) {
      setConfirmPasswordError('Please confirm your password')
      return false
    }
    if (pw !== confirm) {
      setConfirmPasswordError('Passwords do not match')
      return false
    }
    setConfirmPasswordError('')
    return true
  }, [])

  // ── Helper to clear all validation state ───────────────────
  const clearErrors = () => {
    setEmailError('')
    setPasswordError('')
    setNewPasswordError('')
    setConfirmPasswordError('')
    setGeneralError('')
    setSuccessMessage('')
  }

  // ── Auth handlers ──────────────────────────────────────────

  /** Standard email/password login. */
  const handleLogin = async () => {
    setGeneralError('')
    setSuccessMessage('')
    const emailOk = validateEmail(email)
    const passOk = validatePassword(password)
    if (!emailOk || !passOk) return

    setLoading(true)
    let error: { message?: string } | null = null
    try {
      const result = await supabase.auth.signInWithPassword({ email, password })
      error = result.error
    } catch (err) {
      error = { message: getAuthExceptionMessage(err) }
    } finally {
      setLoading(false)
    }

    if (error) {
      setGeneralError((error.message === '' ? undefined : error.message) ?? 'Could not authenticate user')
      return
    }

    router.push('/')
    router.refresh()
  }

  /**
   * Sign up → triggers OTP email → transitions UI to OTP screen.
   * Also detects if the account already exists (Supabase returns
   * a user with an empty `identities` array in that case).
   */
  const handleSignup = async () => {
    setGeneralError('')
    setSuccessMessage('')
    const emailOk = validateEmail(email)
    const passOk = validatePassword(password)
    if (!emailOk || !passOk) return

    setLoading(true)
    let data: Awaited<ReturnType<typeof supabase.auth.signUp>>['data'] | null = null
    let error: { message?: string } | null = null
    try {
      const result = await supabase.auth.signUp({ email, password })
      data = result.data
      error = result.error
    } catch (err) {
      error = { message: getAuthExceptionMessage(err) }
    } finally {
      setLoading(false)
    }

    if (error) {
      setGeneralError((error.message === '' ? undefined : error.message) ?? 'Could not create account')
      return
    }

    // ── Duplicate account detection ──────────────────────────
    // When "Confirm email" is enabled, Supabase returns a user
    // with an empty `identities` array if the email is already
    // registered, instead of throwing an error.
    if (
      data?.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      setGeneralError(
        'An account with this email already exists. Please log in instead.'
      )
      return
    }

    // Transition to OTP entry screen
    setOtpEmail(email)
    setOtpDigits(['', '', '', '', '', ''])
    setAuthMode('otp')
    setResendCooldown(60)
    setGeneralError('')
  }

  /** Verify the 6-digit OTP code entered by the user. */
  const handleVerifyOtp = async () => {
    const token = otpDigits.join('')
    if (token.length < 6) {
      setGeneralError('Please enter all 6 digits of the verification code')
      return
    }

    setGeneralError('')
    setLoading(true)
    let error: { message?: string } | null = null
    try {
      const result = await supabase.auth.verifyOtp({
        email: otpEmail,
        token,
        type: 'email',
      })
      error = result.error
    } catch (err) {
      error = { message: getAuthExceptionMessage(err) }
    } finally {
      setLoading(false)
    }

    if (error) {
      setGeneralError((error.message === '' ? undefined : error.message) ?? 'Invalid or expired verification code')
      return
    }

    setSuccessMessage('Account verified successfully!')
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 1200)
  }

  /** Resend the OTP email. */
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setGeneralError('')
    setLoading(true)
    let error: { message?: string } | null = null
    try {
      const result = await supabase.auth.resend({
        type: 'signup',
        email: otpEmail,
      })
      error = result.error
    } catch (err) {
      error = { message: getAuthExceptionMessage(err) }
    } finally {
      setLoading(false)
    }

    if (error) {
      setGeneralError((error.message === '' ? undefined : error.message) ?? 'Could not resend verification code')
      return
    }

    setResendCooldown(60)
    setSuccessMessage('A new verification code has been sent to your email')
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  /** Send a password-reset email via Supabase. */
  const handleForgotPassword = async () => {
    setGeneralError('')
    setSuccessMessage('')
    if (!validateEmail(email)) return

    setLoading(true)
    let error: { message?: string } | null = null
    try {
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      error = result.error
    } catch (err) {
      error = { message: getAuthExceptionMessage(err) }
    } finally {
      setLoading(false)
    }

    if (error) {
      setGeneralError((error.message === '' ? undefined : error.message) ?? 'Could not send password reset email')
      return
    }

    setSuccessMessage(
      'A password reset link has been sent to your email. Please check your inbox.'
    )
  }

  /**
   * Update the user's password after they clicked the reset link.
   * At this point Supabase has already authenticated the user via
   * the recovery token, so we just call `updateUser`.
   */
  const handleResetPassword = async () => {
    setGeneralError('')
    setSuccessMessage('')
    const newPwOk = validateNewPassword(newPassword)
    const confirmOk = validateConfirmPassword(newPassword, confirmPassword)
    if (!newPwOk || !confirmOk) return

    setLoading(true)
    let error: { message?: string } | null = null
    try {
      const result = await supabase.auth.updateUser({ password: newPassword })
      error = result.error
    } catch (err) {
      error = { message: getAuthExceptionMessage(err) }
    } finally {
      setLoading(false)
    }

    if (error) {
      setGeneralError((error.message === '' ? undefined : error.message) ?? 'Could not update password')
      return
    }

    setSuccessMessage('Password updated successfully! Redirecting…')
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 1500)
  }

  // ── OTP digit input handlers ───────────────────────────────

  const handleOtpChange = (index: number, value: string) => {
    // Allow only single digit
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...otpDigits]
    newDigits[index] = digit
    setOtpDigits(newDigits)

    // Auto-advance to next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter' && otpDigits.every((d) => d !== '')) {
      void handleVerifyOtp()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newDigits = [...otpDigits]
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] ?? ''
    }
    setOtpDigits(newDigits)
    // Focus last filled or the next empty
    const focusIndex = Math.min(pasted.length, 5)
    otpRefs.current[focusIndex]?.focus()
  }

  // ── Render helpers ─────────────────────────────────────────

  /** Shared error/success banner */
  const renderMessages = () => (
    <>
      {generalError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-md text-center animate-in fade-in slide-in-from-top-1 duration-200">
          {generalError}
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-md text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      )}
    </>
  )

  // ──────────────────────────────────────────────────────────
  // JSX
  // ──────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background elements to match the scientific theme */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sequence/20 via-background to-background pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-phosphor/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Logo link */}
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 group z-10 transition-colors hover:text-phosphor text-muted-foreground"
      >
        <Activity className="h-6 w-6 text-phosphor" />
        <span className="font-bold text-xl tracking-tight text-foreground group-hover:text-phosphor transition-colors">
          DNAAnalyzer
        </span>
      </Link>

      {/* ── OTP Verification Card ───────────────────────────── */}
      {authMode === 'otp' && (
        <Card className="w-full max-w-md z-10 border-border bg-card text-card-foreground shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-phosphor/10 border border-phosphor/20">
              <ShieldCheck className="h-7 w-7 text-phosphor" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Verify your email
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              We sent a 6-digit verification code to{' '}
              <span className="text-phosphor font-medium">{otpEmail}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {/* OTP digit inputs */}
            <div className="flex justify-center gap-2">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  className="h-14 w-12 rounded-lg border border-input bg-background text-center text-2xl font-mono text-foreground outline-none transition-all duration-200 focus:border-phosphor focus:ring-2 focus:ring-phosphor/30 focus:shadow-[0_0_20px_rgba(0,214,143,0.15)] placeholder:text-muted-foreground"
                  placeholder="·"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {renderMessages()}

            {/* Verify button */}
            <Button
              onClick={handleVerifyOtp}
              disabled={loading || otpDigits.some((d) => !d)}
              className="w-full bg-phosphor text-primary-foreground hover:bg-phosphor/90 font-semibold transition-all active:scale-[0.98] h-11"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Verify & Continue'
              )}
            </Button>

            {/* Resend / Back actions */}
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup')
                  clearErrors()
                }}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className={`transition-colors ${resendCooldown > 0
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-phosphor hover:text-phosphor/80 cursor-pointer'
                  }`}
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend code'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Reset Password Card ─────────────────────────────── */}
      {authMode === 'reset' && (
        <Card className="w-full max-w-md z-10 border-border bg-card text-card-foreground shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-phosphor/10 border border-phosphor/20">
              <KeyRound className="h-7 w-7 text-phosphor" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Set new password
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Choose a strong password for your account
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col gap-4">
              {/* New password */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="new-password" className="text-sm font-medium leading-none text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    New Password
                  </label>
                  <span className="text-xs text-muted-foreground/60">Min. 8 characters</span>
                </div>
                <PasswordInput
                  fieldLabel="New password"
                  id="new-password"
                  name="new-password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`bg-background dark:bg-background border-input text-foreground py-6 transition-colors ${newPasswordError ? 'border-red-500/50 focus-visible:ring-red-500/30' : ''
                    }`}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    if (newPasswordError) validateNewPassword(e.target.value)
                  }}
                  onBlur={() => { if (newPassword) validateNewPassword(newPassword) }}
                  autoFocus
                />
                {newPasswordError && (
                  <p className="text-xs text-red-400 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {newPasswordError}
                  </p>
                )}
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-2">
                <label htmlFor="confirm-password" className="text-sm font-medium leading-none text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Confirm Password
                </label>
                <PasswordInput
                  fieldLabel="Confirm password"
                  id="confirm-password"
                  name="confirm-password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`bg-background dark:bg-background border-input text-foreground py-6 transition-colors ${confirmPasswordError ? 'border-red-500/50 focus-visible:ring-red-500/30' : ''
                    }`}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (confirmPasswordError) validateConfirmPassword(newPassword, e.target.value)
                  }}
                  onBlur={() => { if (confirmPassword) validateConfirmPassword(newPassword, confirmPassword) }}
                />
                {confirmPasswordError && (
                  <p className="text-xs text-red-400 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {confirmPasswordError}
                  </p>
                )}
              </div>

              {renderMessages()}

              <Button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full bg-phosphor text-primary-foreground hover:bg-phosphor/90 font-semibold transition-all active:scale-[0.98] h-11 mt-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Update Password'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Forgot Password Card ────────────────────────────── */}
      {authMode === 'forgot' && (
        <Card className="w-full max-w-md z-10 border-border bg-card text-card-foreground shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-phosphor/10 border border-phosphor/20">
              <Mail className="h-7 w-7 text-phosphor" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Reset your password
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your email address and we&apos;ll send you a link to reset your password
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col gap-4">
              {/* Email field */}
              <div className="flex flex-col gap-2">
                <label htmlFor="reset-email" className="text-sm font-medium leading-none text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Email Address
                </label>
                <Input
                  id="reset-email"
                  name="email"
                  type="email"
                  placeholder="researcher@university.edu"
                  className={`bg-background dark:bg-background border-input text-foreground py-6 transition-colors ${emailError ? 'border-red-500/50 focus-visible:ring-red-500/30' : ''
                    }`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) validateEmail(e.target.value)
                  }}
                  onBlur={() => { if (email) validateEmail(email) }}
                  autoFocus
                />
                {emailError && (
                  <p className="text-xs text-red-400 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {emailError}
                  </p>
                )}
              </div>

              {renderMessages()}

              <Button
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full bg-phosphor text-primary-foreground hover:bg-phosphor/90 font-semibold transition-all active:scale-[0.98] h-11 mt-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Send Reset Link'
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login')
                    clearErrors()
                  }}
                  className="text-phosphor hover:text-phosphor/80 font-medium transition-colors cursor-pointer"
                >
                  Back to login
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Login / Sign-Up Card ──────────────────────────── */}
      {(authMode === 'login' || authMode === 'signup') && (
        <Card className="w-full max-w-md z-10 border-border bg-card text-card-foreground shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {authMode === 'signup' ? 'Create an account' : 'Welcome back'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {authMode === 'signup'
                ? 'Enter your details below to create your account'
                : 'Enter your credentials to access your dashboard'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col gap-4">
              {/* Email field */}
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-medium leading-none text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Email Address
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="researcher@university.edu"
                  className={`bg-background dark:bg-background border-input text-foreground py-6 transition-colors ${emailError ? 'border-red-500/50 focus-visible:ring-red-500/30' : ''
                    }`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) validateEmail(e.target.value)
                  }}
                  onBlur={() => { if (email) validateEmail(email) }}
                />
                {emailError && (
                  <p className="text-xs text-red-400 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {emailError}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium leading-none text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Password
                  </label>
                  {authMode === 'signup' && (
                    <span className="text-xs text-muted-foreground/60">Min. 8 characters</span>
                  )}
                </div>
                <PasswordInput
                  fieldLabel="Password"
                  id="password"
                  name="password"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  className={`bg-background dark:bg-background border-input text-foreground py-6 transition-colors ${passwordError ? 'border-red-500/50 focus-visible:ring-red-500/30' : ''
                    }`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) validatePassword(e.target.value)
                  }}
                  onBlur={() => { if (password) validatePassword(password) }}
                />
                {passwordError && (
                  <p className="text-xs text-red-400 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {passwordError}
                  </p>
                )}

                {/* Forgot password link — only on login mode */}
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot')
                      clearErrors()
                    }}
                    className="text-xs text-muted-foreground hover:text-phosphor transition-colors self-end mt-0.5 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              {renderMessages()}

              {/* Action buttons */}
              {authMode === 'signup' ? (
                <div className="flex flex-col gap-3 mt-4">
                  <Button
                    onClick={handleSignup}
                    disabled={loading}
                    className="w-full bg-phosphor text-primary-foreground hover:bg-phosphor/90 font-semibold transition-all active:scale-[0.98] h-11"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login')
                        clearErrors()
                      }}
                      className="text-phosphor hover:text-phosphor/80 font-medium transition-colors cursor-pointer"
                    >
                      Log in
                    </button>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 mt-4">
                  <Button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full bg-phosphor text-primary-foreground hover:bg-phosphor/90 font-semibold transition-all active:scale-[0.98] h-11"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Log In'
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup')
                        clearErrors()
                      }}
                      className="text-phosphor hover:text-phosphor/80 font-medium transition-colors cursor-pointer"
                    >
                      Sign up
                    </button>
                  </p>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 text-center text-sm text-muted-foreground border-t border-border pt-6">
            <p>
              By continuing, you agree to our{' '}
              <Link href="/terms" className="underline underline-offset-4 hover:text-phosphor">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-phosphor">
                Privacy Policy
              </Link>
              .
            </p>
          </CardFooter>
        </Card>
      )}

      {/* Footer text */}
      <p className="mt-8 text-center text-sm text-muted-foreground max-w-sm z-10">
        Empowering genetic research with industry-leading foundation models.
      </p>
    </div>
  )
}
