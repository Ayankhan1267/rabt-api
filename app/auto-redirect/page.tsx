'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AutoRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile) { router.push('/login'); return }

      // Role ke hisaab se redirect
      switch (profile.role) {
        case 'founder':
        case 'manager':
        case 'ops':
          router.push('/dashboard')
          break
        case 'specialist_manager':
          router.push('/specialist-dashboard')
          break
        case 'specialist':
          router.push('/specialist-dashboard')
          break
        case 'support':
          router.push('/support')
          break
        default:
          router.push('/dashboard')
      }
    }
    redirect()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', flexDirection: 'column', gap: 16
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid var(--gold)',
        borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite'
      }} />
      <div style={{ color: 'var(--mu)', fontSize: 13 }}>Loading your dashboard...</div>
    </div>
  )
}
