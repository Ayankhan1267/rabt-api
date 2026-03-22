'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase, ROLE_CONFIG, UserProfile } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface NavItem {
  id: string; label: string; icon: string; href: string
  badge?: string; badgeColor?: string; roles?: string[]
}
interface NavSection {
  label: string; items: NavItem[]; roles?: string[]
}

const NAV: NavSection[] = [
  {
    label: 'Command',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '⚡', href: '/dashboard', roles: ['founder', 'manager'] },
      { id: 'specialist-dashboard', label: 'Specialist Panel', icon: '🌿', href: '/specialist-dashboard', roles: ['specialist'] },
      { id: 'patients', label: 'My Patients', icon: '👥', href: '/patients', roles: ['specialist'] },
      { id: 'specialist-manager', label: 'Specialist Manager', icon: '👩‍⚕️', href: '/specialist-manager', roles: ['specialist_manager', 'admin'] },
      { id: 'admin', label: 'Admin Panel', icon: '🛡️', href: '/admin', roles: ['founder'] },
      { id: 'kanban', label: 'Kanban', icon: '⬜', href: '/kanban', roles: ['founder', 'manager', 'ops', 'support', 'specialist_manager'] },
      { id: 'calendar', label: 'Calendar', icon: '📅', href: '/calendar', roles: ['founder', 'manager', 'ops', 'support', 'specialist_manager'] },
    ]
  },
  {
    label: 'Partner',
    roles: ['partner'],
    items: [
      { id: 'partner', label: 'Partner Portal', icon: '🌿', href: '/partner', roles: ['partner'] },
    ]
  },
  {
    label: 'Sales',
    items: [
      { id: 'landing', label: 'Landing Page', icon: '🌐', href: '/website', roles: ['founder', 'manager'] },
      { id: 'website', label: 'Website Analytics', icon: '📊', href: '/website-analytics', roles: ['founder', 'manager'] },
      { id: 'customers', label: 'Customers', icon: '👥', href: '/customers', roles: ['founder', 'manager', 'ops', 'specialist_manager'] },
      { id: 'crm', label: 'CRM / Leads', icon: '👥', href: '/crm', roles: ['founder', 'manager', 'specialist_manager', 'specialist', 'support'] },
      { id: 'orders', label: 'Orders', icon: '📦', href: '/orders', roles: ['founder', 'manager', 'ops', 'support'] },
      { id: 'inventory', label: 'Inventory', icon: '🗄️', href: '/inventory', roles: ['founder', 'manager', 'ops'] },
    ]
  },
  {
    label: 'Specialist',
    roles: ['founder', 'specialist_manager', 'specialist'],
    items: [
      { id: 'consultations', label: 'Consultations', icon: '🧴', href: '/consultations', roles: ['admin', 'specialist_manager'] },
      { id: 'skinprofiles', label: 'Skin Profiles', icon: '🌿', href: '/skinprofiles' },
      { id: 'specialists', label: 'Specialists', icon: '👩‍⚕️', href: '/specialists', roles: ['founder', 'specialist_manager'] },
    ]
  },
  {
    label: 'Support',
    roles: ['founder', 'manager', 'support', 'ops', 'specialist_manager'],
    items: [
      { id: 'support', label: 'Support Chat', icon: '💬', href: '/support', badge: '5', badgeColor: 'var(--red)', roles: ['founder', 'manager', 'support', 'ops', 'specialist_manager'] },
      { id: 'communications', label: 'Communications', icon: '📡', href: '/communications', roles: ['founder', 'manager'] },
      { id: 'reminders', label: 'Reminders & Follow-up', icon: '📲', href: '/reminders', roles: ['founder', 'manager', 'support', 'ops', 'specialist_manager'] },
    ]
  },
  {
    label: 'Marketing',
    roles: ['founder', 'manager'],
    items: [
      { id: 'marketing', label: 'Marketing', icon: '📢', href: '/marketing' },
      { id: 'content', label: 'Content Studio', icon: '🎬', href: '/content' },
      { id: 'ads', label: 'Ads Manager', icon: '📊', href: '/ads' },

      { id: 'partner-portal', label: 'Partner Portal', icon: '🌿', href: '/partner' },
      { id: 'partner-manager', label: 'Partner Manager', icon: '🤝', href: '/partner-manager' },
    ]
  },
  {
    label: 'Business',
    roles: ['founder', 'manager'],
    items: [
      { id: 'finance', label: 'Finance', icon: '💰', href: '/finance' },
      { id: 'productlab', label: 'Product Lab', icon: '🧪', href: '/productlab' },
      { id: 'goals', label: 'Goals & OKR', icon: '🎯', href: '/goals' },
      { id: 'reports', label: 'Reports', icon: '📋', href: '/reports' },
      { id: 'team-hub', label: 'Team Hub', icon: '💬', href: '/team-hub', roles: ['founder', 'manager', 'specialist_manager', 'specialist', 'ops', 'support', 'admin'] },
      { id: 'team', label: 'Team', icon: '🤝', href: '/team' },
    ]
  },
  {
    label: 'AI System',
    roles: ['founder', 'manager', 'ops', 'specialist_manager'],
    items: [
      { id: 'automation', label: 'Automation', icon: '⚙️', href: '/automation', roles: ['founder', 'manager'] },
      { id: 'aiagents', label: 'AI Agents', icon: '🤖', href: '/aiagents', badge: 'Live', badgeColor: 'var(--green)', roles: ['founder', 'manager', 'ops', 'specialist_manager'] },
      { id: 'knowledge', label: 'Knowledge Base', icon: '📚', href: '/knowledge', roles: ['founder', 'manager', 'ops', 'specialist_manager'] },
    ]
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    loadProfile()
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  function checkMobile() {
    setIsMobile(window.innerWidth < 768)
  }

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    let { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) {
      const { data: partnerCheck } = await supabase.from('sales_partners').select('id').eq('email', user.email!).maybeSingle()
      const role = user.email === 'ayan@rabtnaturals.com' ? 'founder' :
                   user.email === 'tofik@rabtnaturals.com' ? 'manager' :
                   user.email === 'rahima@rabtnaturals.com' ? 'specialist_manager' :
                   user.email === 'ops@rabtnaturals.com' ? 'ops' :
                   partnerCheck ? 'partner' : 'support'
      const name = user.email === 'ayan@rabtnaturals.com' ? 'Ayan Mansuri' :
                   user.email === 'tofik@rabtnaturals.com' ? 'Tofik Khan' :
                   user.email === 'rahima@rabtnaturals.com' ? 'Rahima Choudhary' :
                   user.email === 'ops@rabtnaturals.com' ? 'Ops User' : (user.email?.split('@')[0] || 'User')
      await supabase.from('profiles').upsert({ id: user.id, email: user.email, name, role })
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      prof = data
    }
    setProfile(prof as UserProfile)
    ;(window as any).__profile = prof
    if (prof?.role === 'partner' && !pathname.startsWith('/partner')) router.push('/partner')
    if (prof?.role === 'specialist' && pathname === '/') router.push('/specialist-dashboard')
    if (prof?.role === 'specialist_manager' && pathname === '/') router.push('/specialist-dashboard')
    if (prof?.role === 'ops' && pathname === '/') router.push('/orders')
    if (prof?.role === 'support' && pathname === '/') router.push('/crm')
    loadNotifications(user.id)
    setupRealtime(user.id)
    registerPushNotifications()
  }

  async function registerPushNotifications() {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const existing = await reg.pushManager.getSubscription()
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BDTSB1wUmGSUCyejreaI8Clj3DDWPT6QHq4VbA8VmOaEDg3qDX98ftMwWtHyoZJqPMS1xLweLiTfbmonaSIV2z8'
      })
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, subscription: sub })
        })
      }
    } catch(e) { console.log('Push reg error:', e) }
  }

  async function loadNotifications(userId: string) {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    setNotifications(data || [])
    setUnreadCount((data || []).filter((n: any) => !n.is_read).length)
  }

  function setupRealtime(userId: string) {
    supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        const notif = payload.new as any
        playNotificationSound(notif.type || 'default')
        setNotifications(prev => [notif, ...prev])
        setUnreadCount(prev => prev + 1)
        const userRole = (window as any).__profile?.role || ''
        if (notif.type === 'consultation' && ['specialist', 'specialist_manager', 'founder', 'manager', 'admin'].includes(userRole)) {
          toast((t) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>🌿 New Consultation!</div>
              <div style={{ fontSize: 12, color: '#555' }}>{notif.message || 'New consultation request'}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { window.location.href = '/specialist-dashboard'; toast.dismiss(t.id) }} style={{ padding: '5px 12px', background: '#0097A7', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Accept</button>
                <button onClick={() => { window.location.href = '/consultations'; toast.dismiss(t.id) }} style={{ padding: '5px 10px', background: '#f0f0f0', border: 'none', borderRadius: 6, color: '#333', fontSize: 11, cursor: 'pointer' }}>View</button>
                <button onClick={() => toast.dismiss(t.id)} style={{ padding: '5px 10px', background: '#fee', border: 'none', borderRadius: 6, color: '#e44', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ), { duration: 15000, icon: '🌿' })
        } else {
          toast(notif.title, { icon: notif.type === 'order' ? '📦' : '🔔', duration: 5000 })
        }
      }).subscribe()
  }

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioContext()
      ;[440, 660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3)
        osc.start(ctx.currentTime + i * 0.1); osc.stop(ctx.currentTime + i * 0.1 + 0.3)
      })
    } catch {}
  }

  async function markAllRead() {
    if (!profile) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Signed out!')
  }

  const roleConfig = profile ? ROLE_CONFIG[profile.role] : null
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const hasAccess = (item: NavItem | NavSection) => {
    if (!profile) return false
    if (profile.role === 'founder' || profile.role === 'admin') return true
    const roles = item.roles
    if (!roles) return true
    return roles.includes(profile.role)
  }
  const currentTitle = NAV.flatMap(s => s.items).find(i => isActive(i.href))?.label || 'Dashboard'

  // -- Sidebar Content (shared between desktop + mobile) --
  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--b1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, overflow: 'hidden', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,151,167,0.2)' }}>
            <img src="https://rabtnaturals.com/images/logo.png" alt="Rabt" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
              onError={(e: any) => { e.target.style.display='none'; e.target.parentElement.innerHTML='<span style="font-family:Georgia,serif;font-style:italic;font-size:18px;font-weight:900;color:#0097A7">r</span>' }} />
          </div>
          <div>
            <div style={{ lineHeight: 1.2 }}>
              <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 15, fontWeight: 900, color: '#0097A7', letterSpacing: '-0.3px' }}>rabt </span>
              <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--tx)' }}>NATURALS</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>HQ � AI Business OS</div>
          </div>
          {/* Close button on mobile */}
          {isMobile && profile?.role !== 'partner' && (
            <button onClick={() => setSidebarOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 20, padding: 4 }}>?</button>
          )}
        </div>
        {roleConfig && (
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: roleConfig.color + '22', color: roleConfig.color, border: `1px solid ${roleConfig.color}44`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{roleConfig.label}</div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '9px', overflowY: 'auto' }}>
        {NAV.map(section => {
          if (!hasAccess(section)) return null
          const visibleItems = section.items.filter(item => hasAccess(item))
          if (visibleItems.length === 0) return null
          return (
            <div key={section.label} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: 'var(--mu)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '7px 8px 3px', fontWeight: 600 }}>{section.label}</div>
              {visibleItems.map(item => {
                const active = isActive(item.href)
                return (
                  <a key={item.id} href={item.href} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 9px', borderRadius: 8, cursor: 'pointer',
                    color: active ? '#0097A7' : 'var(--mu2)',
                    background: active ? 'rgba(0,151,167,0.12)' : 'transparent',
                    fontWeight: active ? 600 : 400, fontSize: 13,
                    transition: 'all 0.13s', marginBottom: 1, textDecoration: 'none',
                    borderLeft: active ? '2px solid #0097A7' : '2px solid transparent',
                  }}>
                    <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: item.badgeColor ? item.badgeColor + '22' : 'rgba(239,68,68,0.15)', color: item.badgeColor || 'var(--red)', fontFamily: 'DM Mono' }}>{item.badge}</span>
                    )}
                  </a>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '11px 13px', borderTop: '1px solid var(--b1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg,#0097A7,#005F6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 12, fontWeight: 800, color: '#fff' }}>{profile?.name?.charAt(0).toUpperCase() || '?'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.name || 'Loading...'}</div>
            <div style={{ fontSize: 10, color: 'var(--mu)' }}>{roleConfig?.label || '🔔'}</div>
          </div>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
        </div>
        <button onClick={logout} style={{ width: '100%', marginTop: 9, padding: '6px', background: 'rgba(0,151,167,0.08)', border: '1px solid rgba(0,151,167,0.2)', borderRadius: 8, color: '#0097A7', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600 }}>? Sign Out</button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* -- DESKTOP SIDEBAR -- */}
      {!isMobile && (
        <aside style={{ width: '240px', background: 'var(--s1)', borderRight: '1px solid var(--b1)', height: '100vh', position: 'fixed', top: 0, left: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', zIndex: 200, scrollbarWidth: 'none' }}>
          <SidebarContent />
        </aside>
      )}

      {/* -- MOBILE SIDEBAR OVERLAY -- */}
      {isMobile && sidebarOpen && (
        <>
          {/* Backdrop */}
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 299, backdropFilter: 'blur(2px)' }} />
          {/* Drawer */}
          <aside style={{ position: 'fixed', top: 0, left: 0, width: '280px', height: '100vh', background: 'var(--s1)', borderRight: '1px solid var(--b1)', display: 'flex', flexDirection: 'column', zIndex: 300, overflowY: 'auto', scrollbarWidth: 'none', animation: 'slideIn 0.2s ease' }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* -- MAIN -- */}
      <main style={{ marginLeft: isMobile ? 0 : 240, flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <div style={{ background: 'var(--s1)', backdropFilter: 'blur(18px)', borderBottom: '1px solid var(--b1)', padding: isMobile ? '0 14px' : '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 100 }}>

          {/* Hamburger on mobile */}
          {isMobile && profile?.role !== 'partner' && (
            <button onClick={() => setSidebarOpen(true)} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,151,167,0.08)', border: '1px solid rgba(0,151,167,0.2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{ width: 16, height: 2, background: 'var(--teal)', borderRadius: 1 }} />
              <div style={{ width: 16, height: 2, background: 'var(--teal)', borderRadius: 1 }} />
              <div style={{ width: 16, height: 2, background: 'var(--teal)', borderRadius: 1 }} />
            </button>
          )}

          {/* Logo on mobile topbar */}
          {isMobile && profile?.role !== 'partner' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 14, fontWeight: 900, color: '#0097A7' }}>rabt </span>
              <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--tx)' }}>NATURALS</span>
            </div>
          )}

          {!isMobile && <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>{currentTitle}</div>}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotif(!showNotif); if (!showNotif && unreadCount > 0) markAllRead() }} style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(0,151,167,0.08)', border: '1px solid rgba(0,151,167,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🔔</button>
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: 'var(--red)', border: '2px solid var(--bg)', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </div>

            {/* Date � hide on small mobile */}
            {!isMobile && (
              <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: 'DM Mono', padding: '5px 10px', background: 'rgba(0,151,167,0.06)', border: '1px solid rgba(0,151,167,0.15)', borderRadius: 6 }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* Notification Panel */}
        {showNotif && (
          <div style={{ position: 'fixed', top: 52, right: 0, width: isMobile ? '100vw' : 320, height: 'calc(100vh - 52px)', background: 'var(--s1)', borderLeft: '1px solid var(--b2)', zIndex: 500, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Notifications</span>
              <button onClick={() => setShowNotif(false)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mu)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                  <div style={{ fontSize: 13 }}>No notifications yet</div>
                </div>
              ) : notifications.map(n => (
                <div key={n.id} style={{ background: 'var(--s2)', border: `1px solid ${n.is_read ? 'var(--b1)' : 'rgba(0,151,167,0.3)'}`, borderLeft: n.is_read ? '1px solid var(--b1)' : '3px solid #0097A7', borderRadius: 8, padding: '11px 13px', marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--mu2)', lineHeight: 1.45 }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Page Content */}
        <div style={{ flex: 1, padding: isMobile ? '16px 14px 80px' : '22px 24px 40px', overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
          {children}
        </div>

        {/* -- MOBILE BOTTOM NAV -- */}
        {isMobile && profile?.role !== 'partner' && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: 'var(--s1)', borderTop: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 200, paddingBottom: 8 }}>
            {/* Show top 4 relevant nav items */}
            {NAV.flatMap(s => s.items).filter(item => hasAccess(item)).slice(0, 4).map(item => {
              const active = isActive(item.href)
              return (
                <a key={item.id} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, textDecoration: 'none', padding: '6px 10px', borderRadius: 10, background: active ? 'rgba(0,151,167,0.1)' : 'transparent', minWidth: 56 }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? 'var(--teal)' : 'var(--mu)', textAlign: 'center', lineHeight: 1.2 }}>{item.label.split(' ')[0]}</span>
                </a>
              )
            })}
            {/* Menu button */}
            <button onClick={() => setSidebarOpen(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', minWidth: 56 }}>
              <span style={{ fontSize: 20 }}>☰</span>
              <span style={{ fontSize: 9, color: 'var(--mu)', fontWeight: 400 }}>More</span>
            </button>
          </div>
        )}
      </main>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 768px) {
          .card { padding: 14px !important; }
          table { font-size: 12px !important; }
        }
      `}</style>
    </div>
  )
}
