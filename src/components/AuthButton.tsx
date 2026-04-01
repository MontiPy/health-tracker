import { useAuth } from '../contexts/useAuth'
import { LogIn, LogOut } from 'lucide-react'

export default function AuthButton() {
  const { user, isLoading, signInWithGoogle, signOut } = useAuth()

  if (isLoading) return null

  if (user) {
    return (
      <button
        onClick={signOut}
        title={`Signed in as ${user.email}`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <LogOut size={12} />
        Sign Out
      </button>
    )
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-teal-600 text-white shadow-sm hover:bg-teal-700 transition-colors"
    >
      <LogIn size={12} />
      Sign In
    </button>
  )
}
