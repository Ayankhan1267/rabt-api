'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const STAGES = [
  { id: 'just_login', label: 'Just Login', color: 'var(--mu)', bg: 'rgba(255,255,255,0.05)' },
  { id: 'new', label: 'New Lead', color: 'var(--blue)', bg: 'var(--blL)' },
  { id: 'contacted', label: 'Contacted', color: 'var(--gold)', bg: 'var(--gL)' },
  { id: 'consultation_pending', label: 'Consultation Pending', color: 'var(--orange)', bg: 'var(--orL)' },
  { id: 'consultation_booked', label: 'Consultation Booked', color: 'var(--teal)', bg: 'rgba(20,184,166,0.15)' },
  { id: 'consultation_accepted', label: 'Consultation Accepted', color: 'var(--blue)', bg: 'var(--blL)' },
  { id: 'consultation_rescheduled', label: 'Rescheduled', color: 'var(--purple)', bg: 'rgba(139,92,246,0.15)' },
  { id: 'consultation_completed', label: 'Consultation Done', color: 'var(--teal)', bg: 'rgba(20,184,166,0.15)' },
  { id: 'routine_purchased', label: 'Routine Purchased', color: 'var(--green)', bg: 'var(--grL)' },
  { id: 'converted', label: 'Converted ?', color: 'var(--green)', bg: 'var(--grL)' },
  { id: 'consultation_cancelled', label: 'Cancelled', color: 'var(--red)', bg: 'var(--rdL)' },
  { id: 'lost', label: 'Lost', color: 'var(--red)', bg: 'var(--rdL)' },
]

const SOURCES = ['WhatsApp', 'Instagram DM', 'Meta Ad', 'Google Ad', 'Website', 'Manual', 'Referral', 'Offline']

// Map MongoDB consultation status ? CRM stage
function consStatusToStage(status: string): string {
  const map: Record<string, string> = {
    pending: 'consultation_pending',
    accepted: 'consultation_accepted',
    scheduled: 'consultation_booked',
    rescheduled: 'consultation_rescheduled',
    completed: 'consultation_completed',
    cancelled: 'consultation_cancelled',
    canceled: 'consultation_cancelled',
    in_progress: 'consultation_accepted',
  }
  return map[status?.toLowerCase()] || 'consultation_pending'
}

