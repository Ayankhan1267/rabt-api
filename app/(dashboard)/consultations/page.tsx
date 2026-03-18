'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const STATUS_CONFIG: Record<string, {color: string, bg: string}> = {
  pending:    { color: 'var(--orange)', bg: 'var(--orL)' },
  accepted:   { color: 'var(--teal)',   bg: 'rgba(20,184,166,0.15)' },
  scheduled:  { color: 'var(--blue)',   bg: 'var(--blL)' },
  rescheduled:{ color: 'var(--purple)', bg: 'rgba(139,92,246,0.15)' },
  completed:  { color: 'var(--green)',  bg: 'var(--grL)' },
  cancelled:  { color: 'var(--red)',    bg: 'var(--rdL)' },
  in_progress:{ color: 'var(--teal)',   bg: 'rgba(20,184,166,0.15)' },
}

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState<any[]>([])
  const [specialists, setSpecialists] = useState<any[]>([])
  const [hqProfiles, setHqProfiles] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [specFilter, setSpecFilter] = useState('all')
  const [view, setView] = useState<'table'|'cards'|'analytics'>('table')
  const [selected, setSelected] = useState<any>(null)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      setProfile(prof)
      const { data: hq } = await supabase.from('profiles').select('*').in('role', ['specialist', 'specialist_manager'])
      setHqProfiles(hq || [])

      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (url) {
        const [consRes, specRes] = await Promise.all([
          fetch(url + '/api/consultations').then(r => r.ok ? r.json() : []),
          fetch(url + '/api/specialists').then(r => r.ok ? r.json() : []),
        ])
        setConsultations(Array.isArray(consRes) ? consRes : [])
        setSpecialists(Array.isArray(specRes) ? specRes : [])
      }
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  async function assignSpecialist(consId: string, specId: string) {
    const url = process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
    if (!url) { toast.error('MongoDB not connected'); return }
    setAssigning(true)
    try {
      const res = await fetch(url + '/api/consultations/' + consId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedSpecialist: specId })
      })
      if (res.ok) {
        toast.success('Specialist assigned!')
        setConsultations(prev => prev.map(c => c._id === consId ? { ...c, assignedSpecialist: specId } : c))
        if (selected?._id === consId) setSelected((s: any) => ({ ...s, assignedSpecialist: specId }))
        // Notify in HQ
        const mongoSpec = specialists.find(s => s._id === specId)
        const hqSpec = hqProfiles.find(h => h.email === mongoSpec?.email)
        if (hqSpec) {
          await supabase.from('notifications').insert({ user_id: hqSpec.id, title: 'New Consultation Assigned', message: 'A new consultation has been assigned to you!', type: 'consultation' })
        }
      } else toast.error('Failed to assign')
    } catch { toast.error('Error') }
    setAssigning(false)
  }

  async function updateStatus(consId: string, status: string) {
    const url = process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
    if (!url) return
    try {
      await fetch(url + '/api/consultations/' + consId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      toast.success('Status updated!')
      setConsultations(prev => prev.map(c => c._id === consId ? { ...c, status } : c))
      if (selected?._id === consId) setSelected((s: any) => ({ ...s, status }))
    } catch { toast.error('Error') }
  }

  const getSpecName = (specId: any) => {
    if (!specId) return null
    const id = typeof specId === 'string' ? specId : specId?.$oid || String(specId)
    return specialists.find(s => s._id === specId || s._id === id)?.name || null
  }

  const filtered = consultations.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.concern?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status?.toLowerCase() === statusFilter
    const matchSpec = specFilter === 'all' || (specFilter === 'unassigned' ? !c.assignedSpecialist : c.assignedSpecialist?.toString() === specFilter)
    return matchSearch && matchStatus && matchSpec
  })

  const statuses = ['all','pending','accepted','scheduled','completed','cancelled','rescheduled']
  const totalRevenue = consultations.filter(c => c.status === 'completed').length * 30
  const unassigned = consultations.filter(c => !c.assignedSpecialist && c.status === 'pending').length

  // Analytics
  const statusCounts = statuses.slice(1).reduce((a, s) => { a[s] = consultations.filter(c => c.status === s).length; return a }, {} as Record<string,number>)
  const specPerf = specialists.map(s => ({
    name: s.name,
    id: s._id,
    total: consultations.filter(c => c.assignedSpecialist?.toString() === s._id?.toString()).length,
    completed: consultations.filter(c => c.assignedSpecialist?.toString() === s._id?.toString() && c.status === 'completed').length,
    pending: consultations.filter(c => c.assignedSpecialist?.toString() === s._id?.toString() && c.status === 'pending').length,
  })).filter(s => s.total > 0).sort((a,b) => b.total - a.total)

  const monthlyData: Record<string, number> = {}
  consultations.forEach(c => {
    const d = new Date(c.createdAt || c.scheduledDate || Date.now())
    const key = d.toLocaleDateString('en-IN', {month:'short', year:'2-digit'})
    monthlyData[key] = (monthlyData[key] || 0) + 1
  })
  const monthEntries = Object.entries(monthlyData).slice(-6)
  const maxMonth = Math.max(...monthEntries.map(([,v]) => v), 1)

  const inp: any = { background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'Outfit', outline: 'none' }

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Consultations <span style={{ color: 'var(--gold)' }}>Hub</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {consultations.length} total
            {unassigned > 0 && <span style={{ color: 'var(--orange)' }}> · {unassigned} unassigned</span>}
            <span style={{ color: 'var(--green)' }}> · Live</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['table','cards','analytics'].map(v => (
            <button key={v} onClick={() => setView(v as any)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', textTransform: 'capitalize', background: view === v ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: view === v ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (view === v ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
              {v === 'analytics' ? '📊 Analytics' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
          <button onClick={loadAll} style={{ padding: '8px 14px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total', value: consultations.length, color: 'var(--blue)' },
          { label: 'Pending', value: statusCounts.pending || 0, color: 'var(--orange)' },
          { label: 'Accepted', value: (statusCounts.accepted || 0) + (statusCounts.scheduled || 0), color: 'var(--teal)' },
          { label: 'Completed', value: statusCounts.completed || 0, color: 'var(--green)' },
          { label: 'Cancelled', value: statusCounts.cancelled || 0, color: 'var(--red)' },
          { label: 'Revenue', value: '₹' + totalRevenue.toLocaleString('en-IN'), color: 'var(--gold)' },
        ].map((s, i) => (
          <div key={i} className="card" onClick={() => setStatusFilter(s.label.toLowerCase() !== 'revenue' && s.label.toLowerCase() !== 'total' ? s.label.toLowerCase() : 'all')} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Unassigned Alert */}
      {unassigned > 0 && (
        <div style={{ background: 'var(--orL)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'var(--orange)' }}>⚠️ <strong>{unassigned} pending consultations</strong> need specialist assignment</span>
          <button onClick={() => { setStatusFilter('pending'); setSpecFilter('unassigned') }} style={{ padding: '5px 12px', background: 'var(--orange)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 11.5, cursor: 'pointer', fontWeight: 700, fontFamily: 'Outfit' }}>Assign Now</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, phone, concern..." style={{ ...inp, flex: 1, minWidth: 200 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
          {statuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={specFilter} onChange={e => setSpecFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="all">All Specialists</option>
          <option value="unassigned">Unassigned</option>
          {specialists.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <>
          {/* TABLE VIEW */}
          {view === 'table' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Patient','Phone','Concern','Scheduled','Specialist','Status','Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const sc = STATUS_CONFIG[c.status?.toLowerCase()] || STATUS_CONFIG.pending
                    const specName = getSpecName(c.assignedSpecialist)
                    return (
                      <tr key={i} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.018)'} onMouseOut={e => e.currentTarget.style.background=''}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{c.name || c.fullName}</div>
                          <div style={{ fontSize: 10, color: 'var(--mu)' }}>#{c.consultationNumber || c._id?.slice(-6)}</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--mu)' }}>{c.phone || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--mu2)', maxWidth: 180 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.concern || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>
                          {c.scheduledDate ? new Date(c.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                          {c.scheduledTime && <div style={{ fontSize: 10 }}>{c.scheduledTime}</div>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {specName ? (
                            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ {specName}</span>
                          ) : (
                            <select onChange={e => assignSpecialist(c._id, e.target.value)} disabled={assigning}
                              style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 6, padding: '4px 8px', color: 'var(--orange)', fontSize: 11, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit' }}>
                              <option value="">⚠️ Assign</option>
                              {specialists.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>{c.status || 'pending'}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => setSelected(c)} style={{ padding: '4px 10px', background: 'var(--gL)', border: 'none', borderRadius: 6, color: 'var(--gold)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit' }}>View</button>
                            {c.phone && <a href={'https://wa.me/' + c.phone.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent('Hi ' + c.name + '! Rabt Naturals consultation ke baare mein 🌿')} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 9px', background: 'var(--grL)', border: 'none', borderRadius: 6, color: 'var(--green)', fontSize: 10.5, cursor: 'pointer', textDecoration: 'none', fontWeight: 700 }}>WA</a>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No consultations found</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* CARDS VIEW */}
          {view === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {filtered.map((c, i) => {
                const sc = STATUS_CONFIG[c.status?.toLowerCase()] || STATUS_CONFIG.pending
                const specName = getSpecName(c.assignedSpecialist)
                return (
                  <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderLeft: '3px solid ' + sc.color, borderRadius: 14, padding: 16, cursor: 'pointer' }} onClick={() => setSelected(c)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>{c.name || c.fullName}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{c.phone || 'No phone'}</div>
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: sc.bg, color: sc.color, textTransform: 'capitalize', height: 'fit-content' }}>{c.status || 'pending'}</span>
                    </div>
                    {c.concern && <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 10, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{c.concern}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--mu)' }}>
                        {c.scheduledDate ? '📅 ' + new Date(c.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Not scheduled'}
                        {c.scheduledTime && ' · ' + c.scheduledTime}
                      </div>
                    </div>
                    {specName ? (
                      <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>👩‍⚕️ {specName}</div>
                    ) : (
                      <select onClick={e => e.stopPropagation()} onChange={e => assignSpecialist(c._id, e.target.value)} disabled={assigning}
                        style={{ width: '100%', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 7, padding: '6px 10px', color: 'var(--orange)', fontSize: 11.5, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit' }}>
                        <option value="">⚠️ Assign Specialist</option>
                        {specialists.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--mu)', background: 'var(--s1)', borderRadius: 14, border: '1px solid var(--b1)' }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>🌿</div>
                  <div>No consultations found</div>
                </div>
              )}
            </div>
          )}

          {/* ANALYTICS VIEW */}
          {view === 'analytics' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Monthly chart */}
                <div className="card">
                  <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Monthly Consultations</div>
                  {monthEntries.map(([month, count], i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{month}</span>
                        <span style={{ fontFamily: 'DM Mono', color: 'var(--teal)' }}>{count}</span>
                      </div>
                      <div style={{ height: 10, background: 'var(--s2)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: Math.round(count / maxMonth * 100) + '%', background: 'linear-gradient(90deg,#14B8A6,#3B82F6)', borderRadius: 5 }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status breakdown */}
                <div className="card">
                  <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Status Breakdown</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {Object.entries(statusCounts).map(([status, count]) => {
                      const sc = STATUS_CONFIG[status] || STATUS_CONFIG.pending
                      return (
                        <div key={status} onClick={() => setStatusFilter(status)} style={{ background: sc.bg, borderRadius: 10, padding: '12px 8px', textAlign: 'center', cursor: 'pointer', border: '1px solid ' + sc.color + '33' }}>
                          <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: sc.color }}>{count}</div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: sc.color, textTransform: 'capitalize', marginTop: 4 }}>{status}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Specialist Performance */}
              <div className="card">
                <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Specialist Performance</div>
                {specPerf.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No specialist data</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['Specialist','Total','Completed','Pending','Completion Rate','Revenue'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {specPerf.map((s, i) => {
                          const cvr = s.total > 0 ? Math.round(s.completed / s.total * 100) : 0
                          return (
                            <tr key={i} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background=''}>
                              <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{s.name}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--blue)' }}>{s.total}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--green)' }}>{s.completed}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--orange)' }}>{s.pending}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: cvr + '%', background: cvr >= 70 ? 'var(--green)' : cvr >= 40 ? 'var(--gold)' : 'var(--red)', borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: 11, fontFamily: 'DM Mono', fontWeight: 700, color: cvr >= 70 ? 'var(--green)' : cvr >= 40 ? 'var(--gold)' : 'var(--red)', minWidth: 35 }}>{cvr}%</span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--gold)' }}>₹{(s.completed * 30).toLocaleString('en-IN')}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelected(null)}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800 }}>{selected.name || selected.fullName}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 3 }}>#{selected.consultationNumber || selected._id?.slice(-8)}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Phone', value: selected.phone || '—' },
                { label: 'Email', value: selected.email || '—' },
                { label: 'Status', value: selected.status || 'pending' },
                { label: 'Specialist', value: getSpecName(selected.assignedSpecialist) || 'Unassigned' },
                { label: 'Scheduled', value: selected.scheduledDate ? new Date(selected.scheduledDate).toLocaleDateString('en-IN') : '—' },
                { label: 'Time', value: selected.scheduledTime || '—' },
                { label: 'Source', value: selected.source || 'Website' },
                { label: 'Created', value: selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('en-IN') : '—' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 12px' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {selected.concern && (
              <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 4 }}>Concern</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{selected.concern}</div>
              </div>
            )}

            {/* Assign specialist */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Assign Specialist</label>
              <select value={selected.assignedSpecialist || ''} onChange={e => assignSpecialist(selected._id, e.target.value)} disabled={assigning}
                style={{ width: '100%', background: selected.assignedSpecialist ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)', border: '1px solid ' + (selected.assignedSpecialist ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'), borderRadius: 8, padding: '9px 12px', color: selected.assignedSpecialist ? 'var(--green)' : 'var(--orange)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Unassigned —</option>
                {specialists.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>

            {/* Update status */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Update Status</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.keys(STATUS_CONFIG).map(s => (
                  <button key={s} onClick={() => updateStatus(selected._id, s)} style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid ' + (selected.status === s ? STATUS_CONFIG[s].color + '55' : 'var(--b1)'), cursor: 'pointer', fontSize: 10.5, fontWeight: 600, fontFamily: 'Outfit', textTransform: 'capitalize', background: selected.status === s ? STATUS_CONFIG[s].bg : 'transparent', color: selected.status === s ? STATUS_CONFIG[s].color : 'var(--mu2)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {selected.phone && (
                <>
                  <a href={'tel:' + selected.phone.replace(/[^0-9+]/g,'')} style={{ flex: 1, padding: 10, background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: 'var(--blue)', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>📞 Call</a>
                  <a href={'https://wa.me/' + selected.phone.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent('Hi ' + selected.name + '! Rabt Naturals consultation ke baare mein baat karni thi 🌿')} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#25D366,#128C7E)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>💬 WhatsApp</a>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
