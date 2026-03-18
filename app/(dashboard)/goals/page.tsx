'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const GOAL_CATEGORIES = ['Revenue', 'Orders', 'Customers', 'Marketing', 'Product', 'Team', 'Operations', 'Other']
const GOAL_PERIODS = ['Weekly', 'Monthly', 'Quarterly', 'Yearly']
const GOAL_STATUS = ['Not Started', 'In Progress', 'At Risk', 'Completed', 'Cancelled']
const STATUS_COLORS: Record<string, string> = {
  'Not Started': 'var(--mu)', 'In Progress': 'var(--blue)', 'At Risk': 'var(--orange)', 'Completed': 'var(--green)', 'Cancelled': 'var(--red)'
}
const STATUS_BG: Record<string, string> = {
  'Not Started': 'rgba(107,114,128,0.12)', 'In Progress': 'var(--blL)', 'At Risk': 'var(--orL)', 'Completed': 'var(--grL)', 'Cancelled': 'var(--rdL)'
}
const CAT_COLORS: Record<string, string> = {
  Revenue: 'var(--green)', Orders: 'var(--blue)', Customers: 'var(--teal)', Marketing: 'var(--orange)',
  Product: 'var(--gold)', Team: 'var(--purple)', Operations: 'var(--mu2)', Other: 'var(--mu)',
}

interface Goal {
  id: string; title: string; description: string; category: string; period: string
  target: number; current: number; unit: string; status: string
  start_date: string; end_date: string; owner: string; notes: string
  created_at: string
}

