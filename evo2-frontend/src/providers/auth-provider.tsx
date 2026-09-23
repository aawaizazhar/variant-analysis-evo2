'use client'

import { createContext, useCallback, useContext, useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '~/utils/supabase/client'
import { type User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { ACTIVE_ACCESS_PLAN } from '~/lib/app-access'

/**
 * Shape of the profile columns fetched from `profiles`.
 * Keep in sync with the `.select()` call inside `fetchProfile`.
 */
export interface UserProfile {
  id: string
  full_name: string | null
  display_name: string | null
  plan_type: string | null
  subscription_status: string | null
  theme_preference: string | null
  email_notifications: boolean | null
  plan_updated_at: string | null
}

/** Columns requested in every profile fetch — avoids `select('*')`. */
const PROFILE_COLUMNS =
  'id, full_name, display_name, plan_type, subscription_status, theme_preference, email_notifications, plan_updated_at'

function logRecoverableAuthIssue(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`${context}: ${message}`)
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => undefined,
  signOut: async () => undefined,
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children, initialUser }: { children: React.ReactNode, initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true) // will be false soon if user is set
  // Memoize the browser Supabase client so we don't recreate it on every render.
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const router = useRouter()
  const isMounted = useRef(false)

  // Sync with Server Session Prop
  useEffect(() => {
    if (initialUser && initialUser.id !== user?.id) {
       setUser(initialUser)
       fetchProfile(initialUser.id).catch(console.error)
       setLoading(false)
    } else if (!initialUser && user) {
       // Only clear if auth listener hasn't already done it
       setUser(null)
       setProfile(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser])

  useEffect(() => {
    isMounted.current = true
    
    // 1. Initial Session Check (Fallback if client needs fresh data)
    const initializeAuth = async () => {
      try {
        // If we already have a user from the server, we can rely on it initially.
        if (!initialUser) {
          const {
            data: { user: authenticatedUser },
          } = await supabase.auth.getUser()
          if (!isMounted.current) return

          const currentUser = authenticatedUser ?? null
          setUser(currentUser)

          if (currentUser) {
            fetchProfile(currentUser.id).catch((error) =>
              logRecoverableAuthIssue('Error fetching profile', error),
            )
          }
        } else if (initialUser && !profile) {
          fetchProfile(initialUser.id).catch((error) =>
            logRecoverableAuthIssue('Error fetching profile', error),
          )
        }
      } catch (error) {
        logRecoverableAuthIssue('Could not initialize auth session', error)
        if (isMounted.current) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }

    void initializeAuth()

    // 2. Real-time Auth Subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted.current) return

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        supabase.auth
          .getUser()
          .then(({ data: { user: authenticatedUser } }) => {
            if (!isMounted.current) return
            setUser(authenticatedUser ?? null)
            if (authenticatedUser) {
              fetchProfile(authenticatedUser.id).catch((error) =>
                logRecoverableAuthIssue('Error fetching profile', error),
              )
            }
          })
          .catch((error) => {
            logRecoverableAuthIssue('Could not refresh auth user', error)
            if (!isMounted.current) return
            setUser(null)
            setProfile(null)
          })
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
      }
      
      setLoading(false)

      // IMPORTANT: Trigger RSC re-fetch to sync cookies with server. 
      // Put in timeout so it does not block the current react render cycle immediately.
      setTimeout(() => {
        if (isMounted.current) router.refresh()
      }, 0)
    })

    return () => {
      isMounted.current = false
      subscription.unsubscribe()
    }
  }, [router])

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', userId)
        .single()
      
      if (!error && data && isMounted.current) {
        setProfile({
          ...data,
          plan_type: ACTIVE_ACCESS_PLAN,
          subscription_status: 'inactive',
        } as UserProfile)
      }
    } catch (e) {
      logRecoverableAuthIssue('Error fetching profile', e)
    }
  }

  const refreshProfile = useCallback(async () => {
    if (!user) return
    await fetchProfile(user.id)
  }, [user])

  const signOut = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      logRecoverableAuthIssue('Error signing out', error)
      setLoading(false)
    }
    // State clearing and router.refresh() are handled by onAuthStateChange above,
    // avoiding conflicting redundant updates that cause UI freezes.
  }

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    refreshProfile,
    signOut
  }), [user, profile, loading, refreshProfile])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
