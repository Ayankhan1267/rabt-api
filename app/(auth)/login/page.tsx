'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const demoAccounts = [
    { email: 'ayan@rabtnaturals.com', pass: 'Rabt@2026', label: '⚡ Ayan — Founder' },
    { email: 'tofik@rabtnaturals.com', pass: 'Tofik@123', label: '📊 Tofik — Manager' },
    { email: 'rahima@rabtnaturals.com', pass: 'Rahima@123', label: '🌿 Rahima — Specialist Manager' },
    { email: 'ops@rabtnaturals.com', pass: 'Ops@2026', label: '📦 Operations' },
  ]

  async function handleLogin() {
    if (!email || !password) { toast.error('Fill all fields'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Welcome back!')
    router.push('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,168,83,0.07), transparent 70%)',
    }}>
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 20,
        padding: '36px 38px', width: 400, maxWidth: '94vw',
        boxShadow: '0 40px 80px rgba(0,0,0,0.5)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 26 }}>
          <div style={{
            width: 40, height: 40, background: 'linear-gradient(135deg,#D4A853,#B87C30)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: '#08090C'
          }}>R</div>
          <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800 }}>
            Rabt <span style={{ color: 'var(--gold)' }}>HQ</span>
          </div>
        </div>

        <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Sign In</div>
        <div style={{ fontSize: 12.5, color: 'var(--mu)', marginBottom: 24 }}>Access your AI Business OS</div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="email@rabtnaturals.com"
            style={{
              width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8,
              padding: '10px 13px', color: 'var(--tx)', fontSize: 13.5, fontFamily: 'Outfit', outline: 'none'
            }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            style={{
              width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8,
              padding: '10px 13px', color: 'var(--tx)', fontSize: 13.5, fontFamily: 'Outfit', outline: 'none'
            }}
          />
        </div>

        <button
          onClick={handleLogin} disabled={loading}
          style={{
            width: '100%', padding: 12,
            background: loading ? 'rgba(212,168,83,0.5)' : 'linear-gradient(135deg,#D4A853,#B87C30)',
            border: 'none', borderRadius: 8, color: '#08090C', fontSize: 14, fontWeight: 700,
            fontFamily: 'Syne', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s'
          }}
        >
          {loading ? 'Signing in...' : 'Sign In →'}
        </button>

        {/* Demo Accounts */}
        <div style={{ marginTop: 20, background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Quick Demo Login
          </div>
          {demoAccounts.map((acc, i) => (
            <div
              key={i}
              onClick={() => { setEmail(acc.email); setPassword(acc.pass) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: i < demoAccounts.length - 1 ? '1px solid var(--b1)' : 'none',
                cursor: 'pointer', transition: 'opacity 0.14s'
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseOut={e => (e.currentTarget.style.opacity = '1')}
            >
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>{acc.label}</span>
              <span style={{ fontSize: 10, color: 'var(--mu)', fontFamily: 'DM Mono' }}>{acc.pass}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
