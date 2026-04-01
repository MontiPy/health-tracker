import { createContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { pushToSupabase, pullFromSupabase } from '../lib/sync'
import type { UserProfile, DayLog } from '../models/hallModel'

const STORAGE_KEY_PROFILE    = 'health_tracker_profile'
const STORAGE_KEY_LOGS       = 'health_tracker_logs'
const STORAGE_KEY_START_DATE = 'health_tracker_start_date'
const STORAGE_KEY_ENERGY_UNIT = 'health_tracker_energy_unit'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function handleLogin(userId: string) {
    const remote = await pullFromSupabase(userId)

    if (remote) {
      // Supabase has data → overwrite localStorage (Supabase wins)
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(remote.profile))
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(remote.logs))
      localStorage.setItem(STORAGE_KEY_START_DATE, remote.startDate)
      localStorage.setItem(STORAGE_KEY_ENERGY_UNIT, remote.energyUnit)
      // Force a page reload so App.tsx re-reads localStorage state
      window.location.reload()
    } else {
      // No remote data → migrate localStorage up to Supabase (first login)
      const profileStr  = localStorage.getItem(STORAGE_KEY_PROFILE)
      const logsStr     = localStorage.getItem(STORAGE_KEY_LOGS)
      const startDate   = localStorage.getItem(STORAGE_KEY_START_DATE)
      const energyUnit  = localStorage.getItem(STORAGE_KEY_ENERGY_UNIT) ?? 'kcal'

      if (profileStr && startDate) {
        const profile: UserProfile = {
          units: 'metric',
          activityChangeReachPct: 0,
          activityChangeMaintainPct: 0,
          uncertaintyPct: 5,
          ...JSON.parse(profileStr),
        }
        const logs: DayLog[] = logsStr ? JSON.parse(logsStr) : []
        await pushToSupabase(userId, profile, logs, startDate, energyUnit)
      }
    }
  }

  useEffect(() => {
    // Initialise from existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUser = session?.user ?? null
        setUser(nextUser)

        if (nextUser) {
          await handleLogin(nextUser.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

