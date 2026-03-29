'use client'

import { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '~/utils/supabase/client'
import { type User, type Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  profile: any | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children, initialSession }: { children: React.ReactNode, initialSession?: Session | null }) {
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null)
  const [profile, setProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true) // will be false soon if user is set
  const supabase = createClient()
  const router = useRouter()
  const isMounted = useRef(false)

  // Sync with Server Session Prop
  useEffect(() => {
    if (initialSession?.user && initialSession.user.id !== user?.id) {
       setUser(initialSession.user)
       fetchProfile(initialSession.user.id).catch(console.error)
       setLoading(false)
    } else if (!initialSession?.user && user) {
       // Only clear if auth listener hasn't already done it
       setUser(null)
       setProfile(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession])

  useEffect(() => {
    isMounted.current = true
    
    // 1. Initial Session Check (Fallback if client needs fresh data)
    const initializeAuth = async () => {
      // If we already have a user from initialSession, we can rely on it initially.
      if (!initialSession?.user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted.current) return

        const currentUser = session?.user ?? null
        setUser(currentUser)
        
        if (currentUser) {
          fetchProfile(currentUser.id).catch(console.error)
        }
      } else if (initialSession.user && !profile) {
        fetchProfile(initialSession.user.id).catch(console.error)
      }
      setLoading(false)
    }

    initializeAuth()

    // 2. Real-time Auth Subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted.current) return

      const currentUser = session?.user ?? null
      
      // Update local state
      setUser(currentUser)
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentUser) {
           // Do not block UI updates; fetch in background
           fetchProfile(currentUser.id).catch(console.error)
        }
      } else if (event === 'SIGNED_OUT') {
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
        .select('*')
        .eq('id', userId)
        .single()
      
      if (!error && data && isMounted.current) {
        setProfile(data)
      }
    } catch (e) {
      console.error("Error fetching profile:", e)
    }
  }

  const signOut = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    // State clearing and router.refresh() are handled by onAuthStateChange above,
    // avoiding conflicting redundant updates that cause UI freezes.
  }

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    signOut
  }), [user, profile, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
