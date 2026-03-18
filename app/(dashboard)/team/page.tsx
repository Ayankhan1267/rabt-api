'use client'
import { useEffect, useState } from 'react'
import { supabase, ROLE_CONFIG, UserRole } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ROLE_COLORS: Record<string, string> = {
  founder: 'var(--gold)', manager: 'var(--blue)', specialist_manager: 'var(--teal)',
  specialist: 'var(--green)', support: 'var(--orange)', ops: 'var(--purple)',
}
const ROLE_DEPT: Record<string, string> = {
  founder: 'Founders', manager: 'Operations', specialist_manager: 'Specialist',
  specialist: 'Specialist', support: 'Support', ops: 'Operations',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'var(--green)', on_leave: 'var(--orange)', inactive: 'var(--red)'
}
const ROLES: UserRole[] = ['founder', 'manager', 'specialist_manager', 'specialist', 'support', 'ops']

export default function TeamPage() {
  const [profiles, setProfiles]     = useState<any[]>([])
  const [orders, setOrders]         = useState<any[]>([])
  const [consultations, setCons]    = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [mounted, setMounted]       = useState(false)
  const [tab, setTab]               = useState<'team'|'analytics'|'org'>('team')
  const [filterRole, setFilterRole] = useState('all')
  const [selected, setSelected]     = useState<any|null>(null)
  const [view, setView]             = useState<'grid'|'list'>('grid')
  // edit state
  const [editNotes, setEditNotes]   = useState('')
  const [editPerf, setEditPerf]     = useState(80)
  const [editStatus, setEditStatus] = useState('active')

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: profData } = await supabase.from('profiles').select('*').order('created_at')
    setProfiles(profData || [])

    // Load MongoDB data for performance context
    const url = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null
    if (url) {
      const [ordRes, conRes] = await Promise.allSettled([
        fetch(url + '/api/orders').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/consultations').then(r => r.ok ? r.json() : []),
      ])
      if (ordRes.status === 'fulfilled' && Array.isArray(ordRes.value)) setOrders(ordRes.value)
      if (conRes.status === 'fulfilled' && Array.isArray(conRes.value)) setCons(conRes.value)
    }
    setLoading(false)
  }

  async function updateProfile(id: string, updates: any) {
    await supabase.from('profiles').update(updates).eq('id', id)
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    if (selected?.id === id) setSelected((s: any) => s ? { ...s, ...updates } : s)
    toast.success('Updated!')
  }

  // Specialist stats from MongoDB
  function getSpecialistStats(profileId: string) {
    const myCons = consultations.filter(c => c.assignedSpecialist?.toString() === profileId || c.specialistId?.toString() === profileId)
    const completed = myCons.filter(c => c.status === 'completed').length
    const pending   = myCons.filter(c => c.status === 'pending' || c.status === 'scheduled').length
    return { total: myCons.length, completed, pending }
  }
  function getManagerStats(profileId: string) {
    const myOrders = orders.filter(o => o.managerId === profileId || o.createdBy === profileId)
    return { orders: myOrders.length, revenue: myOrders.reduce((s, o) => s + (o.amount || 0), 0) }
  }

  const filtered = profiles.filter(p => filterRole === 'all' || p.role === filterRole)

  // Analytics
  const roleCounts: Record<string, number> = {}
  profiles.forEach(p => { roleCounts[p.role] = (roleCounts[p.role] || 0) + 1 })
  const avgPerf = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + (p.performance_score || 75), 0) / profiles.length) : 0
  const activeCount  = profiles.filter(p => (p.status || 'active') === 'active').length
  const onLeaveCount = profiles.filter(p => p.status === 'on_leave').length

  function initials(name: string) {
    return (name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  }
  function avatarColor(name: string) {
    const colors = ['#0097A7','#D4860A','#5F8C6E','#7B5EA7','#C04D6B','#2563EB','#059669']
    let h = 0; for (let i = 0; i < (name||'').length; i++) h = (name||'').charCodeAt(i) + h * 31
    return colors[Math.abs(h) % colors.length]
  }

  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  if (!mounted) return null

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>
            👥 Team <span style={{ color: 'var(--gold)' }}>Management</span>
          </h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {profiles.length} members · {activeCount} active · {onLeaveCount} on leave · Avg {avgPerf}% performance
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadAll} style={{ padding: '8px 14px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>↺ Refresh</button>
          <a href="/admin" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            + Add Member →
          </a>
        </div>
      </div>

      {/* STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { l: 'Total Team', v: profiles.length, c: 'var(--blue)', icon: '👥' },
          { l: 'Active', v: activeCount, c: 'var(--green)', icon: '🟢' },
          { l: 'On Leave', v: onLeaveCount, c: 'var(--orange)', icon: '🟡' },
          { l: 'Avg Performance', v: avgPerf + '%', c: 'var(--gold)', icon: '⭐' },
          { l: 'Roles', v: Object.keys(roleCounts).length, c: 'var(--purple)', icon: '🏷️' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <div>
              <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 700, textTransform: 'uppercase' }}>{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {[{id:'team',l:'👥 Team'},{id:'analytics',l:'📊 Analytics'},{id:'org',l:'🏗️ Org Chart'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: tab === t.id ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: tab === t.id ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (tab === t.id ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══ TEAM TAB ══ */}
      {tab === 'team' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setFilterRole('all')} style={{ padding: '5px 13px', borderRadius: 50, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: filterRole === 'all' ? 'var(--gL)' : 'var(--s2)', color: filterRole === 'all' ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (filterRole === 'all' ? 'rgba(212,168,83,.3)' : 'var(--b1)') }}>
                All ({profiles.length})
              </button>
              {ROLES.filter(r => roleCounts[r]).map(r => (
                <button key={r} onClick={() => setFilterRole(r)} style={{ padding: '5px 13px', borderRadius: 50, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: filterRole === r ? 'var(--gL)' : 'var(--s2)', color: filterRole === r ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (filterRole === r ? 'rgba(212,168,83,.3)' : 'var(--b1)') }}>
                  {r.replace('_',' ')} ({roleCounts[r] || 0})
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['grid','list'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '5px 11px', borderRadius: 6, background: view === v ? 'var(--s1)' : 'transparent', border: '1px solid var(--b1)', color: view === v ? 'var(--gold)' : 'var(--mu)', fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit' }}>
                  {v === 'grid' ? '⊞' : '≡'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16, alignItems: 'start' }}>
            {/* Cards */}
            <div style={{ display: view === 'grid' ? 'grid' : 'flex', gridTemplateColumns: view === 'grid' ? 'repeat(auto-fill,minmax(210px,1fr))' : undefined, flexDirection: view === 'list' ? 'column' : undefined, gap: 11 }}>
              {loading && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--mu)' }}>Loading team...</div>}
              {!loading && filtered.length === 0 && (
                <div style={{ background: 'var(--s1)', border: '1px dashed var(--b2)', borderRadius: 14, padding: 60, textAlign: 'center', gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, marginBottom: 8 }}>No Members Found</div>
                  <a href="/admin" style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 9, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit', textDecoration: 'none', display: 'inline-block' }}>Go to Admin Panel</a>
                </div>
              )}

              {view === 'grid' ? filtered.map(m => {
                const perf = m.performance_score || 75
                const stats = getSpecialistStats(m.id)
                return (
                  <div key={m.id} onClick={() => { setSelected(selected?.id === m.id ? null : m); setEditNotes(m.notes||''); setEditPerf(m.performance_score||75); setEditStatus(m.status||'active') }}
                    style={{ background: 'var(--s1)', border: '1px solid '+(selected?.id===m.id?'rgba(212,168,83,.4)':'var(--b1)'), borderRadius: 16, padding: 18, cursor: 'pointer', transition: 'all .15s', position: 'relative' }}
                    onMouseOver={e => { if(selected?.id!==m.id) (e.currentTarget as HTMLElement).style.borderColor='var(--b2)' }}
                    onMouseOut={e => { if(selected?.id!==m.id) (e.currentTarget as HTMLElement).style.borderColor='var(--b1)' }}>
                    {/* Status dot */}
                    <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[m.status||'active']||'var(--green)' }} />
                    {/* Avatar */}
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: avatarColor(m.name||''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Syne', fontWeight: 800, fontSize: 17, marginBottom: 12 }}>
                      {initials(m.name||'')}
                    </div>
                    <div style={{ fontFamily: 'Syne', fontSize: 14.5, fontWeight: 800, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name||'—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--mu2)', marginBottom: 9 }}>{m.role?.replace('_',' ')}</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 50, background: (ROLE_COLORS[m.role]||'var(--mu)')+'18', color: ROLE_COLORS[m.role]||'var(--mu)', fontWeight: 700 }}>
                        {ROLE_DEPT[m.role]||m.role}
                      </span>
                    </div>
                    {/* Specialist stats */}
                    {(m.role === 'specialist' || m.role === 'specialist_manager') && stats.total > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 9 }}>
                        <div style={{ flex: 1, background: 'var(--s2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, color: 'var(--teal)' }}>{stats.completed}</div>
                          <div style={{ fontSize: 9, color: 'var(--mu)' }}>Done</div>
                        </div>
                        <div style={{ flex: 1, background: 'var(--s2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, color: 'var(--orange)' }}>{stats.pending}</div>
                          <div style={{ fontSize: 9, color: 'var(--mu)' }}>Pending</div>
                        </div>
                      </div>
                    )}
                    {/* Performance */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                        <span style={{ color: 'var(--mu)' }}>Performance</span>
                        <span style={{ fontWeight: 700, color: perf>=80?'var(--green)':perf>=60?'var(--gold)':'var(--red)' }}>{perf}%</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: perf+'%', background: perf>=80?'var(--green)':perf>=60?'var(--gold)':'var(--red)', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                )
              }) : filtered.map(m => {
                const perf = m.performance_score || 75
                return (
                  <div key={m.id} onClick={() => { setSelected(selected?.id===m.id?null:m); setEditNotes(m.notes||''); setEditPerf(perf); setEditStatus(m.status||'active') }}
                    style={{ background: 'var(--s1)', border: '1px solid '+(selected?.id===m.id?'rgba(212,168,83,.4)':'var(--b1)'), borderRadius: 12, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(m.name||''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Syne', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                      {initials(m.name||'')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>{m.name||'—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--mu2)' }}>{m.role?.replace('_',' ')} · {m.email||''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, color: perf>=80?'var(--green)':'var(--gold)' }}>{perf}%</div>
                        <div style={{ fontSize: 9.5, color: 'var(--mu)' }}>Perf</div>
                      </div>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[m.status||'active']||'var(--green)', flexShrink: 0 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* DETAIL PANEL */}
            {selected && (
              <div style={{ position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 16, padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: avatarColor(selected.name||''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Syne', fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
                      {initials(selected.name||'')}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>{selected.name||'—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 5 }}>{selected.email||''}</div>
                      <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 50, background: (ROLE_COLORS[selected.role]||'var(--mu)')+'18', color: ROLE_COLORS[selected.role]||'var(--mu)', fontWeight: 700 }}>
                        {selected.role?.replace('_',' ')}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>

                {/* Stats from MongoDB */}
                {(selected.role === 'specialist' || selected.role === 'specialist_manager') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {[
                      { l: 'Total', v: getSpecialistStats(selected.id).total, c: 'var(--teal)' },
                      { l: 'Done', v: getSpecialistStats(selected.id).completed, c: 'var(--green)' },
                      { l: 'Pending', v: getSpecialistStats(selected.id).pending, c: 'var(--orange)' },
                    ].map((s,i) => (
                      <div key={i} style={{ background: 'var(--s2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: s.c }}>{s.v}</div>
                        <div style={{ fontSize: 9.5, color: 'var(--mu)', textTransform: 'uppercase', fontWeight: 700 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Performance slider */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700 }}>Performance Score</span>
                    <span style={{ fontFamily: 'DM Mono', fontWeight: 800, color: editPerf>=80?'var(--green)':editPerf>=60?'var(--gold)':'var(--red)' }}>{editPerf}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={editPerf}
                    onChange={e => setEditPerf(Number(e.target.value))}
                    onMouseUp={() => updateProfile(selected.id, { performance_score: editPerf })}
                    style={{ width: '100%', accentColor: 'var(--gold)' }} />
                  <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden', marginTop: 5 }}>
                    <div style={{ height: '100%', width: editPerf+'%', background: editPerf>=80?'var(--green)':editPerf>=60?'var(--gold)':'var(--red)', borderRadius: 3, transition: 'width .2s' }} />
                  </div>
                </div>

                {/* Status */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 7 }}>Status</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['active','🟢 Active'],['on_leave','🟡 On Leave'],['inactive','🔴 Inactive']].map(([s,l]) => (
                      <button key={s} onClick={() => { setEditStatus(s); updateProfile(selected.id, { status: s }) }}
                        style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid '+(editStatus===s?STATUS_COLORS[s]:'var(--b2)'), background: editStatus===s?STATUS_COLORS[s]+'18':'transparent', color: editStatus===s?STATUS_COLORS[s]:'var(--mu)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8 }}>Contact</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {selected.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--s2)', borderRadius: 9, padding: '9px 12px' }}>
                        <span>✉</span>
                        <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.email}</span>
                        <a href={`mailto:${selected.email}`} style={{ fontSize: 10.5, color: 'var(--blue)', textDecoration: 'none', fontWeight: 700 }}>Email</a>
                      </div>
                    )}
                    {selected.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--s2)', borderRadius: 9, padding: '9px 12px' }}>
                        <span>📱</span>
                        <span style={{ fontSize: 12, flex: 1 }}>{selected.phone}</span>
                        <a href={`https://wa.me/${(selected.phone||'').replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>WhatsApp</a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Role change */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 7 }}>Change Role</div>
                  <select defaultValue={selected.role} onChange={e => updateProfile(selected.id, { role: e.target.value })} style={inp}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                  </select>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
                  <textarea value={editNotes} rows={3} onChange={e => setEditNotes(e.target.value)}
                    onBlur={() => updateProfile(selected.id, { notes: editNotes })}
                    placeholder="Add notes about this member..." style={{ ...inp, resize: 'none', marginBottom: 0 }} />
                </div>

                {/* Joined */}
                {selected.created_at && (
                  <div style={{ fontSize: 11.5, color: 'var(--mu)', padding: '8px 12px', background: 'var(--s2)', borderRadius: 9, marginBottom: 14 }}>
                    📅 Joined: {new Date(selected.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}

                <a href="/admin" style={{ display: 'block', width: '100%', padding: '10px', background: 'var(--gL)', border: '1px solid rgba(212,168,83,.3)', borderRadius: 8, color: 'var(--gold)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit', textAlign: 'center', textDecoration: 'none' }}>
                  Manage in Admin Panel →
                </a>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ ANALYTICS TAB ══ */}
      {tab === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* By Role */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>👥 By Role</div>
              {Object.entries(roleCounts).sort((a,b)=>b[1]-a[1]).map(([role, count], i) => {
                const maxC = Math.max(...Object.values(roleCounts), 1)
                return (
                  <div key={i} style={{ marginBottom: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, color: ROLE_COLORS[role]||'var(--mu)', textTransform: 'capitalize' }}>{role.replace('_',' ')}</span>
                      <span style={{ fontFamily: 'DM Mono', fontWeight: 700 }}>{count}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(count/maxC*100)+'%', background: ROLE_COLORS[role]||'var(--mu)', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
              {Object.keys(roleCounts).length === 0 && <div style={{ color: 'var(--mu)', fontSize: 12, textAlign: 'center', padding: 20 }}>No data</div>}
            </div>

            {/* Performance bands */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>⭐ Performance Bands</div>
              {[
                { l: 'Excellent (80–100%)', f: (m: any) => (m.performance_score||75) >= 80, c: 'var(--green)' },
                { l: 'Good (60–79%)', f: (m: any) => (m.performance_score||75) >= 60 && (m.performance_score||75) < 80, c: 'var(--gold)' },
                { l: 'Average (40–59%)', f: (m: any) => (m.performance_score||75) >= 40 && (m.performance_score||75) < 60, c: 'var(--orange)' },
                { l: 'Below (<40%)', f: (m: any) => (m.performance_score||75) < 40, c: 'var(--red)' },
              ].map((band, i) => {
                const cnt = profiles.filter(band.f).length
                return (
                  <div key={i} style={{ marginBottom: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>{band.l}</span>
                      <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: band.c }}>{cnt}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: profiles.length > 0 ? Math.round(cnt/profiles.length*100)+'%' : '0%', background: band.c, borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Specialist performance from MongoDB */}
          {profiles.filter(p => p.role === 'specialist').length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>🧴 Specialist Consultation Stats</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead><tr>{['Specialist','Consultations','Completed','Pending','Rate'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {profiles.filter(p => p.role === 'specialist').map((m, i) => {
                      const stats = getSpecialistStats(m.id)
                      const rate = stats.total > 0 ? Math.round(stats.completed/stats.total*100) : 0
                      return (
                        <tr key={i} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(m.name||''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Syne', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{initials(m.name||'')}</div>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name||'—'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 13, fontWeight: 700 }}>{stats.total}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>{stats.completed}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 13, color: 'var(--orange)', fontWeight: 700 }}>{stats.pending}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden', width: 60 }}>
                                <div style={{ height: '100%', width: rate+'%', background: rate>=70?'var(--green)':'var(--orange)', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontFamily: 'DM Mono', fontSize: 11, fontWeight: 700 }}>{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>🏆 Performance Leaderboard</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['#','Member','Role','Performance','Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {[...profiles].sort((a,b)=>(b.performance_score||75)-(a.performance_score||75)).map((m, i) => {
                  const perf = m.performance_score || 75
                  return (
                    <tr key={m.id} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 15, color: i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'var(--mu)' }}>#{i+1}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(m.name||''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Syne', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{initials(m.name||'')}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name||'—'}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--mu)' }}>{m.email||''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 50, background: (ROLE_COLORS[m.role]||'var(--mu)')+'18', color: ROLE_COLORS[m.role]||'var(--mu)', fontWeight: 700, textTransform: 'capitalize' }}>{m.role?.replace('_',' ')}</span></td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden', width: 70 }}>
                            <div style={{ height: '100%', width: perf+'%', background: perf>=80?'var(--green)':perf>=60?'var(--gold)':'var(--red)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: perf>=80?'var(--green)':'var(--gold)' }}>{perf}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, background: (STATUS_COLORS[m.status||'active']||'var(--green)')+'18', color: STATUS_COLORS[m.status||'active']||'var(--green)', fontWeight: 700 }}>{(m.status||'active').replace('_',' ')}</span></td>
                    </tr>
                  )
                })}
                {profiles.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No members — go to Admin Panel to add</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ ORG CHART TAB ══ */}
      {tab === 'org' && (
        <div className="card">
          <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 20 }}>🏗️ Organisation Chart — Rabt Naturals</div>
          {profiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>🏗️</div>
              <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>No members — add from Admin Panel</div>
            </div>
          ) : ROLES.filter(r => roleCounts[r]).map(roleName => {
            const roleMembers = profiles.filter(p => p.role === roleName)
            return (
              <div key={roleName} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ height: 1, flex: 1, background: 'var(--b1)' }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: ROLE_COLORS[roleName]||'var(--mu)', textTransform: 'uppercase', letterSpacing: '.08em', background: (ROLE_COLORS[roleName]||'var(--mu)')+'14', padding: '4px 14px', borderRadius: 50, border: '1px solid '+(ROLE_COLORS[roleName]||'var(--mu)')+'30', whiteSpace: 'nowrap' }}>
                    {roleName.replace('_',' ')} · {roleMembers.length}
                  </span>
                  <div style={{ height: 1, flex: 1, background: 'var(--b1)' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {roleMembers.map(m => (
                    <div key={m.id} onClick={() => { setSelected(m); setTab('team'); setEditNotes(m.notes||''); setEditPerf(m.performance_score||75); setEditStatus(m.status||'active') }}
                      style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 14, padding: '14px 16px', textAlign: 'center', cursor: 'pointer', minWidth: 120, transition: 'all .15s' }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--gold)'; (e.currentTarget as HTMLElement).style.background='var(--gL)' }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--b1)'; (e.currentTarget as HTMLElement).style.background='var(--s2)' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor(m.name||''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Syne', fontWeight: 800, fontSize: 16, margin: '0 auto 9px' }}>
                        {initials(m.name||'')}
                      </div>
                      <div style={{ fontFamily: 'Syne', fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>{m.name||'—'}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--mu)', marginBottom: 6 }}>{m.role?.replace('_',' ')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[m.status||'active']||'var(--green)', display: 'inline-block' }} />
                        <span style={{ fontSize: 9.5, color: STATUS_COLORS[m.status||'active']||'var(--green)', fontWeight: 600 }}>{(m.status||'active').replace('_',' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
