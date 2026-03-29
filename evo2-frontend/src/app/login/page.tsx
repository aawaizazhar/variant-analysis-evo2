import { login, signup } from './actions'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import Link from 'next/link'
import { Activity } from 'lucide-react'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message: string }> }) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background elements to match the scientific theme */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sequence/20 via-background to-background pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-phosphor/10 rounded-full blur-[128px] pointer-events-none" />
      
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 group z-10 transition-colors hover:text-phosphor text-muted-foreground">
        <Activity className="h-6 w-6 text-phosphor" />
        <span className="font-bold text-xl tracking-tight text-foreground group-hover:text-phosphor transition-colors">DNAAnalyzer</span>
      </Link>

      <Card className="w-full max-w-md z-10 border-white/10 bg-black/50 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-1 text-center pb-8">
          <CardTitle className="text-2xl font-semibold tracking-tight">Create an account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email below to log in or create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium leading-none text-muted-foreground">
                Email Address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="researcher@university.edu"
                className="bg-black/50 border-white/10 py-6"
                required
              />
            </div>
            
            <div className="flex flex-col gap-2 relative">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium leading-none text-muted-foreground">
                  Password
                </label>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className="bg-black/50 border-white/10 py-6"
                required
              />
            </div>

            {resolvedSearchParams?.message && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-md text-center">
                {resolvedSearchParams.message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <Button
                formAction={signup}
                variant="outline"
                className="w-full border-white/10 bg-transparent hover:bg-white/5 transition-all active:scale-[0.98] focus-visible:ring-1 focus-visible:ring-phosphor"
              >
                Sign Up
              </Button>
              <Button
                formAction={login}
                className="w-full bg-phosphor text-black hover:bg-phosphor/90 font-semibold transition-all active:scale-[0.98] focus-visible:ring-1 focus-visible:ring-white"
              >
                Log In
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 text-center text-sm text-muted-foreground border-t border-white/5 pt-6">
          <p>
            By continuing, you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-phosphor">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-phosphor">
              Privacy Policy
            </Link>.
          </p>
        </CardFooter>
      </Card>
      
      {/* Footer text */}
      <p className="mt-8 text-center text-sm text-muted-foreground max-w-sm z-10">
        Empowering genetic research with industry-leading foundation models.
      </p>
    </div>
  )
}