export default function CRMPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [mongoConsultations, setMongoConsultations] = useState<any[]>([])
  const [mongoCustomers, setMongoCustomers] = useState<any[]>([])
  const [mongoSpecialists, setMongoSpecialists] = useState<any[]>([])
  const [mongoOrders, setMongoOrders] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [mongoSpec, setMongoSpec] = useState<any>(null)
  const [mongoUrl, setMongoUrl] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<'pipeline' | 'table' | 'analytics' | 'unassigned'>('pipeline')
  const [showImport, setShowImport] = useState(false)
  const [importData, setImportData] = useState('')
  const [importing, setImporting] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [form, setForm] = useState({ name: '', phone: '', email: '', concern: '', source: 'Manual', assigned_to: '', notes: '', stage: 'new' })

  useEffect(() => {
    setMounted(true)
    setMongoUrl(process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') || '')
    loadAll()
  }, [])

  useEffect(() => {
    const ch = supabase.channel('crm').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => loadLeads()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const [p, pr] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user?.id).single(),
      supabase.from('profiles').select('*'),
    ])
    setProfile(p.data)
    setProfiles(pr.data || [])

    // Get mongo specialist for role-based filter
    const url = process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
    if (url && p.data?.role === 'specialist') {
      try {
        const specRes = await fetch(url + '/api/specialists').then(r => r.ok ? r.json() : [])
        const mySpec = Array.isArray(specRes) ? specRes.find((s: any) => s.email?.toLowerCase() === p.data?.email?.toLowerCase()) : null
        setMongoSpec(mySpec)
      } catch {}
    }

    await loadLeads(p.data)
    setLoading(false)
  }

  async function loadLeads(prof?: any) {
    const me = prof || profile
    const { data } = await supabase.from('leads').select('*, assigned_to(id,name,role), created_by(id,name)').order('created_at', { ascending: false })
    const all = data || []
    if (!me || ['founder', 'manager', 'specialist_manager', 'ops', 'admin'].includes(me.role)) {
      setLeads(all)
    } else if (me.role === 'specialist') {
      setLeads(all.filter((l: any) => l.assigned_to?.id === me.id || l.created_by?.id === me.id))
    } else {
      setLeads(all)
    }
  }

  async function autoSync() {
    const url = process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
    if (!url) { toast.error('MongoDB connect nahi hai'); return }
    setSyncing(true)
    toast.loading('MongoDB se sync ho raha hai...', { id: 'sync' })
    try {
      const [custRes, consRes, specRes, ordRes] = await Promise.all([
        fetch(url + '/api/users').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/consultations').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/specialists').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/orders').then(r => r.ok ? r.json() : []),
      ])
      const customers = Array.isArray(custRes) ? custRes : []
      const consultations = Array.isArray(consRes) ? consRes : []
      const specialists = Array.isArray(specRes) ? specRes : []
      const orders = Array.isArray(ordRes) ? ordRes : []
      setMongoCustomers(customers)
      setMongoConsultations(consultations)
      setMongoSpecialists(specialists)
      setMongoOrders(orders)

      const { data: { user } } = await supabase.auth.getUser()
      const { data: hqSpecs } = await supabase.from('profiles').select('*').in('role', ['specialist', 'specialist_manager'])
      const hqList = hqSpecs || []
      const { data: existingLeads } = await supabase.from('leads').select('id,phone,email,mongo_user_id,stage,assigned_to')
      const existing = existingLeads || []

      const findSpec = (mongoSpecId: any) => {
        if (!mongoSpecId) return null
        const specId = typeof mongoSpecId === 'string' ? mongoSpecId : mongoSpecId?.$oid || String(mongoSpecId)
        const mongoSpec = specialists.find((s: any) => s._id === specId || s._id?.$oid === specId)
        if (!mongoSpec) return null
        return hqList.find((h: any) => h.specialist_id === specId || h.email === mongoSpec.email || h.name?.toLowerCase() === mongoSpec.name?.toLowerCase())
      }

      let added = 0, updated = 0, autoAssigned = 0

      for (const c of consultations) {
        const userId = c.userId || c.user?.$oid || c.user?.toString() || ''
        const customer = customers.find((cu: any) => cu._id === userId || cu._id?.$oid === userId)
        const custName = c.name || c.fullName || customer?.firstName || 'Customer'
        const phone = customer?.phoneNumber || customer?.phone || ''
        const email = customer?.email || ''

        // Check if purchased
        const hasPurchased = orders.some((o: any) => {
          const uid = o.userId || o.user
          return uid?.toString() === userId || (phone && o.customerPhone === phone)
        })

        const newStage = hasPurchased ? 'routine_purchased' : consStatusToStage(c.status)

        const exists = existing.find((l: any) =>
          (phone && l.phone === phone) || (email && l.email === email) || (userId && l.mongo_user_id === userId)
        )

        if (exists) {
          // Only upgrade stage — never downgrade to lower stage
          const stageOrder = STAGES.map(s => s.id)
          const currentIdx = stageOrder.indexOf(exists.stage)
          const newIdx = stageOrder.indexOf(newStage)
          if (newIdx > currentIdx) {
            await supabase.from('leads').update({ stage: newStage }).eq('id', exists.id)
            updated++
          }
          if (!exists.assigned_to && c.assignedSpecialist) {
            const hqSpec = findSpec(c.assignedSpecialist)
            if (hqSpec) { await supabase.from('leads').update({ assigned_to: hqSpec.id }).eq('id', exists.id); autoAssigned++ }
          }
          continue
        }

        let assignedToId: string | null = null
        if (c.assignedSpecialist) {
          const hqSpec = findSpec(c.assignedSpecialist)
          if (hqSpec) { assignedToId = hqSpec.id; autoAssigned++ }
        }

        const { error } = await supabase.from('leads').insert({
          name: custName, phone, email,
          concern: c.concern || c.description || '',
          source: 'Website', stage: newStage,
          assigned_to: assignedToId,
          mongo_user_id: userId,
          created_by: user?.id,
          notes: (assignedToId ? 'Auto-assigned' : 'Needs assignment') + ' | Cons: ' + (c.consultationNumber || c._id?.toString()?.slice(-8) || ''),
        })
        if (!error) {
          added++
          if (assignedToId) {
            await supabase.from('notifications').insert({ user_id: assignedToId, title: 'New Lead!', message: custName + ' assign hua!', type: 'lead' })
          }
        }
      }

      // Also add offline customers from orders (specialist_offline)
      const offlineOrders = orders.filter((o: any) => o.source === 'specialist_offline')
      for (const o of offlineOrders) {
        const phone = o.customerPhone || ''
        if (!phone) continue
        const exists = existing.find((l: any) => phone && l.phone === phone)
        if (exists) {
          if (exists.stage !== 'routine_purchased' && exists.stage !== 'converted') {
            await supabase.from('leads').update({ stage: 'routine_purchased' }).eq('id', exists.id)
            updated++
          }
          continue
        }
        const specInHq = o.specialistId ? hqList.find((h: any) => h.specialist_id === o.specialistId?.toString() || h.email === specialists.find((s: any) => s._id?.toString() === o.specialistId?.toString())?.email) : null
        await supabase.from('leads').insert({
          name: o.customerName, phone, email: o.customerEmail || '',
          concern: 'Offline customer', source: 'Offline', stage: 'routine_purchased',
          assigned_to: specInHq?.id || null,
          mongo_user_id: o.userId || '',
          created_by: user?.id,
          notes: 'Offline order by specialist | Rs.' + o.amount,
        })
        added++
      }

      toast.success(added + ' new · ' + autoAssigned + ' auto-assigned · ' + updated + ' updated', { id: 'sync', duration: 8000 })
      loadLeads()
    } catch (err: any) {
      toast.error('Error: ' + err.message, { id: 'sync' })
    }
    setSyncing(false)
  }

  async function assignLead(leadId: string, userId: string, userName: string) {
    const { error } = await supabase.from('leads').update({ assigned_to: userId || null }).eq('id', leadId)
    if (error) { toast.error('Error: ' + error.message); return }
    if (userId) {
      toast.success(userName + ' ko assign kiya!')
      await supabase.from('notifications').insert({ user_id: userId, title: 'Lead Assigned', message: 'Naya lead assign hua!', type: 'lead' })
    } else toast.success('Unassigned')
    loadLeads()
  }

  async function updateStage(id: string, stage: string) {
    await supabase.from('leads').update({ stage }).eq('id', id)
    loadLeads()
  }

  async function addLead() {
    if (!form.name) { toast.error('Name required'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('leads').insert({
      name: form.name, phone: form.phone, email: form.email, concern: form.concern,
      source: form.source, stage: form.stage, assigned_to: form.assigned_to || null,
      created_by: user?.id, notes: form.notes
    })
    if (error) { toast.error(error.message); return }
    toast.success('Lead added!')
    setShowAdd(false)
    setForm({ name: '', phone: '', email: '', concern: '', source: 'Manual', assigned_to: '', notes: '', stage: 'new' })
    if (form.assigned_to) await supabase.from('notifications').insert({ user_id: form.assigned_to, title: 'New Lead', message: form.name, type: 'lead' })
    loadLeads()
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete?')) return
    await supabase.from('leads').delete().eq('id', id)
    loadLeads()
  }

  function sendWhatsApp(phone: string, name: string) {
    window.open('https://wa.me/' + phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent('Hi ' + name + '! Rabt Naturals se ??'), '_blank')
  }

  const isAdmin = profile && ['founder', 'manager', 'specialist_manager', 'ops', 'admin'].includes(profile.role)
  const filtered = leads.filter(l => {
    const matchSearch = !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
    const matchStage = stageFilter === 'all' || l.stage === stageFilter
    return matchSearch && matchStage
  })
  const unassigned = leads.filter(l => !l.assigned_to)
  const stats = STAGES.reduce((a, s) => { a[s.id] = leads.filter(l => l.stage === s.id).length; return a }, {} as Record<string, number>)
  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  // Key stages for summary bar
  const summaryStages = [
    { id: 'new', label: 'New', color: 'var(--blue)' },
    { id: 'consultation_pending', label: 'Pending', color: 'var(--orange)' },
    { id: 'consultation_accepted', label: 'Accepted', color: 'var(--teal)' },
    { id: 'consultation_completed', label: 'Done', color: 'var(--teal)' },
    { id: 'routine_purchased', label: 'Purchased', color: 'var(--green)' },
    { id: 'converted', label: 'Converted', color: 'var(--green)' },
    { id: 'consultation_cancelled', label: 'Cancelled', color: 'var(--red)' },
    { id: 'lost', label: 'Lost', color: 'var(--red)' },
  ]

  if (!mounted) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>CRM / <span style={{ color: 'var(--gold)' }}>Leads</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {leads.length} total{unassigned.length > 0 && isAdmin && <span style={{ color: 'var(--orange)' }}> · {unassigned.length} unassigned</span>}
            <span style={{ color: 'var(--green)' }}> · Live</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button onClick={() => setShowImport(true)} style={{ padding: '8px 14px', background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
              ?? Import CSV
            </button>
          )}
          {isAdmin && (
            <button onClick={autoSync} disabled={syncing} style={{ padding: '8px 16px', background: syncing ? 'rgba(255,255,255,0.05)' : 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: syncing ? 'var(--mu)' : 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
              {syncing ? 'Syncing...' : 'Sync MongoDB'}
            </button>
          )}
          <button onClick={() => setShowAdd(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
            + Add Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8, marginBottom: 16 }}>
        {summaryStages.map(s => (
          <div key={s.id} onClick={() => setStageFilter(stageFilter === s.id ? 'all' : s.id)} style={{ background: stageFilter === s.id ? s.color + '22' : 'var(--s1)', border: '1px solid ' + (stageFilter === s.id ? s.color + '55' : 'var(--b1)'), borderRadius: 10, padding: '10px 12px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{stats[s.id] || 0}</div>
          </div>
        ))}
      </div>

      {unassigned.length > 0 && isAdmin && (
        <div style={{ background: 'var(--orL)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, color: 'var(--orange)' }}><strong>{unassigned.length} leads</strong> manually assign karne hain</span>
          <button onClick={() => setView('unassigned')} style={{ padding: '5px 12px', background: 'var(--orange)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 11.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>Assign Now</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone..." style={{ ...inp, marginBottom: 0, flex: 1 }} />
        {[{ id: 'pipeline', label: 'Pipeline' }, { id: 'table', label: 'Table' }, { id: 'analytics', label: '?? Analytics' }, ...(isAdmin ? [{ id: 'unassigned', label: 'Unassigned (' + unassigned.length + ')' }] : [])].map(t => (
          <button key={t.id} onClick={() => setView(t.id as any)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', whiteSpace: 'nowrap', background: view === t.id ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: view === t.id ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (view === t.id ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'pipeline' && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {STAGES.filter(s => stageFilter === 'all' || s.id === stageFilter).map(stage => {
            const sl = filtered.filter(l => l.stage === stage.id)
            return (
              <div key={stage.id} style={{ minWidth: 230, flexShrink: 0 }}>
                <div style={{ padding: '9px 13px', borderRadius: '10px 10px 0 0', background: stage.bg, color: stage.color, border: '1px solid ' + stage.color + '33', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: stage.color }} />
                  <span style={{ fontWeight: 700, fontSize: 11, flex: 1 }}>{stage.label}</span>
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', color: stage.color, padding: '1px 7px', borderRadius: 20 }}>{sl.length}</span>
                </div>
                <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderTop: 'none', borderRadius: '0 0 10px 10px', minHeight: 300, padding: 8 }}>
                  {sl.map(lead => (
                    <div key={lead.id} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderLeft: '3px solid ' + (lead.assigned_to ? 'var(--green)' : 'var(--orange)'), borderRadius: 10, padding: '11px 12px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, cursor: 'pointer' }} onClick={() => setSelectedLead(lead)}>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{lead.name}</div>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: lead.source === 'Website' ? 'var(--grL)' : lead.source === 'Offline' ? 'var(--orL)' : 'var(--blL)', color: lead.source === 'Website' ? 'var(--green)' : lead.source === 'Offline' ? 'var(--orange)' : 'var(--blue)', fontWeight: 700 }}>{lead.source}</span>
                      </div>
                      {lead.phone && <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: 'DM Mono', marginBottom: 4 }}>{lead.phone}</div>}
                      {lead.concern && <div style={{ fontSize: 11, color: 'var(--mu2)', marginBottom: 8 }}>{lead.concern.slice(0, 50)}</div>}
                      {isAdmin && (
                        <select value={lead.assigned_to?.id || ''} onChange={e => { const p = profiles.find(pr => pr.id === e.target.value); assignLead(lead.id, e.target.value, p?.name || '') }}
                          style={{ width: '100%', background: lead.assigned_to ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)', border: '1px solid ' + (lead.assigned_to ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'), borderRadius: 6, padding: '5px 8px', color: lead.assigned_to ? 'var(--green)' : 'var(--orange)', fontSize: 11, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer', marginBottom: 8 }}>
                          <option value="">{lead.assigned_to ? '— Change —' : '?? Assign karo'}</option>
                          <optgroup label="Specialists">{profiles.filter(p => p.role === 'specialist').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                          <optgroup label="Team">{profiles.filter(p => p.role !== 'specialist').map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}</optgroup>
                        </select>
                      )}
                      {lead.assigned_to?.name && <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 6 }}>{lead.assigned_to.name}</div>}
                      <div style={{ display: 'flex', gap: 5 }}>
                        {lead.phone && <button onClick={() => sendWhatsApp(lead.phone, lead.name)} style={{ flex: 1, padding: '5px', background: 'var(--grL)', border: 'none', borderRadius: 6, color: 'var(--green)', fontSize: 11, cursor: 'pointer' }}>WA</button>}
                        {isAdmin && stage.id !== 'converted' && stage.id !== 'lost' && stage.id !== 'consultation_cancelled' && (
                          <button onClick={() => { const order = STAGES.map(s => s.id); const i = order.indexOf(stage.id); if(i < order.length-3) updateStage(lead.id, order[i+1]) }} style={{ flex: 1, padding: '5px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 6, color: '#08090C', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Next ?</button>
                        )}
                        {isAdmin && <button onClick={() => deleteLead(lead.id)} style={{ padding: '5px 7px', background: 'var(--rdL)', border: 'none', borderRadius: 6, color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}>X</button>}
                      </div>
                    </div>
                  ))}
                  {sl.length === 0 && <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--mu)', fontSize: 12 }}>Empty</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'table' && (
        <div className="card" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Name', 'Phone', 'Concern', 'Source', 'Stage', 'Assigned To', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const stage = STAGES.find(s => s.id === l.stage) || STAGES[0]
                return (
                  <tr key={i} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.018)')} onMouseOut={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, fontSize: 12.5 }}>{l.name}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontSize: 12 }}>{l.phone || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--mu2)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.concern || '—'}</td>
                    <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: l.source === 'Website' ? 'var(--grL)' : l.source === 'Offline' ? 'var(--orL)' : 'var(--blL)', color: l.source === 'Website' ? 'var(--green)' : l.source === 'Offline' ? 'var(--orange)' : 'var(--blue)' }}>{l.source}</span></td>
                    <td style={{ padding: '10px 12px' }}>
                      {isAdmin ? (
                        <select value={l.stage} onChange={e => updateStage(l.id, e.target.value)} style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 6, padding: '4px 8px', color: stage.color, fontSize: 11, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit' }}>
                          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: stage.bg, color: stage.color, fontWeight: 700 }}>{stage.label}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {isAdmin ? (
                        <select value={l.assigned_to?.id || ''} onChange={e => { const p = profiles.find(pr => pr.id === e.target.value); assignLead(l.id, e.target.value, p?.name || '') }} style={{ background: l.assigned_to ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)', border: '1px solid ' + (l.assigned_to ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'), borderRadius: 6, padding: '4px 8px', color: l.assigned_to ? 'var(--green)' : 'var(--orange)', fontSize: 11, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit', maxWidth: 140 }}>
                          <option value="">{l.assigned_to ? '— Change —' : '?? Assign'}</option>
                          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, color: l.assigned_to?.name ? 'var(--green)' : 'var(--mu)' }}>{l.assigned_to?.name || 'Unassigned'}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {l.phone && <button onClick={() => sendWhatsApp(l.phone, l.name)} style={{ padding: '4px 9px', background: 'var(--grL)', border: 'none', borderRadius: 6, color: 'var(--green)', fontSize: 10.5, cursor: 'pointer' }}>WA</button>}
                        <button onClick={() => setSelectedLead(l)} style={{ padding: '4px 9px', background: 'var(--gL)', border: 'none', borderRadius: 6, color: 'var(--gold)', fontSize: 10.5, cursor: 'pointer' }}>View</button>
                        {isAdmin && <button onClick={() => deleteLead(l.id)} style={{ padding: '4px 9px', background: 'var(--rdL)', border: 'none', borderRadius: 6, color: 'var(--red)', fontSize: 10.5, cursor: 'pointer' }}>X</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No leads</td></tr>}
            </tbody>
          </table>
        </div>
      )}


      {view === 'analytics' && (
        <div>
          {/* Funnel Chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Lead Funnel</div>
              {(() => {
                const funnelStages = [
                  { id: 'new', label: 'New Leads', color: 'var(--blue)' },
                  { id: 'consultation_pending', label: 'Consultation Pending', color: 'var(--orange)' },
                  { id: 'consultation_accepted', label: 'Accepted', color: 'var(--teal)' },
                  { id: 'consultation_completed', label: 'Completed', color: 'var(--teal)' },
                  { id: 'routine_purchased', label: 'Purchased', color: 'var(--green)' },
                  { id: 'converted', label: 'Converted', color: 'var(--green)' },
                ]
                const maxVal = Math.max(...funnelStages.map(s => stats[s.id] || 0), 1)
                return funnelStages.map((s, i) => {
                  const val = stats[s.id] || 0
                  const pct = Math.round(val / maxVal * 100)
                  return (
                    <div key={s.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: s.color }}>{val}</span>
                      </div>
                      <div style={{ height: 10, background: 'var(--s2)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: s.color, borderRadius: 5, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  )
                })
              })()}
            </div>

            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Source Breakdown</div>
              {(() => {
                const sourceCounts: Record<string, number> = {}
                leads.forEach(l => { sourceCounts[l.source || 'Unknown'] = (sourceCounts[l.source || 'Unknown'] || 0) + 1 })
                const total = leads.length || 1
                return Object.entries(sourceCounts).sort((a,b) => b[1]-a[1]).map(([source, count], i) => {
                  const colors = ['var(--blue)', 'var(--green)', 'var(--gold)', 'var(--orange)', 'var(--teal)', 'var(--purple)']
                  const color = colors[i % colors.length]
                  const pct = Math.round(count / total * 100)
                  return (
                    <div key={source} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>{source}</span>
                        <span style={{ fontFamily: 'DM Mono', color }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 4 }} />
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Specialist Performance */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Specialist Performance</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {(() => {
                const specMap: Record<string, {name: string, total: number, converted: number, purchased: number}> = {}
                leads.forEach(l => {
                  if (!l.assigned_to) return
                  const key = l.assigned_to.id
                  if (!specMap[key]) specMap[key] = { name: l.assigned_to.name, total: 0, converted: 0, purchased: 0 }
                  specMap[key].total++
                  if (l.stage === 'converted') specMap[key].converted++
                  if (l.stage === 'routine_purchased') specMap[key].purchased++
                })
                return Object.values(specMap).sort((a,b) => b.total - a.total).slice(0,8).map((s, i) => (
                  <div key={i} style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>{s.total}</div>
                        <div style={{ fontSize: 9, color: 'var(--mu)' }}>LEADS</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{s.purchased}</div>
                        <div style={{ fontSize: 9, color: 'var(--mu)' }}>BOUGHT</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>{s.total > 0 ? Math.round((s.purchased + s.converted) / s.total * 100) : 0}%</div>
                        <div style={{ fontSize: 9, color: 'var(--mu)' }}>CVR</div>
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Stage Distribution Pie-like */}
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Stage Distribution</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
              {STAGES.map(s => {
                const count = stats[s.id] || 0
                const pct = leads.length > 0 ? Math.round(count / leads.length * 100) : 0
                return (
                  <div key={s.id} onClick={() => setStageFilter(s.id)} style={{ background: s.bg, borderRadius: 10, padding: '12px 8px', textAlign: 'center', cursor: 'pointer', border: '1px solid ' + s.color + '33' }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: s.color }}>{count}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: s.color, marginTop: 4, marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: s.color, fontFamily: 'DM Mono' }}>{pct}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'unassigned' && isAdmin && (
        <div>
          {unassigned.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--mu)' }}>? Sab leads assigned hain!</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              {unassigned.map((lead, i) => (
                <div key={i} style={{ background: 'var(--s1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 12, padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>{lead.name}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: STAGES.find(s => s.id === lead.stage)?.bg || 'var(--blL)', color: STAGES.find(s => s.id === lead.stage)?.color || 'var(--blue)' }}>
                      {STAGES.find(s => s.id === lead.stage)?.label || lead.stage}
                    </span>
                  </div>
                  {lead.phone && <div style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--mu)', marginBottom: 4 }}>{lead.phone}</div>}
                  {lead.concern && <div style={{ fontSize: 12.5, color: 'var(--mu2)', marginBottom: 10 }}>{lead.concern}</div>}
                  {lead.notes && <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 10, padding: '6px 10px', background: 'var(--s2)', borderRadius: 6 }}>{lead.notes}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select onChange={e => { const p = profiles.find(pr => pr.id === e.target.value); if(p) assignLead(lead.id, p.id, p.name) }} style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer' }}>
                      <option value="">Assign karo...</option>
                      <optgroup label="Specialists">{profiles.filter(p => p.role === 'specialist').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                      <optgroup label="Managers">{profiles.filter(p => ['manager', 'specialist_manager', 'founder'].includes(p.role)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                    </select>
                    {lead.phone && <button onClick={() => sendWhatsApp(lead.phone, lead.name)} style={{ padding: '8px 12px', background: 'var(--grL)', border: 'none', borderRadius: 8, color: 'var(--green)', fontSize: 13, cursor: 'pointer' }}>WA</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedLead(null)}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 500, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800 }}>{selectedLead.name}</div>
              <button onClick={() => setSelectedLead(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>?</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Phone', value: selectedLead.phone || '—' },
                { label: 'Email', value: selectedLead.email || '—' },
                { label: 'Source', value: selectedLead.source },
                { label: 'Stage', value: STAGES.find(s => s.id === selectedLead.stage)?.label || selectedLead.stage },
                { label: 'Concern', value: selectedLead.concern || '—' },
                { label: 'Assigned', value: selectedLead.assigned_to?.name || 'Unassigned' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>
            {isAdmin && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Assign To</label>
                  <select value={selectedLead.assigned_to?.id || ''} onChange={e => { const p = profiles.find(pr => pr.id === e.target.value); assignLead(selectedLead.id, e.target.value, p?.name || ''); setSelectedLead({...selectedLead, assigned_to: p || null}) }} style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer' }}>
                    <option value="">— Unassigned —</option>
                    <optgroup label="Specialists">{profiles.filter(p => p.role === 'specialist').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                    <optgroup label="Team">{profiles.filter(p => p.role !== 'specialist').map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}</optgroup>
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Stage</label>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {STAGES.map(s => (
                      <button key={s.id} onClick={() => { updateStage(selectedLead.id, s.id); setSelectedLead({...selectedLead, stage: s.id}) }} style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid ' + (selectedLead.stage === s.id ? s.color + '55' : 'var(--b1)'), cursor: 'pointer', fontSize: 10.5, fontWeight: 600, fontFamily: 'Outfit', background: selectedLead.stage === s.id ? s.bg : 'transparent', color: selectedLead.stage === s.id ? s.color : 'var(--mu2)' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {selectedLead.notes && <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: 'var(--mu2)' }}>{selectedLead.notes}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedLead.phone && <button onClick={() => sendWhatsApp(selectedLead.phone, selectedLead.name)} style={{ flex: 1, padding: 10, background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, color: 'var(--green)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>?? WhatsApp</button>}
              {selectedLead.phone && <a href={'tel:' + selectedLead.phone.replace(/[^0-9+]/g,'')} style={{ flex: 1, padding: 10, background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: 'var(--blue)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit', textDecoration: 'none', textAlign: 'center' }}>?? Call</a>}
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 480, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Lead</div>
            {[{ k: 'name', l: 'Name*', p: 'Priya Sharma' }, { k: 'phone', l: 'Phone', p: '+91 9876543210' }, { k: 'email', l: 'Email', p: 'email@gmail.com' }, { k: 'concern', l: 'Concern', p: 'Acne, dark spots...' }, { k: 'notes', l: 'Notes', p: 'Additional info...' }].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                <input value={(form as any)[f.k]} onChange={e => setForm(p => ({...p, [f.k]: e.target.value}))} placeholder={f.p} style={inp} />
              </div>
            ))}
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Source</label>
            <select value={form.source} onChange={e => setForm(p => ({...p, source: e.target.value}))} style={inp}>{SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Initial Stage</label>
            <select value={form.stage} onChange={e => setForm(p => ({...p, stage: e.target.value}))} style={inp}>{STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Assign To</label>
            <select value={form.assigned_to} onChange={e => setForm(p => ({...p, assigned_to: e.target.value}))} style={inp}>
              <option value="">Unassigned</option>
              <optgroup label="Specialists">{profiles.filter(p => p.role === 'specialist').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
              <optgroup label="Team">{profiles.filter(p => p.role !== 'specialist').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
            </select>
            <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addLead} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Lead</button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 560, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Import Leads (CSV)</div>
            <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 16 }}>
              Format: <span style={{ fontFamily: 'DM Mono', color: 'var(--teal)' }}>name,phone,email,concern,source</span> (header row required)
            </div>
            <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11, color: 'var(--mu)', fontFamily: 'DM Mono' }}>
              name,phone,email,concern,source<br/>
              Priya Sharma,9876543210,priya@gmail.com,Acne,WhatsApp<br/>
              Riya Gupta,9123456789,,Pigmentation,Instagram DM
            </div>
            <textarea
              value={importData}
              onChange={e => setImportData(e.target.value)}
              placeholder="Paste CSV data here..."
              rows={8}
              style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '10px 12px', color: 'var(--tx)', fontSize: 12, fontFamily: 'DM Mono', outline: 'none', resize: 'vertical', marginBottom: 12 }}
            />
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Or upload CSV file</label>
              <input type="file" accept=".csv,.txt" onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => setImportData(ev.target?.result as string || '')
                reader.readAsText(file)
              }} style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', fontSize: 12, cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => { setShowImport(false); setImportData('') }} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button disabled={importing || !importData} onClick={async () => {
                setImporting(true)
                const { data: { user } } = await supabase.auth.getUser()
                const lines = importData.trim().split('\n')
                const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
                let added = 0, skipped = 0
                const { data: existing } = await supabase.from('leads').select('phone,email')
                const existSet = new Set([...(existing || []).map(l => l.phone), ...(existing || []).map(l => l.email)].filter(Boolean))
                for (let i = 1; i < lines.length; i++) {
                  if (!lines[i].trim()) continue
                  const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
                  const row: any = {}
                  headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
                  const name = row.name || row['full name'] || row['fullname'] || ''
                  const phone = row.phone || row['phone number'] || row['mobile'] || ''
                  const email = row.email || ''
                  if (!name) { skipped++; continue }
                  if (phone && existSet.has(phone)) { skipped++; continue }
                  if (email && existSet.has(email)) { skipped++; continue }
                  await supabase.from('leads').insert({
                    name, phone, email,
                    concern: row.concern || row['skin concern'] || '',
                    source: row.source || 'Import',
                    stage: 'new',
                    created_by: user?.id,
                    notes: 'Imported from CSV'
                  })
                  added++
                }
                toast.success(added + ' leads imported! ' + skipped + ' skipped (duplicates)')
                setShowImport(false)
                setImportData('')
                setImporting(false)
                loadLeads()
              }} style={{ flex: 2, padding: 10, background: importing || !importData ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: importing || !importData ? 'var(--mu)' : '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                {importing ? 'Importing...' : '?? Import Leads'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

