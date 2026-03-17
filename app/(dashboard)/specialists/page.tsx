'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function SpecialistsPage() {
  const [specialists, setSpecialists] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'cards'|'analytics'|'payouts'>('cards')
  const [selected, setSelected] = useState<any>(null)
  const [createLoginModal, setCreateLoginModal] = useState<any>(null)
  const [createdCreds, setCreatedCreds] = useState<any>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [hqProfiles, setHqProfiles] = useState<any[]>([])
  const [approvingId, setApprovingId] = useState<string|null>(null)

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: profilesData } = await supabase.from('profiles').select('*').eq('role', 'specialist')
      setHqProfiles(profilesData || [])
      const url = localStorage.getItem('rabt_mongo_url')
      if (!url) { setLoading(false); return }
      const [specRes, consRes, sessRes, payRes, ordRes] = await Promise.all([
        fetch(url + '/api/specialists').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/consultations').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/sessions').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/payouts').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/orders').then(r => r.ok ? r.json() : []),
      ])
      setSpecialists(Array.isArray(specRes) ? specRes : [])
      setConsultations(Array.isArray(consRes) ? consRes : [])
      setSessions(Array.isArray(sessRes) ? sessRes : [])
      setPayouts(Array.isArray(payRes) ? payRes : [])
      setOrders(Array.isArray(ordRes) ? ordRes : [])
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  async function createSpecialistLogin(spec: any) {
    setCreateLoading(true)
    try {
      const res = await fetch('/api/create-specialist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: spec.name, email: spec.email, phone: spec.phone, specialistId: spec._id }) })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setCreateLoading(false); return }
      setCreatedCreds(data.credentials)
      setCreateLoginModal(null)
      toast.success(data.alreadyExisted ? 'Password reset!' : 'Login created!')
    } catch { toast.error('Failed') }
    setCreateLoading(false)
  }

  async function approvePayout(payoutId: string, action: 'approve'|'reject') {
    const url = localStorage.getItem('rabt_mongo_url')
    if (!url) return
    setApprovingId(payoutId)
    try {
      const res = await fetch(url + '/api/payouts/' + payoutId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action === 'approve' ? 'completed' : 'rejected' })
      })
      if (res.ok) {
        toast.success(action === 'approve' ? 'Payout approved!' : 'Payout rejected!')
        setPayouts(prev => prev.map(p => p._id === payoutId ? { ...p, status: action === 'approve' ? 'completed' : 'rejected' } : p))
      } else toast.error('Failed')
    } catch { toast.error('Error') }
    setApprovingId(null)
  }

  function hasHQLogin(spec: any) { return hqProfiles.some(p => p.hq_specialist_mongo_id === spec._id || p.email === spec.email) }

  function getSpecStats(spec: any) {
    const id = spec._id?.toString()
    const specCons = consultations.filter(c => c.assignedSpecialist?.toString() === id)
    const specOrders = orders.filter(o => o.specialistId?.toString() === id || o.source === 'specialist_offline' && o.specialistId?.toString() === id)
    const specPayouts = payouts.filter(p => p.specialistId?.toString() === id)
    const completedCons = specCons.filter(c => c.status === 'completed').length
    const commissionEarned = specOrders.filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'delivered').reduce((s, o) => s + Math.round((o.amount || 0) * 0.12), 0)
    const consultationEarnings = completedCons * 30
    const totalEarnings = commissionEarned + consultationEarnings
    const pendingPayout = specPayouts.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0)
    const paidOut = specPayouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0)
    return { consultations: specCons.length, completedCons, orders: specOrders.length, commissionEarned, consultationEarnings, totalEarnings, pendingPayout, paidOut }
  }

  const filtered = specialists.filter(s => {
    if (filter === 'active' && !s.isActive) return false
    if (filter === 'inactive' && s.isActive) return false
    if (search && !s.name?.toLowerCase().includes(search.toLowerCase()) && !s.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const activeCount = specialists.filter(s => s.isActive).length
  const pendingPayouts = payouts.filter(p => p.status === 'pending')
  const pendingAmount = pendingPayouts.reduce((s, p) => s + (p.amount || 0), 0)
  const totalCalcEarnings = specialists.reduce((sum, s) => sum + getSpecStats(s).totalEarnings, 0)

  // Analytics
  const specPerf = specialists.map(s => ({ ...s, stats: getSpecStats(s) })).sort((a,b) => b.stats.consultations - a.stats.consultations)
  const maxCons = Math.max(...specPerf.map(s => s.stats.consultations), 1)

  const inp: any = { background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none' }

  if (!mounted) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Specialist <span style={{ color: 'var(--gold)' }}>Management</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{specialists.length} total · {activeCount} active{pendingPayouts.length > 0 && <span style={{ color: 'var(--orange)' }}> · {pendingPayouts.length} payout requests</span>}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{id:'cards',l:'Specialists'},{id:'analytics',l:'📊 Analytics'},{id:'payouts',l:`💰 Payouts${pendingPayouts.length > 0 ? ` (${pendingPayouts.length})` : ''}`}].map(v => (
            <button key={v.id} onClick={() => setView(v.id as any)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: view === v.id ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: view === v.id ? 'var(--gold)' : (v.id === 'payouts' && pendingPayouts.length > 0 ? 'var(--orange)' : 'var(--mu2)'), border: '1px solid ' + (view === v.id ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
              {v.l}
            </button>
          ))}
          <button onClick={loadAll} style={{ padding: '8px 14px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Specialists', value: specialists.length, color: 'var(--blue)' },
          { label: 'Active', value: activeCount, color: 'var(--green)' },
          { label: 'Total Consultations', value: consultations.length, color: 'var(--teal)' },
          { label: 'Total Earnings', value: '₹' + totalCalcEarnings.toLocaleString('en-IN'), color: 'var(--gold)' },
          { label: 'Pending Payouts', value: '₹' + pendingAmount.toLocaleString('en-IN'), color: 'var(--orange)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* PAYOUTS VIEW */}
      {view === 'payouts' && (
        <div>
          {pendingPayouts.length > 0 && (
            <div style={{ background: 'var(--orL)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--orange)' }}>⚠️ <strong>{pendingPayouts.length} payout requests</strong> pending approval · Total ₹{pendingAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Specialist','Amount','UPI ID','Requested','Status','Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {payouts.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No payout requests yet</td></tr>}
                {payouts.map((p, i) => {
                  const spec = specialists.find(s => s._id?.toString() === p.specialistId?.toString())
                  return (
                    <tr key={i} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.018)'} onMouseOut={e => e.currentTarget.style.background=''}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{spec?.name || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>₹{p.amount}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--mu)' }}>{p.upiId || '—'}<div style={{ fontSize: 10, color: 'var(--mu)' }}>{p.upiName}</div></td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--mu)' }}>{p.requestedAt ? new Date(p.requestedAt).toLocaleDateString('en-IN') : new Date(p.createdAt || Date.now()).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700, background: p.status === 'completed' ? 'var(--grL)' : p.status === 'rejected' ? 'var(--rdL)' : 'var(--orL)', color: p.status === 'completed' ? 'var(--green)' : p.status === 'rejected' ? 'var(--red)' : 'var(--orange)' }}>
                          {p.status || 'pending'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {p.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => approvePayout(p._id, 'approve')} disabled={approvingId === p._id} style={{ padding: '5px 12px', background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, color: 'var(--green)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                              ✓ Approve
                            </button>
                            <button onClick={() => approvePayout(p._id, 'reject')} disabled={approvingId === p._id} style={{ padding: '5px 10px', background: 'var(--rdL)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--red)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                              ✕
                            </button>
                          </div>
                        )}
                        {p.status !== 'pending' && <span style={{ fontSize: 11, color: 'var(--mu)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS VIEW */}
      {view === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Specialist Performance */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Consultation Performance</div>
              {specPerf.map((s, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span style={{ fontFamily: 'DM Mono', color: 'var(--teal)' }}>{s.stats.consultations} cons · {s.stats.completedCons} done</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: Math.round(s.stats.completedCons / maxCons * 100) + '%', background: 'var(--green)' }} />
                    <div style={{ height: '100%', width: Math.round((s.stats.consultations - s.stats.completedCons) / maxCons * 100) + '%', background: 'var(--blue)' }} />
                  </div>
                </div>
              ))}
              {specPerf.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No data</div>}
            </div>

            {/* Earnings Breakdown */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Earnings Breakdown</div>
              {specPerf.filter(s => s.stats.totalEarnings > 0).map((s, i) => {
                const maxEarn = Math.max(...specPerf.map(x => x.stats.totalEarnings), 1)
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ fontFamily: 'DM Mono', color: 'var(--gold)' }}>₹{s.stats.totalEarnings.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ height: '100%', width: Math.round(s.stats.consultationEarnings / maxEarn * 100) + '%', background: 'var(--teal)' }} />
                      <div style={{ height: '100%', width: Math.round(s.stats.commissionEarned / maxEarn * 100) + '%', background: 'var(--gold)' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                      <span style={{ fontSize: 9.5, color: 'var(--teal)' }}>🟢 Consultation ₹{s.stats.consultationEarnings}</span>
                      <span style={{ fontSize: 9.5, color: 'var(--gold)' }}>🟡 Commission ₹{s.stats.commissionEarned}</span>
                    </div>
                  </div>
                )
              })}
              {specPerf.filter(s => s.stats.totalEarnings > 0).length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No earnings yet</div>}
            </div>
          </div>

          {/* Full Performance Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Full Performance Table</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Specialist','Status','Consultations','Completed','Orders','Consultation Earnings','Commission','Total','Pending Payout'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {specPerf.map((s, i) => (
                  <tr key={i} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.018)'} onMouseOut={e => e.currentTarget.style.background=''}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>
                      <div>{s.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--mu)' }}>{s.email}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: s.isActive ? 'var(--grL)' : 'var(--rdL)', color: s.isActive ? 'var(--green)' : 'var(--red)' }}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--blue)' }}>{s.stats.consultations}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--green)' }}>{s.stats.completedCons}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--purple)' }}>{s.stats.orders}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--teal)' }}>₹{s.stats.consultationEarnings}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--gold)' }}>₹{s.stats.commissionEarned}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--gold)', fontSize: 13 }}>₹{s.stats.totalEarnings.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: s.stats.pendingPayout > 0 ? 'var(--orange)' : 'var(--mu)' }}>
                      {s.stats.pendingPayout > 0 ? '₹' + s.stats.pendingPayout : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARDS VIEW */}
      {view === 'cards' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..." style={{ ...inp, width: 240 }} />
            {['all','active','inactive'].map(f => (
              <span key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, background: filter === f ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: filter === f ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (filter === f ? 'rgba(212,168,83,0.3)' : 'var(--b1)'), textTransform: 'capitalize' }}>
                {f}
              </span>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : 'repeat(3,1fr)', gap: 14, alignItems: 'start' }}>
              <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr' : 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                {filtered.map((spec, i) => {
                  const stats = getSpecStats(spec)
                  const isSelected = selected?._id === spec._id
                  return (
                    <div key={i} onClick={() => setSelected(isSelected ? null : spec)} style={{ background: 'var(--s1)', border: '1px solid ' + (isSelected ? 'var(--gold)' : 'var(--b1)'), borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        {spec.profilePhoto ? <img src={spec.profilePhoto} alt={spec.name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} /> : (
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#D4A853,#B87C30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: '#08090C', flexShrink: 0 }}>{spec.name?.charAt(0)}</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Syne', fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spec.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spec.email}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: spec.isActive ? 'var(--grL)' : 'var(--rdL)', color: spec.isActive ? 'var(--green)' : 'var(--red)' }}>{spec.isActive ? 'Active' : 'Inactive'}</span>
                          {hasHQLogin(spec) && <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: 'var(--blL)', color: 'var(--blue)' }}>HQ ✓</span>}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(80px,1fr))', gap: 6, marginBottom: 12 }}>
                        {[
                          { label: 'Cons.', value: stats.consultations },
                          { label: 'Done', value: stats.completedCons },
                          { label: 'Orders', value: stats.orders },
                          { label: 'Comm.', value: (spec.commissionPercentage || 12) + '%' },
                        ].map((stat, si) => (
                          <div key={si} style={{ background: 'var(--s2)', borderRadius: 7, padding: '7px 8px', textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{stat.value}</div>
                            <div style={{ fontSize: 9, color: 'var(--mu)', marginTop: 2 }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                        <span style={{ color: 'var(--mu2)' }}>Earned: <strong style={{ color: 'var(--green)' }}>₹{stats.totalEarnings.toLocaleString('en-IN')}</strong></span>
                        {stats.pendingPayout > 0 && <span style={{ color: 'var(--orange)' }}>Pending: ₹{stats.pendingPayout}</span>}
                      </div>
                    </div>
                  )
                })}
                {filtered.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--mu)', background: 'var(--s1)', borderRadius: 12 }}>No specialists found</div>}
              </div>

              {selected && (
                <div style={{ position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>{selected.name}</div>
                    <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, background: 'var(--s2)', borderRadius: 12, padding: 14 }}>
                    {selected.profilePhoto ? <img src={selected.profilePhoto} alt={selected.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} /> : (
                      <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg,#D4A853,#B87C30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: '#08090C' }}>{selected.name?.charAt(0)}</div>
                    )}
                    <div>
                      <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>{selected.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 2 }}>{selected.email}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--mu)' }}>{selected.phone}</div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: selected.isActive ? 'var(--grL)' : 'var(--rdL)', color: selected.isActive ? 'var(--green)' : 'var(--red)', display: 'inline-block', marginTop: 5 }}>{selected.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>

                  {(() => {
                    const stats = getSpecStats(selected)
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                        {[
                          { label: 'Consultations', value: stats.consultations, color: 'var(--blue)' },
                          { label: 'Completed', value: stats.completedCons, color: 'var(--green)' },
                          { label: 'Orders', value: stats.orders, color: 'var(--purple)' },
                          { label: 'Commission %', value: (selected.commissionPercentage || 12) + '%', color: 'var(--teal)' },
                          { label: 'Consult Earnings', value: '₹' + stats.consultationEarnings, color: 'var(--teal)' },
                          { label: 'Commission Earned', value: '₹' + stats.commissionEarned, color: 'var(--gold)' },
                          { label: 'Total Earnings', value: '₹' + stats.totalEarnings.toLocaleString('en-IN'), color: 'var(--gold)' },
                          { label: 'Pending Payout', value: stats.pendingPayout > 0 ? '₹' + stats.pendingPayout : '—', color: 'var(--orange)' },
                        ].map((item, i) => (
                          <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: item.color, fontFamily: 'Syne' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Payout history */}
                  {payouts.filter(p => p.specialistId?.toString() === selected._id?.toString()).length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>Payout History</div>
                      {payouts.filter(p => p.specialistId?.toString() === selected._id?.toString()).map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>₹{p.amount}</div>
                            <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>{p.upiId} · {new Date(p.requestedAt || p.createdAt || Date.now()).toLocaleDateString('en-IN')}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: p.status === 'completed' ? 'var(--grL)' : p.status === 'rejected' ? 'var(--rdL)' : 'var(--orL)', color: p.status === 'completed' ? 'var(--green)' : p.status === 'rejected' ? 'var(--red)' : 'var(--orange)' }}>{p.status || 'pending'}</span>
                            {p.status === 'pending' && (
                              <button onClick={() => approvePayout(p._id, 'approve')} style={{ padding: '3px 8px', background: 'var(--grL)', border: 'none', borderRadius: 5, color: 'var(--green)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent Consultations */}
                  {consultations.filter(c => c.assignedSpecialist?.toString() === selected._id?.toString()).slice(0, 5).length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>Recent Consultations</div>
                      {consultations.filter(c => c.assignedSpecialist?.toString() === selected._id?.toString()).slice(0, 5).map((c, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--b1)' }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: c.status === 'completed' ? 'var(--grL)' : 'var(--blL)', color: c.status === 'completed' ? 'var(--green)' : 'var(--blue)', textTransform: 'capitalize' }}>{c.status}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.phone && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={'tel:' + selected.phone.replace(/[^0-9+]/g,'')} style={{ flex: 1, padding: 9, background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, textDecoration: 'none', textAlign: 'center' }}>📞 Call</a>
                        <a href={'https://wa.me/' + selected.phone.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent('Hi ' + selected.name + ', Rabt Naturals HQ se 👋')} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: 9, background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 12.5, textDecoration: 'none', textAlign: 'center' }}>💬 WhatsApp</a>
                      </div>
                    )}
                    <button onClick={() => setCreateLoginModal(selected)} style={{ width: '100%', padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
                      Create / Reset HQ Login
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {createLoginModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '28px 32px', width: 400, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Create / Reset Login</div>
            <div style={{ fontSize: 13, color: 'var(--mu2)', marginBottom: 20 }}><strong>{createLoginModal.name}</strong> ke liye login create ya reset karna chahte ho?</div>
            <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{createLoginModal.email}</div>
              <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 10, marginBottom: 4 }}>Password</div>
              <div style={{ fontSize: 13, color: 'var(--teal)' }}>Auto-generated (Rabt@XXXXXX)</div>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setCreateLoginModal(null)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={() => createSpecialistLogin(createLoginModal)} disabled={createLoading} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                {createLoading ? 'Creating...' : 'Create Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createdCreds && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '28px 32px', width: 420, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 6, color: 'var(--green)' }}>✅ Login Created!</div>
            <div style={{ fontSize: 12.5, color: 'var(--mu)', marginBottom: 20 }}>Specialist ko share karo:</div>
            <div style={{ background: 'var(--s2)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Email</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'DM Mono', color: 'var(--teal)' }}>{createdCreds.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Password</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'DM Mono', color: 'var(--gold)', letterSpacing: 2 }}>{createdCreds.password}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
              <button onClick={() => { navigator.clipboard.writeText('Email: ' + createdCreds.email + '\nPassword: ' + createdCreds.password); toast.success('Copied!') }} style={{ flex: 1, padding: 10, background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Copy</button>
              <button onClick={() => { window.open('https://wa.me/?text=' + encodeURIComponent('Rabt HQ Login\nEmail: ' + createdCreds.email + '\nPassword: ' + createdCreds.password), '_blank') }} style={{ flex: 1, padding: 10, background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>WhatsApp</button>
            </div>
            <button onClick={() => setCreatedCreds(null)} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}