'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function PartnerManagerPage() {
  const [partners, setPartners]   = useState<any[]>([])
  const [orders, setOrders]       = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [mounted, setMounted]     = useState(false)
  const [tab, setTab]             = useState<'partners'|'orders'|'withdrawals'|'payouts'|'analytics'>('partners')
  const [selected, setSelected]   = useState<any>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [createdCreds, setCreatedCreds]     = useState<any>(null)
  const [createLoginModal, setCreateLoginModal] = useState<any>(null)
  const [createLoading, setCreateLoading]   = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', business_name: '', city: '', commission_pct: 10, notes: '' })

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: pData }, { data: oData }, { data: wData }] = await Promise.all([
      supabase.from('sales_partners').select('*').order('created_at', { ascending: false }),
      supabase.from('partner_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('partner_withdrawal_requests').select('*').order('created_at', { ascending: false }),
    ])
    setPartners(pData || [])
    setOrders(oData || [])
    setWithdrawals(wData || [])
    setLoading(false)
  }

  async function addPartner() {
    if (!form.name || !form.phone) { toast.error('Name and phone required'); return }
    if (!form.email) { toast.error('Email required for login creation'); return }
    const { data, error } = await supabase.from('sales_partners').insert({
      ...form, status: 'active', total_orders: 0, total_earnings: 0, pending_payout: 0, total_paid: 0, pending_commission: 0,
    }).select().single()
    if (error) { toast.error(error.message); return }
    toast.success('Partner added! Creating login...')
    setShowAdd(false)
    await createPartnerLogin({ ...form, id: data.id })
    setForm({ name: '', email: '', phone: '', business_name: '', city: '', commission_pct: 10, notes: '' })
    loadAll()
  }

  async function createPartnerLogin(partner: any) {
    setCreateLoading(true)
    try {
      const res = await fetch('/api/create-partner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: partner.name, email: partner.email, phone: partner.phone, partnerId: partner.id })
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setCreateLoading(false); return }
      setCreatedCreds(data.credentials)
      setCreateLoginModal(null)
      toast.success(data.alreadyExisted ? 'Password reset!' : 'Login created!')
    } catch { toast.error('Login creation failed') }
    setCreateLoading(false)
  }

  async function updateCommission(id: string, pct: number) {
    await supabase.from('sales_partners').update({ commission_pct: pct }).eq('id', id)
    setPartners(prev => prev.map(p => p.id === id ? {...p, commission_pct: pct} : p))
    toast.success('Commission updated!')
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('sales_partners').update({ status }).eq('id', id)
    setPartners(prev => prev.map(p => p.id === id ? {...p, status} : p))
    toast.success('Status updated!')
  }

  // ✅ Mark order as delivered — move pending_commission → total_earnings + pending_payout
  async function markDelivered(order: any) {
    const { error } = await supabase.from('partner_orders').update({ status: 'delivered' }).eq('id', order.id)
    if (error) { toast.error('Failed to mark delivered'); return }

    // Find partner
    const partner = partners.find(p => p.id === order.partner_id)
    if (partner && order.commission > 0) {
      await supabase.from('sales_partners').update({
        pending_commission: Math.max(0, (partner.pending_commission || 0) - order.commission),
        total_earnings:     (partner.total_earnings || 0) + order.commission,
        pending_payout:     (partner.pending_payout  || 0) + order.commission,
      }).eq('id', partner.id)
      setPartners(prev => prev.map(p => p.id === partner.id ? {
        ...p,
        pending_commission: Math.max(0, (p.pending_commission || 0) - order.commission),
        total_earnings:     (p.total_earnings || 0) + order.commission,
        pending_payout:     (p.pending_payout  || 0) + order.commission,
      } : p))
    }
    setOrders(prev => prev.map(o => o.id === order.id ? {...o, status: 'delivered'} : o))
    toast.success(`✅ Order delivered! ₹${order.commission} commission moved to earnings.`)
  }

  // ✅ Mark order cancelled from HQ side
  async function markCancelled(order: any) {
    if (!confirm('Cancel this order?')) return
    const { error } = await supabase.from('partner_orders').update({ status: 'cancelled' }).eq('id', order.id)
    if (error) { toast.error('Failed'); return }
    const partner = partners.find(p => p.id === order.partner_id)
    if (partner && order.commission > 0) {
      await supabase.from('sales_partners').update({
        total_orders:       Math.max(0, (partner.total_orders       || 0) - 1),
        pending_commission: Math.max(0, (partner.pending_commission || 0) - order.commission),
      }).eq('id', partner.id)
      setPartners(prev => prev.map(p => p.id === partner.id ? {
        ...p,
        total_orders:       Math.max(0, (p.total_orders       || 0) - 1),
        pending_commission: Math.max(0, (p.pending_commission || 0) - order.commission),
      } : p))
    }
    setOrders(prev => prev.map(o => o.id === order.id ? {...o, status: 'cancelled'} : o))
    toast.success('Order cancelled!')
  }

  async function markPaid(id: string, amount: number) {
    await supabase.from('sales_partners').update({ pending_payout: 0, total_paid: (partners.find(p=>p.id===id)?.total_paid||0)+amount }).eq('id', id)
    await supabase.from('partner_payouts').insert({ partner_id: id, amount, status: 'paid', paid_at: new Date() }).catch(()=>{})
    setPartners(prev => prev.map(p => p.id === id ? {...p, pending_payout: 0} : p))
    toast.success(`₹${amount} payout marked as paid!`)
  }

  // ✅ Approve / Reject withdrawal
  async function handleWithdrawal(w: any, action: 'approved'|'rejected') {
    await supabase.from('partner_withdrawal_requests').update({ status: action, processed_at: new Date() }).eq('id', w.id)
    if (action === 'approved') {
      const partner = partners.find(p => p.id === w.partner_id)
      if (partner) {
        await supabase.from('sales_partners').update({
          pending_payout: Math.max(0, (partner.pending_payout || 0) - w.amount),
          total_paid:     (partner.total_paid || 0) + w.amount,
        }).eq('id', w.partner_id)
        setPartners(prev => prev.map(p => p.id === w.partner_id ? {
          ...p,
          pending_payout: Math.max(0, (p.pending_payout || 0) - w.amount),
          total_paid:     (p.total_paid || 0) + w.amount,
        } : p))
      }
      toast.success(`₹${w.amount} withdrawal approved!`)
    } else {
      toast.success('Withdrawal rejected.')
    }
    setWithdrawals(prev => prev.map(x => x.id === w.id ? {...x, status: action} : x))
  }

  const totalPartners   = partners.length
  const activePartners  = partners.filter(p => p.status === 'active').length
  const totalOrdersVal  = orders.reduce((s,o) => s+(o.amount||0), 0)
  const totalCommission = orders.reduce((s,o) => s+(o.commission||0), 0)
  const pendingPayouts  = partners.reduce((s,p) => s+(p.pending_payout||0), 0)
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending')

  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  if (!mounted) return null

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>🤝 Sales Partners <span style={{ color: 'var(--gold)' }}>Manager</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>Commission tracking · Deliver orders · Payouts</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 9, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
          + Add Partner
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { l: 'Total Partners',      v: totalPartners,                                   c: 'var(--blue)',   icon: '🤝' },
          { l: 'Active',              v: activePartners,                                  c: 'var(--green)',  icon: '🟢' },
          { l: 'Partner Orders',      v: orders.length,                                   c: 'var(--teal)',   icon: '📦' },
          { l: 'Partner Revenue',     v: '₹'+totalOrdersVal.toLocaleString('en-IN'),      c: 'var(--gold)',   icon: '💰' },
          { l: 'Total Commission',    v: '₹'+totalCommission.toLocaleString('en-IN'),     c: 'var(--orange)', icon: '💸' },
          { l: 'Pending Payouts',     v: '₹'+pendingPayouts.toLocaleString('en-IN'),      c: pendingPayouts > 0 ? 'var(--red)' : 'var(--mu)', icon: '⏳' },
          { l: 'Withdraw Requests',   v: pendingWithdrawals.length,                       c: pendingWithdrawals.length > 0 ? 'var(--red)' : 'var(--mu)', icon: '💳' },
        ].map((s,i) => (
          <div key={i} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <div>
              <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9.5, color: 'var(--mu)', fontWeight: 700, textTransform: 'uppercase' }}>{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          {id:'partners',    l:'🤝 Partners'},
          {id:'orders',      l:'📦 Orders'},
          {id:'withdrawals', l:`💳 Withdrawals${pendingWithdrawals.length > 0 ? ` (${pendingWithdrawals.length})` : ''}`},
          {id:'payouts',     l:'💸 Payouts'},
          {id:'analytics',   l:'📊 Analytics'},
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: tab===t.id?'var(--gL)':'rgba(255,255,255,0.05)', color: tab===t.id?'var(--gold)':'var(--mu2)', border: '1px solid '+(tab===t.id?'rgba(212,168,83,0.3)':'var(--b1)') }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* PARTNERS TAB */}
      {tab === 'partners' && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--mu)' }}>Loading partners...</div>}
            {!loading && partners.length === 0 && (
              <div style={{ background: 'var(--s1)', border: '1px dashed var(--b2)', borderRadius: 14, padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>🤝</div>
                <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 8 }}>No Partners Yet</div>
                <button onClick={() => setShowAdd(true)} style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 9, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>+ Add First Partner</button>
              </div>
            )}
            {partners.map(p => {
              const pOrders = orders.filter(o => o.partner_id === p.id)
              return (
                <div key={p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)}
                  style={{ background: 'var(--s1)', border: '1px solid '+(selected?.id===p.id?'rgba(212,168,83,.4)':'var(--b1)'), borderRadius: 14, padding: '16px 18px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#0097A7,#005F6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Syne', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                      {(p.name||'P').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Syne', fontSize: 14.5, fontWeight: 800, marginBottom: 2 }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--mu2)', marginBottom: 6 }}>{p.business_name || 'Partner'} · {p.city} · {p.phone}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, background: p.status==='active'?'var(--grL)':'var(--rdL)', color: p.status==='active'?'var(--green)':'var(--red)', fontWeight: 700 }}>{p.status}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, background: 'var(--gL)', color: 'var(--gold)', fontWeight: 700 }}>{p.commission_pct}%</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, background: 'var(--blL)', color: 'var(--blue)', fontWeight: 700 }}>{pOrders.length} orders</span>
                        {(p.pending_commission||0) > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, background: 'var(--orL)', color: 'var(--orange)', fontWeight: 700 }}>⏳ ₹{(p.pending_commission||0).toLocaleString('en-IN')} pending</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>₹{(p.total_earnings||0).toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: 'var(--mu)' }}>Earned</div>
                      {(p.pending_payout||0) > 0 && <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700, marginTop: 3 }}>₹{(p.pending_payout||0).toLocaleString('en-IN')} to pay</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div style={{ position: 'sticky', top: 20, background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>{selected.name}</div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  ['Orders',             orders.filter(o=>o.partner_id===selected.id).length,          'var(--blue)'],
                  ['Pending Commission', '₹'+(selected.pending_commission||0).toLocaleString('en-IN'),  'var(--orange)'],
                  ['Total Earned',       '₹'+(selected.total_earnings||0).toLocaleString('en-IN'),      'var(--green)'],
                  ['Pending Payout',     '₹'+(selected.pending_payout||0).toLocaleString('en-IN'),      selected.pending_payout>0?'var(--orange)':'var(--mu)'],
                  ['Total Paid',         '₹'+(selected.total_paid||0).toLocaleString('en-IN'),          'var(--teal)'],
                  ['Commission',         selected.commission_pct+'%',                                    'var(--gold)'],
                ].map(([l,v,c],i) => (
                  <div key={i} style={{ background: 'var(--s2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 4 }}>{l as string}</div>
                    <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, color: c as string }}>{v as string}</div>
                  </div>
                ))}
              </div>

              {/* Commission slider */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>Commission Rate</span>
                  <span style={{ fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--gold)' }}>{selected.commission_pct}%</span>
                </div>
                <input type="range" min="1" max="30" defaultValue={selected.commission_pct}
                  onMouseUp={e => updateCommission(selected.id, Number((e.target as HTMLInputElement).value))}
                  style={{ width: '100%', accentColor: 'var(--gold)' }} />
              </div>

              {/* Status */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 7 }}>Status</div>
                <div style={{ display: 'flex', gap: 7 }}>
                  {['active','suspended','inactive'].map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid '+(selected.status===s?'var(--green)':'var(--b2)'), background: selected.status===s?'var(--grL)':'transparent', color: selected.status===s?'var(--green)':'var(--mu)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', textTransform: 'capitalize' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                {[['📱', selected.phone], ['✉️', selected.email], ['📍', selected.city], ['🏢', selected.business_name]].filter(([,v]) => v).map(([icon,v], i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '4px 0' }}><span>{icon}</span><span>{v as string}</span></div>
                ))}
              </div>

              {/* Login */}
              <div style={{ background: selected.user_id ? 'var(--blL)' : 'var(--orL)', border: `1px solid ${selected.user_id ? 'rgba(59,130,246,.3)' : 'rgba(249,115,22,.3)'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: selected.user_id ? 'var(--blue)' : 'var(--orange)', marginBottom: 4 }}>{selected.user_id ? '🔐 Login Active' : '⚠️ No Login'}</div>
                <button onClick={() => setCreateLoginModal(selected)} disabled={createLoading} style={{ width: '100%', padding: '9px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                  {selected.user_id ? '🔄 Reset Password' : '🔐 Create Login'}
                </button>
              </div>

              {/* Payout */}
              {(selected.pending_payout||0) > 0 && (
                <button onClick={() => markPaid(selected.id, selected.pending_payout)} style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg,#16A34A,#15803D)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit', marginBottom: 8 }}>
                  ✅ Mark ₹{(selected.pending_payout||0).toLocaleString('en-IN')} as Paid
                </button>
              )}
              {selected.phone && (
                <a href={`https://wa.me/${(selected.phone||'').replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '10px', background: 'var(--grL)', borderRadius: 9, color: 'var(--green)', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                  💬 WhatsApp Partner
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Partner Orders ({orders.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>{['Date','Partner','Customer','Amount','Commission','Status','Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {orders.map((o,i) => {
                  const partner = partners.find(p => p.id === o.partner_id)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--b1)' }}>
                      <td style={{ padding: '9px 14px', fontSize: 11.5 }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—'}</td>
                      <td style={{ padding: '9px 14px', fontWeight: 600, fontSize: 12.5 }}>{partner?.name||'—'}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{o.customer_name||'—'}</div>
                        {o.customer_phone && <div style={{ fontSize: 10, color: 'var(--mu)' }}>{o.customer_phone}</div>}
                      </td>
                      <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--teal)' }}>₹{(o.amount||0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ fontFamily: 'DM Mono', fontWeight: 700, color: o.status==='delivered'?'var(--green)':o.status==='cancelled'?'var(--red)':'var(--orange)' }}>₹{(o.commission||0).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: 9.5, color: o.status==='delivered'?'var(--green)':o.status==='cancelled'?'var(--red)':'var(--orange)' }}>{o.status==='delivered'?'earned':o.status==='cancelled'?'cancelled':'pending'}</div>
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, background: o.status==='delivered'?'var(--grL)':o.status==='cancelled'?'var(--rdL)':'var(--blL)', color: o.status==='delivered'?'var(--green)':o.status==='cancelled'?'var(--red)':'var(--blue)', fontWeight: 700 }}>{o.status||'new'}</span>
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {o.status === 'new' && (
                            <>
                              <button onClick={() => markDelivered(o)} style={{ padding: '5px 10px', background: 'var(--grL)', border: 'none', borderRadius: 6, color: 'var(--green)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>✅ Delivered</button>
                              <button onClick={() => markCancelled(o)} style={{ padding: '5px 10px', background: 'var(--rdL)', border: 'none', borderRadius: 6, color: 'var(--red)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>✕ Cancel</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {orders.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No partner orders yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WITHDRAWALS TAB */}
      {tab === 'withdrawals' && (
        <div>
          {pendingWithdrawals.length > 0 && (
            <div style={{ background: 'var(--orL)', border: '1px solid rgba(249,115,22,.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>{pendingWithdrawals.length} pending withdrawal request{pendingWithdrawals.length>1?'s':''} — action required!</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {withdrawals.map((w, i) => {
              const partner = partners.find(p => p.id === w.partner_id)
              return (
                <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#0097A7,#005F6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Syne', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                    {(partner?.name||'P').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>{partner?.name || 'Partner'}</div>
                    <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>UPI: {w.upi_id} · {w.upi_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{new Date(w.created_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 16 }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: 'var(--teal)' }}>₹{(w.amount||0).toLocaleString('en-IN')}</div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: w.status==='approved'?'var(--grL)':w.status==='rejected'?'var(--rdL)':'var(--orL)', color: w.status==='approved'?'var(--green)':w.status==='rejected'?'var(--red)':'var(--orange)' }}>
                      {w.status}
                    </span>
                  </div>
                  {w.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleWithdrawal(w, 'approved')} style={{ padding: '9px 16px', background: 'linear-gradient(135deg,#16A34A,#15803D)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>✅ Approve</button>
                      <button onClick={() => handleWithdrawal(w, 'rejected')} style={{ padding: '9px 16px', background: 'var(--rdL)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: 'var(--red)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>✕ Reject</button>
                    </div>
                  )}
                </div>
              )
            })}
            {withdrawals.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>💳</div>
                <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>No withdrawal requests yet</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYOUTS TAB */}
      {tab === 'payouts' && (
        <div>
          {pendingPayouts > 0 && (
            <div style={{ background: 'var(--orL)', border: '1px solid rgba(249,115,22,.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>⏳</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>₹{pendingPayouts.toLocaleString('en-IN')} pending payouts</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {partners.filter(p => (p.pending_payout||0) > 0).map(p => (
              <div key={p.id} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#D4A853,#B87C30)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#08090C', fontFamily: 'Syne', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                  {(p.name||'P').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--mu2)' }}>{p.business_name} · {p.city} · {p.phone}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 3 }}>{p.commission_pct}% commission</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: 'var(--orange)' }}>₹{(p.pending_payout||0).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 8 }}>Pending</div>
                  <button onClick={() => markPaid(p.id, p.pending_payout)} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#16A34A,#15803D)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>
                    ✅ Mark Paid
                  </button>
                </div>
              </div>
            ))}
            {partners.filter(p => (p.pending_payout||0) > 0).length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
                <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>All payouts up to date!</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>🏆 Top Partners by Revenue</div>
              {[...partners].sort((a,b) => (b.total_earnings||0)-(a.total_earnings||0)).slice(0,8).map((p,i) => {
                const maxE = partners.reduce((m,x) => Math.max(m,x.total_earnings||0), 1)
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'Syne', fontWeight: 800, color: i<3?'var(--gold)':'var(--mu)', fontSize: 11 }}>#{i+1}</span>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                      </div>
                      <span style={{ fontFamily: 'DM Mono', color: 'var(--green)', fontWeight: 700 }}>₹{(p.total_earnings||0).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round((p.total_earnings||0)/maxE*100)+'%', background: 'var(--green)', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
              {partners.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No partners</div>}
            </div>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>📦 Orders by Partner</div>
              {[...partners].sort((a,b) => orders.filter(o=>o.partner_id===b.id).length - orders.filter(o=>o.partner_id===a.id).length).slice(0,8).map((p,i) => {
                const cnt = orders.filter(o => o.partner_id===p.id).length
                const maxC = Math.max(...partners.map(x => orders.filter(o=>o.partner_id===x.id).length), 1)
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontFamily: 'DM Mono', color: 'var(--blue)', fontWeight: 700 }}>{cnt} orders</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(cnt/maxC*100)+'%', background: 'var(--blue)', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
            {[
              { l: 'Avg Commission %', v: partners.length>0?(partners.reduce((s,p)=>s+(p.commission_pct||0),0)/partners.length).toFixed(1)+'%':'—', c: 'var(--gold)' },
              { l: 'Avg Order Value',  v: orders.length>0?'₹'+Math.round(totalOrdersVal/orders.length).toLocaleString('en-IN'):'—',               c: 'var(--teal)' },
              { l: 'Total Paid Out',   v: '₹'+partners.reduce((s,p)=>s+(p.total_paid||0),0).toLocaleString('en-IN'),                               c: 'var(--green)' },
              { l: 'Pending Payouts',  v: '₹'+pendingPayouts.toLocaleString('en-IN'),                                                               c: pendingPayouts>0?'var(--orange)':'var(--mu)' },
            ].map((s,i) => (
              <div key={i} className="card">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>{s.l}</div>
                <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD PARTNER MODAL */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 28px', width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Sales Partner</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{k:'name',l:'Full Name *',p:'Priya Salon'},{k:'phone',l:'Phone *',p:'+91 9876543210'},{k:'email',l:'Email *',p:'partner@salon.com'},{k:'business_name',l:'Business Name',p:'Priya Beauty Parlor'},{k:'city',l:'City',p:'Indore'}].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                  <input value={(form as any)[f.k]} onChange={e => setForm(p => ({...p, [f.k]: e.target.value}))} placeholder={f.p} style={inp} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Commission % (1-30)</label>
                <input type="number" min="1" max="30" value={form.commission_pct} onChange={e => setForm(p => ({...p, commission_pct: Number(e.target.value)}))} style={inp} />
              </div>
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2} placeholder="Any notes..." style={{ ...inp, resize: 'none' }} />
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addPartner} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Partner + Create Login</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE LOGIN MODAL */}
      {createLoginModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '28px 32px', width: 400, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Create / Reset Login</div>
            <div style={{ fontSize: 13, color: 'var(--mu2)', marginBottom: 20 }}><strong>{createLoginModal.name}</strong> ke liye login create/reset karna chahte ho?</div>
            <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{createLoginModal.email}</div>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setCreateLoginModal(null)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={() => createPartnerLogin(createLoginModal)} disabled={createLoading} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                {createLoading ? 'Creating...' : 'Create Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREDENTIALS MODAL */}
      {createdCreds && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '28px 32px', width: 420, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 6, color: 'var(--green)' }}>✅ Login Created!</div>
            <div style={{ background: 'var(--s2)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Login URL</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'DM Mono', color: 'var(--blue)' }}>manage.rabtnaturals.com</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Email</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'DM Mono', color: 'var(--teal)' }}>{createdCreds.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Password</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'DM Mono', color: 'var(--gold)', letterSpacing: 2 }}>{createdCreds.password}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
              <button onClick={() => { navigator.clipboard.writeText(`Rabt Partner Portal\nURL: manage.rabtnaturals.com\nEmail: ${createdCreds.email}\nPassword: ${createdCreds.password}`); toast.success('Copied!') }} style={{ flex: 1, padding: 10, background: 'var(--blL)', border: '1px solid rgba(59,130,246,.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>📋 Copy</button>
              <button onClick={() => window.open('https://wa.me/?text='+encodeURIComponent(`🌿 Rabt Partner Portal Login\n\n🔗 URL: manage.rabtnaturals.com\n📧 Email: ${createdCreds.email}\n🔑 Password: ${createdCreds.password}`), '_blank')} style={{ flex: 1, padding: 10, background: 'var(--grL)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>💬 WhatsApp</button>
            </div>
            <button onClick={() => { setCreatedCreds(null); loadAll() }} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}