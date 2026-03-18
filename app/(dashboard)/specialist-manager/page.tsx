'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--orange)', accepted: 'var(--teal)', scheduled: 'var(--blue)',
  completed: 'var(--green)', cancelled: 'var(--red)', in_progress: 'var(--purple)',
}
const STATUS_BG: Record<string, string> = {
  pending: 'var(--orL)', accepted: 'rgba(20,184,166,0.15)', scheduled: 'var(--blL)',
  completed: 'var(--grL)', cancelled: 'var(--rdL)', in_progress: 'rgba(139,92,246,0.15)',
}

export default function SpecialistManagerPage() {
  const [specialists, setSpecialists] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [hqProfiles, setHqProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'overview'|'specialists'|'consultations'|'payouts'|'performance'>('overview')
  const [selectedSpec, setSelectedSpec] = useState<any>(null)
  const [assignModal, setAssignModal] = useState<any>(null)
  const [assignSpecId, setAssignSpecId] = useState('')
  const [payoutAction, setPayoutAction] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [consFilter, setConsFilter] = useState('all')

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: profilesData } = await supabase.from('profiles').select('*').eq('role', 'specialist')
      setHqProfiles(profilesData || [])
      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
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

  async function assignConsultation(consId: string, specId: string) {
    const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
    if (!url) return
    try {
      const res = await fetch(url + '/api/consultations/' + consId, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedSpecialist: specId, status: 'accepted' })
      })
      if (res.ok) { toast.success('Consultation assigned!'); setAssignModal(null); loadAll() }
      else toast.error('Assignment failed')
    } catch { toast.error('Error') }
  }

  async function updatePayoutStatus(id: string, status: 'completed' | 'rejected') {
    const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
    if (!url) return
    try {
      const res = await fetch(url + '/api/payouts/' + id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (res.ok) { toast.success(status === 'completed' ? 'Payout approved!' : 'Payout rejected!'); setPayoutAction(null); loadAll() }
      else toast.error('Update failed')
    } catch { toast.error('Error') }
  }

  function getSpecData(spec: any) {
    const specCons = consultations.filter(c => c.assignedSpecialist === spec._id)
    const specPayouts = payouts.filter(p => p.specialistId === spec._id)
    const specOrders = orders.filter(o => o.specialistId === spec._id || specCons.some(c => c.userId === (o.userId || o.user)))
    const hasHQLogin = hqProfiles.some(p => p.hq_specialist_mongo_id === spec._id || p.email === spec.email)
    const pendingPayout = specPayouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
    const consultationEarnings = specCons.filter(c => c.status === 'completed').length * 30
    const commissionEarned = specOrders.filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'delivered').reduce((s, o) => s + (o.amount || 0) * 0.12, 0)
    return { specCons, specPayouts, specOrders, hasHQLogin, pendingPayout, consultationEarnings, commissionEarned }
  }

  const pendingCons = consultations.filter(c => c.status === 'pending')
  const pendingPayouts = payouts.filter(p => p.status === 'pending')
  const pendingPayoutAmount = pendingPayouts.reduce((s, p) => s + p.amount, 0)
  const totalSpecialistRevenue = orders.filter(o => o.source === 'specialist_offline').reduce((s, o) => s + (o.amount || 0), 0)

  const filteredCons = consultations.filter(c => {
    if (consFilter !== 'all' && c.status !== consFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!(c.name || '').toLowerCase().includes(s)) return false
    }
    return true
  })

  const inp: any = { background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'Outfit', outline: 'none' }

  if (!mounted) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Specialist <span style={{ color: 'var(--gold)' }}>Manager</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {specialists.length} specialists · {pendingCons.length} pending · {pendingPayouts.length} payouts pending
          </p>
        </div>
        <button onClick={loadAll} style={{ padding: '8px 16px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Refresh</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Specialists', value: specialists.length, color: 'var(--blue)' },
          { label: 'Active', value: specialists.filter(s => s.isActive).length, color: 'var(--green)' },
          { label: 'Pending Consultations', value: pendingCons.length, color: 'var(--orange)' },
          { label: 'Pending Payouts', value: 'Rs.' + pendingPayoutAmount.toLocaleString('en-IN'), color: 'var(--gold)' },
          { label: 'Specialist Revenue', value: 'Rs.' + totalSpecialistRevenue.toLocaleString('en-IN'), color: 'var(--teal)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--s2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'specialists', label: `Specialists (${specialists.length})` },
          { id: 'consultations', label: `Consultations (${consultations.length})` },
          { id: 'payouts', label: `Payouts (${pendingPayouts.length} pending)` },
          { id: 'performance', label: 'Performance' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '8px 14px', background: tab === t.id ? 'var(--s1)' : 'transparent', border: 'none', borderRadius: 8, color: tab === t.id ? 'var(--gold)' : 'var(--mu)', fontWeight: tab === t.id ? 700 : 500, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Pending Consultations */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Unassigned Consultations</div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--orL)', color: 'var(--orange)', fontWeight: 700 }}>{pendingCons.filter(c => !c.assignedSpecialist).length}</span>
                </div>
                {pendingCons.filter(c => !c.assignedSpecialist).slice(0, 5).map((c, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--b1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{c.concern} · Age {c.age}</div>
                      </div>
                      <button onClick={() => setAssignModal(c)} style={{ padding: '4px 10px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 6, color: '#08090C', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>
                        Assign
                      </button>
                    </div>
                  </div>
                ))}
                {pendingCons.filter(c => !c.assignedSpecialist).length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20, fontSize: 12 }}>All consultations assigned! 🎉</div>
                )}
              </div>

              {/* Pending Payouts */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Pending Payouts</div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--orL)', color: 'var(--orange)', fontWeight: 700 }}>Rs.{pendingPayoutAmount.toLocaleString('en-IN')}</span>
                </div>
                {pendingPayouts.slice(0, 4).map((p, i) => {
                  const spec = specialists.find(s => s._id === p.specialistId)
                  return (
                    <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{spec?.name || 'Specialist'}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)' }}>{p.upiId} · {new Date(p.createdAt).toLocaleDateString('en-IN')}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: 'var(--orange)' }}>Rs.{p.amount}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setPayoutAction({ payout: p, action: 'completed', spec })} style={{ padding: '3px 8px', background: 'var(--grL)', border: 'none', borderRadius: 5, color: 'var(--green)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>✓</button>
                          <button onClick={() => setPayoutAction({ payout: p, action: 'rejected', spec })} style={{ padding: '3px 8px', background: 'var(--rdL)', border: 'none', borderRadius: 5, color: 'var(--red)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>✕</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {pendingPayouts.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20, fontSize: 12 }}>No pending payouts 🎉</div>}
              </div>

              {/* Specialist Quick View */}
              <div className="card" style={{ gridColumn: '1/-1', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Specialist Performance Overview</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Specialist','Status','Consultations','Sessions','HQ Login','Earnings','Commission','Pending Payout','Action'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {specialists.map((spec, i) => {
                      const d = getSpecData(spec)
                      return (
                        <tr key={i} onMouseOver={e => (e.currentTarget.style.background='rgba(255,255,255,0.018)')} onMouseOut={e => (e.currentTarget.style.background='')}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {spec.profilePhoto ? <img src={spec.profilePhoto} style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--gL)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--gold)' }}>{spec.name.charAt(0)}</div>}
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{spec.name}</div>
                                <div style={{ fontSize: 10.5, color: 'var(--mu)' }}>{spec.phone}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: spec.isActive ? 'var(--grL)' : 'var(--rdL)', color: spec.isActive ? 'var(--green)' : 'var(--red)' }}>
                              {spec.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 600 }}>{d.specCons.length}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--mu)' }}>{spec.completedSessions || 0}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: d.hasHQLogin ? 'var(--blL)' : 'rgba(255,255,255,0.05)', color: d.hasHQLogin ? 'var(--blue)' : 'var(--mu)' }}>
                              {d.hasHQLogin ? 'HQ ✓' : 'No Login'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>Rs.{d.consultationEarnings}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--teal)', fontWeight: 700 }}>Rs.{Math.round(d.commissionEarned)}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontSize: 12, color: d.pendingPayout > 0 ? 'var(--orange)' : 'var(--mu)', fontWeight: 700 }}>Rs.{d.pendingPayout}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => setSelectedSpec(selectedSpec?._id === spec._id ? null : spec)} style={{ padding: '4px 10px', background: 'var(--gL)', border: 'none', borderRadius: 6, color: 'var(--gold)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit' }}>View</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SPECIALISTS TAB */}
          {tab === 'specialists' && (
            <div style={{ display: 'grid', gridTemplateColumns: selectedSpec ? '1fr 360px' : 'repeat(3,1fr)', gap: 14, alignItems: 'start' }}>
              <div style={{ display: 'grid', gridTemplateColumns: selectedSpec ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
                {specialists.map((spec, i) => {
                  const d = getSpecData(spec)
                  return (
                    <div key={i} onClick={() => setSelectedSpec(selectedSpec?._id === spec._id ? null : spec)}
                      style={{ background: 'var(--s1)', border: '1px solid ' + (selectedSpec?._id === spec._id ? 'var(--gold)' : 'var(--b1)'), borderRadius: 14, padding: 16, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        {spec.profilePhoto ? <img src={spec.profilePhoto} style={{ width: 44, height: 44, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} /> :
                          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#D4A853,#B87C30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: '#08090C', flexShrink: 0 }}>{spec.name.charAt(0)}</div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spec.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spec.email}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700, background: spec.isActive ? 'var(--grL)' : 'var(--rdL)', color: spec.isActive ? 'var(--green)' : 'var(--red)' }}>{spec.isActive ? 'Active' : 'Inactive'}</span>
                          {d.hasHQLogin && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700, background: 'var(--blL)', color: 'var(--blue)' }}>HQ ✓</span>}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                        {[
                          { l: 'Patients', v: spec.totalPatients || 0 },
                          { l: 'Sessions', v: spec.completedSessions || 0 },
                          { l: 'Commission', v: (spec.commissionPercentage || 0) + '%' },
                        ].map((s, si) => (
                          <div key={si} style={{ background: 'var(--s2)', borderRadius: 7, padding: '7px', textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{s.v}</div>
                            <div style={{ fontSize: 9, color: 'var(--mu)', marginTop: 1 }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ color: 'var(--green)' }}>Earned: Rs.{(spec.totalEarnings || 0).toLocaleString('en-IN')}</span>
                        {d.pendingPayout > 0 && <span style={{ color: 'var(--orange)' }}>Pending: Rs.{d.pendingPayout}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Specialist Detail Panel */}
              {selectedSpec && (() => {
                const d = getSpecData(selectedSpec)
                return (
                  <div style={{ position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>{selectedSpec.name}</div>
                      <button onClick={() => setSelectedSpec(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>x</button>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, background: 'var(--s2)', borderRadius: 10, padding: 12 }}>
                      {selectedSpec.profilePhoto ? <img src={selectedSpec.profilePhoto} style={{ width: 56, height: 56, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} /> :
                        <div style={{ width: 56, height: 56, borderRadius: 11, background: 'linear-gradient(135deg,#D4A853,#B87C30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: '#08090C' }}>{selectedSpec.name.charAt(0)}</div>}
                      <div>
                        <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>{selectedSpec.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)' }}>{selectedSpec.email}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)' }}>{selectedSpec.phone}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                      {[
                        { l: 'Consultations', v: d.specCons.length, c: 'var(--blue)' },
                        { l: 'Completed', v: d.specCons.filter(c => c.status === 'completed').length, c: 'var(--green)' },
                        { l: 'Consultation Fee', v: 'Rs.' + d.consultationEarnings, c: 'var(--teal)' },
                        { l: 'Commission', v: 'Rs.' + Math.round(d.commissionEarned), c: 'var(--gold)' },
                        { l: 'Pending Payout', v: 'Rs.' + d.pendingPayout, c: 'var(--orange)' },
                        { l: 'Commission %', v: (selectedSpec.commissionPercentage || 0) + '%', c: 'var(--purple)' },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 11px' }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>{item.l}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: item.c, fontFamily: 'Syne' }}>{item.v}</div>
                        </div>
                      ))}
                    </div>
                    {d.specCons.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>Recent Consultations</div>
                        {d.specCons.slice(0, 4).map((c, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--b1)' }}>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: STATUS_BG[c.status] || 'rgba(255,255,255,0.05)', color: STATUS_COLORS[c.status] || 'var(--mu)', textTransform: 'capitalize' }}>{c.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {d.specPayouts.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>Payout History</div>
                        {d.specPayouts.map((p, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--b1)' }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>Rs.{p.amount}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--mu)' }}>{p.upiId}</div>
                            </div>
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: p.status === 'completed' ? 'var(--grL)' : p.status === 'rejected' ? 'var(--rdL)' : 'var(--orL)', color: p.status === 'completed' ? 'var(--green)' : p.status === 'rejected' ? 'var(--red)' : 'var(--orange)', textTransform: 'capitalize', alignSelf: 'center' }}>{p.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedSpec.phone && (
                        <a href={'https://wa.me/' + selectedSpec.phone.replace(/[^0-9]/g,'')} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                          WhatsApp
                        </a>
                      )}
                      {d.pendingPayout > 0 && (
                        <button onClick={() => setPayoutAction({ payout: d.specPayouts.find(p => p.status === 'pending'), action: 'completed', spec: selectedSpec })}
                          style={{ padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
                          Approve Payout Rs.{d.pendingPayout}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* CONSULTATIONS TAB */}
          {tab === 'consultations' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient..." style={{ ...inp, width: 200 }} />
                {['all','pending','accepted','scheduled','in_progress','completed','cancelled'].map(s => (
                  <span key={s} onClick={() => setConsFilter(s)} style={{ padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: consFilter === s ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: consFilter === s ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (consFilter === s ? 'rgba(212,168,83,0.3)' : 'var(--b1)'), textTransform: 'capitalize' }}>
                    {s.replace('_',' ')}
                  </span>
                ))}
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Patient','Age','Concern','Scheduled','Assigned To','Status','Images','Action'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {filteredCons.map((c, i) => {
                      const assignedSpec = specialists.find(s => s._id === c.assignedSpecialist)
                      return (
                        <tr key={i} onMouseOver={e => (e.currentTarget.style.background='rgba(255,255,255,0.018)')} onMouseOut={e => (e.currentTarget.style.background='')}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--mu)' }}>{c.consultationNumber?.slice(-8)}</div>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--mu)' }}>{c.age || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--mu2)', maxWidth: 150 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.concern || '—'}</div>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>
                            {c.scheduledDate ? new Date(c.scheduledDate).toLocaleDateString('en-IN') : '—'} {c.scheduledTime}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {assignedSpec ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 500 }}>{assignedSpec.name}</span>
                                <button onClick={() => setAssignModal(c)} style={{ fontSize: 9, padding: '1px 5px', background: 'var(--gL)', border: 'none', borderRadius: 4, color: 'var(--gold)', cursor: 'pointer' }}>Re-assign</button>
                              </div>
                            ) : (
                              <button onClick={() => setAssignModal(c)} style={{ padding: '4px 10px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 6, color: '#08090C', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>Assign</button>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: STATUS_BG[c.status] || 'rgba(255,255,255,0.05)', color: STATUS_COLORS[c.status] || 'var(--mu)', textTransform: 'capitalize' }}>
                              {c.status?.replace('_',' ')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {c.images?.length > 0 ? (
                              <div style={{ display: 'flex', gap: 3 }}>
                                {c.images.slice(0,2).map((img: any, ii: number) => (
                                  <img key={ii} src={img.url} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'cover' }} />
                                ))}
                                {c.images.length > 2 && <span style={{ fontSize: 10, color: 'var(--mu)', alignSelf: 'center' }}>+{c.images.length-2}</span>}
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {c.userId && (
                              <button onClick={() => { const u = c.userId?.toString().replace(/[^0-9a-f]/gi,''); window.open('https://wa.me/?text=Consultation+reminder', '_blank') }}
                                style={{ padding: '4px 8px', background: 'var(--grL)', border: 'none', borderRadius: 6, color: 'var(--green)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>WA</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredCons.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No consultations found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAYOUTS TAB */}
          {tab === 'payouts' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Pending Requests', value: pendingPayouts.length, sub: 'Rs.' + pendingPayoutAmount.toLocaleString('en-IN'), color: 'var(--orange)' },
                  { label: 'Approved', value: payouts.filter(p => p.status === 'completed').length, sub: 'Rs.' + payouts.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN'), color: 'var(--green)' },
                  { label: 'Rejected', value: payouts.filter(p => p.status === 'rejected').length, sub: '', color: 'var(--red)' },
                ].map((s, i) => (
                  <div key={i} className="card">
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
                    {s.sub && <div style={{ fontSize: 12, color: 'var(--mu)' }}>{s.sub}</div>}
                  </div>
                ))}
              </div>
              {pendingPayouts.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Pending Requests</div>
                  {pendingPayouts.map((p, i) => {
                    const spec = specialists.find(s => s._id === p.specialistId)
                    return (
                      <div key={i} style={{ background: 'var(--s1)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 12, padding: '16px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--orL)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💸</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{spec?.name || 'Specialist'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 2 }}>UPI: <span style={{ color: 'var(--teal)' }}>{p.upiId}</span> · {p.upiName}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{new Date(p.requestedAt).toLocaleDateString('en-IN')} · #{p.payoutNumber?.slice(-8)}</div>
                        </div>
                        <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: 'var(--orange)', marginRight: 16 }}>Rs.{p.amount.toLocaleString('en-IN')}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setPayoutAction({ payout: p, action: 'completed', spec })} style={{ padding: '8px 16px', background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Approve</button>
                          <button onClick={() => setPayoutAction({ payout: p, action: 'rejected', spec })} style={{ padding: '8px 16px', background: 'var(--rdL)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--red)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Reject</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase' }}>All Payouts</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Specialist','Amount','UPI','Status','Date'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {payouts.map((p, i) => {
                      const spec = specialists.find(s => s._id === p.specialistId)
                      const sColor = p.status === 'completed' ? 'var(--green)' : p.status === 'rejected' ? 'var(--red)' : 'var(--orange)'
                      const sBg = p.status === 'completed' ? 'var(--grL)' : p.status === 'rejected' ? 'var(--rdL)' : 'var(--orL)'
                      return (
                        <tr key={i} onMouseOver={e => (e.currentTarget.style.background='rgba(255,255,255,0.018)')} onMouseOut={e => (e.currentTarget.style.background='')}>
                          <td style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--teal)', fontWeight: 500 }}>{spec?.name || '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 13 }}>Rs.{p.amount}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--mu2)' }}>{p.upiId || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sBg, color: sColor, textTransform: 'capitalize' }}>{p.status}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                        </tr>
                      )
                    })}
                    {payouts.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No payouts yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PERFORMANCE TAB */}
          {tab === 'performance' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
                {specialists.slice(0, 6).map((spec, i) => {
                  const d = getSpecData(spec)
                  const totalEarning = d.consultationEarnings + Math.round(d.commissionEarned)
                  return (
                    <div key={i} className="card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        {spec.profilePhoto ? <img src={spec.profilePhoto} style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover' }} /> :
                          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'linear-gradient(135deg,#D4A853,#B87C30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: '#08090C' }}>{spec.name.charAt(0)}</div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spec.name}</div>
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, fontWeight: 700, background: spec.isActive ? 'var(--grL)' : 'var(--rdL)', color: spec.isActive ? 'var(--green)' : 'var(--red)' }}>{spec.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                          <span style={{ color: 'var(--mu)' }}>Consultations</span>
                          <span style={{ fontWeight: 700 }}>{d.specCons.length}</span>
                        </div>
                        <div style={{ height: 5, background: 'var(--s2)', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: Math.min(100, d.specCons.length * 10) + '%', background: 'var(--blue)', borderRadius: 3 }} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                          <span style={{ color: 'var(--mu)' }}>Completion Rate</span>
                          <span style={{ fontWeight: 700, color: 'var(--green)' }}>{d.specCons.length > 0 ? Math.round(d.specCons.filter(c => c.status === 'completed').length / d.specCons.length * 100) : 0}%</span>
                        </div>
                        <div style={{ height: 5, background: 'var(--s2)', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: (d.specCons.length > 0 ? Math.round(d.specCons.filter(c => c.status === 'completed').length / d.specCons.length * 100) : 0) + '%', background: 'var(--green)', borderRadius: 3 }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--b1)', marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--mu)' }}>Total Earnings</span>
                        <span style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>Rs.{totalEarning.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 420, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Assign Consultation</div>
            <div style={{ fontSize: 13, color: 'var(--mu2)', marginBottom: 20 }}><strong>{assignModal.name}</strong> · {assignModal.concern}</div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Select Specialist</label>
              <select value={assignSpecId} onChange={e => setAssignSpecId(e.target.value)} style={{ ...inp }}>
                <option value="">Choose specialist...</option>
                {specialists.filter(s => s.isActive).map((s, i) => (
                  <option key={i} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => { setAssignModal(null); setAssignSpecId('') }} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={() => { if (!assignSpecId) { toast.error('Specialist select karo'); return } assignConsultation(assignModal._id, assignSpecId) }}
                style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Confirm Modal */}
      {payoutAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '28px 32px', width: 380, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 8 }}>
              {payoutAction.action === 'completed' ? 'Approve Payout?' : 'Reject Payout?'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mu2)', marginBottom: 20 }}>
              <strong>{payoutAction.spec?.name}</strong> — Rs.{payoutAction.payout?.amount}
            </div>
            <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12.5 }}>
              UPI: <strong>{payoutAction.payout?.upiId}</strong><br />
              Name: {payoutAction.payout?.upiName}
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setPayoutAction(null)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={() => updatePayoutStatus(payoutAction.payout._id, payoutAction.action)}
                style={{ flex: 1, padding: 10, background: payoutAction.action === 'completed' ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                {payoutAction.action === 'completed' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