interface KeyResult {
  id: string; goal_id: string; title: string; target: number; current: number; unit: string; done: boolean
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [keyResults, setKeyResults] = useState<KeyResult[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'okr'|'analytics'|'timeline'>('okr')
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected] = useState<Goal|null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddKR, setShowAddKR] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Revenue', period: 'Monthly', target: 0, current: 0, unit: '₹', status: 'Not Started', start_date: new Date().toISOString().split('T')[0], end_date: '', owner: '', notes: '' })
  const [krForm, setKrForm] = useState({ title: '', target: 0, current: 0, unit: '', goal_id: '' })

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [{ data: gData }, { data: krData }] = await Promise.all([
        supabase.from('goals').select('*').order('created_at', { ascending: false }),
        supabase.from('goal_key_results').select('*'),
      ])
      setGoals(gData || [])
      setKeyResults(krData || [])

      const url = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null
      if (url) {
        const res = await fetch(url + '/api/orders').then(r => r.ok ? r.json() : [])
        setOrders(Array.isArray(res) ? res : [])
      }
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  async function addGoal() {
    if (!form.title || form.target <= 0) { toast.error('Title & target required'); return }
    const { error } = await supabase.from('goals').insert(form)
    if (error) { toast.error(error.message); return }
    toast.success('Goal added!')
    setShowAdd(false)
    setForm({ title: '', description: '', category: 'Revenue', period: 'Monthly', target: 0, current: 0, unit: '₹', status: 'Not Started', start_date: new Date().toISOString().split('T')[0], end_date: '', owner: '', notes: '' })
    loadAll()
  }

  async function addKR() {
    if (!krForm.title || !krForm.goal_id) { toast.error('Title required'); return }
    const { error } = await supabase.from('goal_key_results').insert(krForm)
    if (error) { toast.error(error.message); return }
    toast.success('Key Result added!')
    setShowAddKR(false)
    setKrForm({ title: '', target: 0, current: 0, unit: '', goal_id: '' })
    loadAll()
  }

  async function updateGoal(id: string, updates: any) {
    await supabase.from('goals').update(updates).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g))
    if (selected?.id === id) setSelected(s => s ? { ...s, ...updates } : s)
    toast.success('Updated!')
  }

  async function updateKR(id: string, updates: any) {
    await supabase.from('goal_key_results').update(updates).eq('id', id)
    setKeyResults(prev => prev.map(k => k.id === id ? { ...k, ...updates } : k))
  }

  async function deleteGoal(id: string) {
    if (!confirm('Delete this goal?')) return
    await supabase.from('goal_key_results').delete().eq('goal_id', id)
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
    setSelected(null)
    toast.success('Deleted!')
  }

  const pct = (g: Goal) => g.target > 0 ? Math.min(100, Math.round(g.current / g.target * 100)) : 0
  const filtered = goals.filter(g => {
    if (filterPeriod !== 'all' && g.period !== filterPeriod) return false
    if (filterStatus !== 'all' && g.status !== filterStatus) return false
    return true
  })

  // Analytics
  const totalGoals = goals.length
  const completed = goals.filter(g => g.status === 'Completed').length
  const inProgress = goals.filter(g => g.status === 'In Progress').length
  const atRisk = goals.filter(g => g.status === 'At Risk').length
  const avgProgress = goals.length > 0 ? Math.round(goals.reduce((s, g) => s + pct(g), 0) / goals.length) : 0
  const deliveredOrders = orders.filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'delivered')
  const totalRevenue = deliveredOrders.reduce((s, o) => s + (o.amount || 0), 0)

  // Goal progress auto-sync for revenue/order goals
  const getAutoProgress = (g: Goal) => {
    if (g.category === 'Revenue') return totalRevenue
    if (g.category === 'Orders') return deliveredOrders.length
    if (g.category === 'Customers') return Array.from(new Set(orders.map(o => o.phone || o.userId))).length
    return g.current
  }

  const daysLeft = (g: Goal) => {
    if (!g.end_date) return null
    const diff = Math.ceil((new Date(g.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const catCounts: Record<string, number> = {}
  goals.forEach(g => { catCounts[g.category] = (catCounts[g.category] || 0) + 1 })

  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Goals <span style={{ color: 'var(--gold)' }}>& OKR</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{totalGoals} goals · {completed} completed · {inProgress} in progress · {avgProgress}% avg</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>+ Add Goal</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { l: 'Total Goals', v: totalGoals, c: 'var(--blue)' },
          { l: 'Completed', v: completed, c: 'var(--green)' },
          { l: 'In Progress', v: inProgress, c: 'var(--blue)' },
          { l: 'At Risk', v: atRisk, c: 'var(--orange)' },
          { l: 'Avg Progress', v: avgProgress + '%', c: 'var(--gold)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>{s.l}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[{id:'okr',l:'🎯 Goals'},{id:'analytics',l:'📊 Analytics'},{id:'timeline',l:'📅 Timeline'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: tab === t.id ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: tab === t.id ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (tab === t.id ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* OKR TAB */}
      {tab === 'okr' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={{ ...inp, marginBottom: 0, width: 'auto' }}>
              <option value="all">All Periods</option>
              {GOAL_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, marginBottom: 0, width: 'auto' }}>
              <option value="all">All Status</option>
              {GOAL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 16, alignItems: 'start' }}>
            {/* Goals List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.length === 0 && (
                <div style={{ background: 'var(--s1)', border: '1px dashed var(--b2)', borderRadius: 14, padding: 60, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>🎯</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 8 }}>No Goals Yet</div>
                  <div style={{ color: 'var(--mu)', fontSize: 13, marginBottom: 20 }}>Set your first goal to track progress</div>
                  <button onClick={() => setShowAdd(true)} style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 9, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>+ Add First Goal</button>
                </div>
              )}
              {filtered.map(g => {
                const progress = pct(g)
                const autoVal = getAutoProgress(g)
                const dl = daysLeft(g)
                const gKRs = keyResults.filter(k => k.goal_id === g.id)
                const krDone = gKRs.filter(k => k.done).length
                return (
                  <div key={g.id} onClick={() => setSelected(selected?.id === g.id ? null : g)} style={{ background: 'var(--s1)', border: '1px solid ' + (selected?.id === g.id ? 'rgba(212,168,83,0.4)' : 'var(--b1)'), borderRadius: 14, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseOver={e => { if (selected?.id !== g.id) e.currentTarget.style.borderColor='var(--b2)' }} onMouseOut={e => { if (selected?.id !== g.id) e.currentTarget.style.borderColor='var(--b1)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: STATUS_BG[g.status], color: STATUS_COLORS[g.status] }}>{g.status}</span>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: 'rgba(212,168,83,0.12)', color: 'var(--gold)' }}>{g.period}</span>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: (CAT_COLORS[g.category] || 'var(--mu)') + '18', color: CAT_COLORS[g.category] || 'var(--mu)' }}>{g.category}</span>
                          {dl !== null && dl <= 7 && dl >= 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: 'var(--rdL)', color: 'var(--red)' }}>⚠️ {dl}d left</span>}
                          {dl !== null && dl < 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: 'var(--rdL)', color: 'var(--red)' }}>Overdue</span>}
                        </div>
                        <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{g.title}</div>
                        {g.description && <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.5 }}>{g.description}</div>}
                      </div>
                      {/* Circular progress */}
                      <div style={{ flexShrink: 0, position: 'relative', width: 56, height: 56 }}>
                        <svg width="56" height="56" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="22" fill="none" stroke="var(--b2)" strokeWidth="5"/>
                          <circle cx="28" cy="28" r="22" fill="none" stroke={progress >= 100 ? 'var(--green)' : progress >= 60 ? 'var(--gold)' : 'var(--blue)'} strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={138.23} strokeDashoffset={138.23 - (138.23 * progress / 100)} transform="rotate(-90 28 28)"/>
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--tx)' }}>{progress}%</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
                        <span style={{ color: 'var(--mu)' }}>Progress</span>
                        <span style={{ fontFamily: 'DM Mono', fontWeight: 700 }}>
                          <span style={{ color: progress >= 100 ? 'var(--green)' : 'var(--tx)' }}>{g.unit}{g.current.toLocaleString('en-IN')}</span>
                          <span style={{ color: 'var(--mu)' }}> / {g.unit}{g.target.toLocaleString('en-IN')}</span>
                        </span>
                      </div>
                      <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: progress + '%', background: progress >= 100 ? 'linear-gradient(90deg,var(--green),#5EF0D8)' : progress >= 60 ? 'linear-gradient(90deg,var(--gold),var(--orange))' : 'linear-gradient(90deg,var(--blue),var(--teal))', borderRadius: 4, transition: 'width 0.5s' }} />
                      </div>
                    </div>

                    {/* Auto-sync indicator + KRs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {(g.category === 'Revenue' || g.category === 'Orders' || g.category === 'Customers') && (
                        <span style={{ fontSize: 10, color: 'var(--teal)', background: 'var(--tlL)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                          ⚡ Auto-sync: {g.unit}{autoVal.toLocaleString('en-IN')}
                        </span>
                      )}
                      {gKRs.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--mu)', background: 'var(--s2)', padding: '2px 8px', borderRadius: 20 }}>
                          {krDone}/{gKRs.length} KRs done
                        </span>
                      )}
                      {g.owner && <span style={{ fontSize: 10, color: 'var(--mu)', marginLeft: 'auto' }}>👤 {g.owner}</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Detail Panel */}
            {selected && (
              <div style={{ position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{selected.title}</div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: STATUS_BG[selected.status], color: STATUS_COLORS[selected.status] }}>{selected.status}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: 'var(--gL)', color: 'var(--gold)' }}>{selected.period}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>

                {/* Big progress circle */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                  <div style={{ position: 'relative', width: 100, height: 100 }}>
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--b2)" strokeWidth="8"/>
                      <circle cx="50" cy="50" r="42" fill="none" stroke={pct(selected) >= 100 ? 'var(--green)' : pct(selected) >= 60 ? 'var(--gold)' : 'var(--blue)'} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray="263.9" strokeDashoffset={263.9 - (263.9 * pct(selected) / 100)} transform="rotate(-90 50 50)"/>
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>{pct(selected)}%</div>
                      <div style={{ fontSize: 9, color: 'var(--mu)' }}>Progress</div>
                    </div>
                  </div>
                </div>

                {/* Inline current update */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>Current</div>
                    <input type="number" defaultValue={selected.current} onBlur={e => updateGoal(selected.id, { current: Number(e.target.value) })} style={{ background: 'transparent', border: 'none', color: 'var(--teal)', fontFamily: 'Syne', fontSize: 20, fontWeight: 800, width: '100%', outline: 'none' }} />
                    <div style={{ fontSize: 9, color: 'var(--mu)' }}>{selected.unit}</div>
                  </div>
                  <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>Target</div>
                    <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{selected.unit}{selected.target.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 9, color: 'var(--mu)' }}>{selected.unit}</div>
                  </div>
                </div>

                {/* Status update */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Status</label>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {GOAL_STATUS.map(s => (
                      <button key={s} onClick={() => updateGoal(selected.id, { status: s })} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (selected.status === s ? STATUS_COLORS[s] : 'var(--b2)'), background: selected.status === s ? STATUS_BG[s] : 'transparent', color: selected.status === s ? STATUS_COLORS[s] : 'var(--mu)', fontFamily: 'Outfit' }}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                {(selected.start_date || selected.end_date) && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {selected.start_date && <div style={{ flex: 1, background: 'var(--s2)', borderRadius: 8, padding: '9px 11px' }}><div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>Start</div><div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(selected.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>}
                    {selected.end_date && <div style={{ flex: 1, background: daysLeft(selected) !== null && (daysLeft(selected) as number) < 0 ? 'var(--rdL)' : 'var(--s2)', borderRadius: 8, padding: '9px 11px' }}><div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>Deadline</div><div style={{ fontSize: 12, fontWeight: 600, color: daysLeft(selected) !== null && (daysLeft(selected) as number) < 0 ? 'var(--red)' : 'var(--tx)' }}>{new Date(selected.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{daysLeft(selected) !== null && ` (${daysLeft(selected)}d)`}</div></div>}
                  </div>
                )}

                {selected.description && <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{selected.description}</div>}
                {selected.notes && <div style={{ background: 'var(--gL)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{selected.notes}</div>}

                {/* Key Results */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>Key Results</div>
                    <button onClick={() => { setKrForm(p => ({...p, goal_id: selected.id})); setShowAddKR(true) }} style={{ padding: '3px 10px', background: 'var(--gL)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 6, color: 'var(--gold)', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>+ Add KR</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {keyResults.filter(k => k.goal_id === selected.id).map(kr => (
                      <div key={kr.id} style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px', border: kr.done ? '1px solid var(--green)44' : '1px solid var(--b1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: kr.done ? 0 : 8 }}>
                          <input type="checkbox" checked={kr.done} onChange={e => updateKR(kr.id, { done: e.target.checked })} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--green)' }} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, textDecoration: kr.done ? 'line-through' : 'none', color: kr.done ? 'var(--mu)' : 'var(--tx)' }}>{kr.title}</span>
                        </div>
                        {!kr.done && kr.target > 0 && (
                          <div style={{ marginTop: 6, marginLeft: 22 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 4 }}>
                              <span style={{ color: 'var(--mu)' }}>{kr.unit}{kr.current}/{kr.unit}{kr.target}</span>
                              <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{kr.target > 0 ? Math.round(kr.current/kr.target*100) : 0}%</span>
                            </div>
                            <div style={{ height: 5, background: 'var(--s1)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: Math.min(100, kr.target > 0 ? Math.round(kr.current/kr.target*100) : 0) + '%', background: 'var(--blue)', borderRadius: 3 }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {keyResults.filter(k => k.goal_id === selected.id).length === 0 && (
                      <div style={{ textAlign: 'center', padding: '14px', color: 'var(--mu)', fontSize: 12 }}>No key results — add milestones</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => deleteGoal(selected.id)} style={{ flex: 1, padding: 10, background: 'var(--rdL)', border: 'none', borderRadius: 8, color: 'var(--red)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            {/* Progress by status */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Goals by Status</div>
              {GOAL_STATUS.filter(s => goals.some(g => g.status === s)).map(s => {
                const count = goals.filter(g => g.status === s).length
                const maxCount = Math.max(...GOAL_STATUS.map(st => goals.filter(g => g.status === st).length), 1)
                return (
                  <div key={s} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: STATUS_COLORS[s] }}>{s}</span>
                      <span style={{ fontFamily: 'DM Mono', color: STATUS_COLORS[s] }}>{count}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(count/maxCount*100) + '%', background: STATUS_COLORS[s], borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
              {goals.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No goals yet</div>}
            </div>

            {/* Progress by category */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Goals by Category</div>
              {Object.entries(catCounts).map(([cat, count], i) => {
                const maxCount = Math.max(...Object.values(catCounts), 1)
                const avgPct = Math.round(goals.filter(g => g.category === cat).reduce((s, g) => s + pct(g), 0) / count)
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: CAT_COLORS[cat] || 'var(--mu)' }}>{cat}</span>
                      <span style={{ fontFamily: 'DM Mono', color: 'var(--mu)', fontSize: 10 }}>{count} goals · {avgPct}% avg</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(count/maxCount*100) + '%', background: CAT_COLORS[cat] || 'var(--mu)', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
              {goals.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No goals yet</div>}
            </div>
          </div>

          {/* All goals progress bar chart */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>All Goals Progress</div>
            {goals.sort((a,b) => pct(b) - pct(a)).map(g => (
              <div key={g.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[g.category] || 'var(--mu)', display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{g.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: STATUS_BG[g.status], color: STATUS_COLORS[g.status], fontWeight: 700 }}>{g.status}</span>
                    <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: pct(g) >= 100 ? 'var(--green)' : pct(g) >= 60 ? 'var(--gold)' : 'var(--blue)' }}>{pct(g)}%</span>
                  </div>
                </div>
                <div style={{ height: 9, background: 'var(--s2)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct(g) + '%', background: pct(g) >= 100 ? 'linear-gradient(90deg,var(--green),#5EF0D8)' : pct(g) >= 60 ? 'linear-gradient(90deg,var(--gold),var(--orange))' : 'linear-gradient(90deg,var(--blue),var(--teal))', borderRadius: 5 }} />
                </div>
              </div>
            ))}
            {goals.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 30 }}>No goals yet</div>}
          </div>

          {/* Summary grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
            {[
              { l: 'Completion Rate', v: totalGoals > 0 ? Math.round(completed/totalGoals*100) + '%' : '—', c: 'var(--green)' },
              { l: 'Avg Progress', v: avgProgress + '%', c: 'var(--gold)' },
              { l: 'Key Results', v: keyResults.length, c: 'var(--blue)' },
              { l: 'KRs Completed', v: keyResults.filter(k => k.done).length, c: 'var(--green)' },
              { l: 'At Risk Goals', v: atRisk, c: 'var(--orange)' },
              { l: 'Total Goals', v: totalGoals, c: 'var(--teal)' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TIMELINE TAB */}
      {tab === 'timeline' && (
        <div>
          <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--mu)' }}>Goals by Deadline</div>
          {['Weekly','Monthly','Quarterly','Yearly'].map(period => {
            const pGoals = goals.filter(g => g.period === period)
            if (pGoals.length === 0) return null
            return (
              <div key={period} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--b1)' }} />
                  {period} Goals
                  <div style={{ flex: 1, height: 1, background: 'var(--b1)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pGoals.map(g => {
                    const progress = pct(g)
                    const dl = daysLeft(g)
                    return (
                      <div key={g.id} onClick={() => { setSelected(g); setTab('okr') }} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                          <svg width="42" height="42" viewBox="0 0 42 42" style={{ position: 'absolute', inset: 0 }}>
                            <circle cx="21" cy="21" r="18" fill="none" stroke="var(--b2)" strokeWidth="4"/>
                            <circle cx="21" cy="21" r="18" fill="none" stroke={progress >= 100 ? 'var(--green)' : 'var(--blue)'} strokeWidth="4" strokeLinecap="round"
                              strokeDasharray="113.1" strokeDashoffset={113.1 - (113.1 * progress / 100)} transform="rotate(-90 21 21)"/>
                          </svg>
                          <span style={{ fontSize: 10, fontWeight: 800, position: 'relative', zIndex: 1 }}>{progress}%</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--mu)' }}>
                            <span style={{ color: CAT_COLORS[g.category] || 'var(--mu)', fontWeight: 600 }}>{g.category}</span>
                            <span>{g.unit}{g.current.toLocaleString('en-IN')} / {g.unit}{g.target.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: STATUS_BG[g.status], color: STATUS_COLORS[g.status], display: 'block', marginBottom: 4 }}>{g.status}</span>
                          {dl !== null && <span style={{ fontSize: 10, color: dl < 0 ? 'var(--red)' : dl <= 7 ? 'var(--orange)' : 'var(--mu)' }}>{dl < 0 ? `${Math.abs(dl)}d overdue` : `${dl}d left`}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {goals.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)', background: 'var(--s1)', borderRadius: 12, border: '1px dashed var(--b2)' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>📅</div>
              <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, marginBottom: 8 }}>No Goals Set</div>
              <div style={{ fontSize: 13 }}>Add goals to see your timeline</div>
            </div>
          )}
        </div>
      )}

      {/* ADD GOAL MODAL */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 560, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Goal</div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Goal Title*</label>
            <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Reach ₹5L monthly revenue" style={inp} />
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={2} placeholder="What does success look like?" style={{ ...inp, resize: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[{k:'category',l:'Category',opts:GOAL_CATEGORIES},{k:'period',l:'Period',opts:GOAL_PERIODS},{k:'status',l:'Status',opts:GOAL_STATUS}].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                  <select value={(form as any)[f.k]} onChange={e => setForm(p => ({...p, [f.k]: e.target.value}))} style={inp}>{f.opts.map(o => <option key={o} value={o}>{o}</option>)}</select>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[{k:'target',l:'Target*',t:'number'},{k:'current',l:'Current Value',t:'number'},{k:'unit',l:'Unit (₹, orders...)',t:'text'}].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                  <input type={f.t} value={(form as any)[f.k]} onChange={e => setForm(p => ({...p, [f.k]: f.t === 'number' ? Number(e.target.value) : e.target.value}))} style={inp} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[{k:'start_date',l:'Start Date',t:'date'},{k:'end_date',l:'Deadline',t:'date'},{k:'owner',l:'Owner',t:'text'}].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                  <input type={f.t} value={(form as any)[f.k]} onChange={e => setForm(p => ({...p, [f.k]: e.target.value}))} placeholder={f.t === 'text' ? 'Ayan, Tofik...' : ''} style={inp} />
                </div>
              ))}
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2} placeholder="Any extra context..." style={{ ...inp, resize: 'none' }} />
            <div style={{ background: 'var(--blL)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 11.5, color: 'var(--blue)', lineHeight: 1.6 }}>
              💡 Revenue, Orders & Customers goals auto-sync from your live data.
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addGoal} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Goal</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD KEY RESULT MODAL */}
      {showAddKR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 28px', width: 440, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Key Result</div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Milestone Title*</label>
            <input value={krForm.title} onChange={e => setKrForm(p => ({...p, title: e.target.value}))} placeholder="Launch Instagram campaign" style={inp} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[{k:'current',l:'Current',t:'number'},{k:'target',l:'Target',t:'number'},{k:'unit',l:'Unit',t:'text'}].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                  <input type={f.t} value={(krForm as any)[f.k]} onChange={e => setKrForm(p => ({...p, [f.k]: f.t === 'number' ? Number(e.target.value) : e.target.value}))} placeholder={f.k === 'unit' ? '₹, %...' : '0'} style={inp} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAddKR(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addKR} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Key Result</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
