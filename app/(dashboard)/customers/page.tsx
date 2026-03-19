'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  website:     { label: 'Website',    color: 'var(--green)',  bg: 'var(--grL)' },
  hq:          { label: 'HQ',         color: 'var(--blue)',   bg: 'var(--blL)' },
  partner:     { label: 'Partner',    color: 'var(--orange)', bg: 'var(--orL)' },
  sales_partner: { label: 'Partner',  color: 'var(--orange)', bg: 'var(--orL)' },
  specialist:  { label: 'Specialist', color: 'var(--purple)', bg: 'rgba(139,92,246,0.12)' },
  specialist_offline: { label: 'Specialist', color: 'var(--purple)', bg: 'rgba(139,92,246,0.12)' },
}

function getSource(order: any): string {
  return (order.source || order.orderSource || 'website').toLowerCase()
}

function getSourceConfig(src: string) {
  return SOURCE_CONFIG[src] || SOURCE_CONFIG['website']
}

export default function CustomersPage() {
  const [orders, setOrders]             = useState<any[]>([])
  const [users, setUsers]               = useState<any[]>([])
  const [skinProfiles, setSkinProfiles] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<'overview'|'customers'|'analytics'|'skin'>('overview')
  const [search, setSearch]             = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [mounted, setMounted]           = useState(false)

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const url = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null
      if (!url) { setLoading(false); return }
      const [ordRes, skinRes, userRes] = await Promise.all([
        fetch(url + '/api/orders').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/skinprofiles').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/users').then(r => r.ok ? r.json() : []),
      ])
      setOrders(Array.isArray(ordRes) ? ordRes : [])
      setSkinProfiles(Array.isArray(skinRes) ? skinRes : [])
      setUsers(Array.isArray(userRes) ? userRes : [])
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  // Build customer map from orders
  const customerMap: Record<string, any> = {}

  // Add registered users first
  users.forEach(u => {
    const phone = u.phoneNumber || u.phone || ''
    const key = phone || u.email || u._id?.toString()
    if (!key) return
    if (!customerMap[key]) {
      customerMap[key] = {
        name: (u.firstName && u.lastName) ? u.firstName + ' ' + u.lastName : u.firstName || u.name || 'User',
        phone,
        email: u.email || '',
        city: u.city || u.address?.city || '',
        state: u.state || u.address?.state || '',
        orders: [],
        sources: new Set<string>(['website']),
        totalSpent: 0,
        skinProfile: null,
        isRegistered: true,
      }
    }
  })
  orders.forEach(o => {
    const phone = o.customerPhone || o.shippingAddress?.contactPhone || ''
    const key = phone || o.customerName || o._id
    if (!key) return
    if (!customerMap[key]) {
      customerMap[key] = {
        name: o.customerName || o.shippingAddress?.contactName || 'Customer',
        phone,
        email: o.customerEmail || o.pendingShiprocketData?.billing_email || '',
        city: o.city || o.shippingAddress?.city || '',
        state: o.state || o.shippingAddress?.state || '',
        orders: [],
        sources: new Set<string>(),
        totalSpent: 0,
        skinProfile: null,
      }
    }
    customerMap[key].orders.push(o)
    customerMap[key].sources.add(getSource(o))
    customerMap[key].totalSpent += o.amount || 0
  })

  // Attach skin profiles
  skinProfiles.forEach(sp => {
    const phone = sp.phone || sp.customerPhone || ''
    if (phone && customerMap[phone]) {
      customerMap[phone].skinProfile = sp
    }
  })

  const allCustomers = Object.values(customerMap)

  // Stats
  const registeredUsers   = users.length
  const totalCustomers    = allCustomers.length
  const websiteCustomers  = allCustomers.filter(c => [...c.sources].some(s => s === 'website')).length
  const hqCustomers       = allCustomers.filter(c => [...c.sources].some(s => s === 'hq')).length
  const partnerCustomers  = allCustomers.filter(c => [...c.sources].some(s => s === 'partner' || s === 'sales_partner')).length
  const specialistCustomers = allCustomers.filter(c => [...c.sources].some(s => s === 'specialist' || s === 'specialist_offline')).length
  const withSkinProfile   = allCustomers.filter(c => c.skinProfile).length
  const repeatCustomers   = allCustomers.filter(c => c.orders.length > 1).length

  // Filtered customers
  const filtered = allCustomers.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.city?.toLowerCase().includes(search.toLowerCase())
    const matchSource = sourceFilter === 'all' || [...c.sources].some(s => {
      if (sourceFilter === 'partner') return s === 'partner' || s === 'sales_partner'
      if (sourceFilter === 'specialist') return s === 'specialist' || s === 'specialist_offline'
      return s === sourceFilter
    })
    return matchSearch && matchSource
  })

  // Analytics
  const sourceBreakdown = [
    { label: 'Website',    count: websiteCustomers,    color: 'var(--green)' },
    { label: 'HQ',         count: hqCustomers,         color: 'var(--blue)'  },
    { label: 'Partner',    count: partnerCustomers,    color: 'var(--orange)' },
    { label: 'Specialist', count: specialistCustomers, color: 'var(--purple)' },
  ]

  // City breakdown
  const cityMap: Record<string, number> = {}
  allCustomers.forEach(c => { if (c.city) cityMap[c.city] = (cityMap[c.city] || 0) + 1 })
  const topCities = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 8)

  // Skin concern breakdown
  const concernMap: Record<string, number> = {}
  skinProfiles.forEach(sp => {
    (sp.concerns || sp.skinConcerns || []).forEach((c: string) => {
      concernMap[c] = (concernMap[c] || 0) + 1
    })
  })
  const topConcerns = Object.entries(concernMap).sort((a, b) => b[1] - a[1]).slice(0, 6)

  function generateSkinPDF(customer: any) {
    const sp = customer.skinProfile
    if (!sp) { toast.error('No skin profile found'); return }
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>Skin Profile - ${customer.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #111; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 3px solid #0097A7; margin-bottom: 24px; }
        .brand { font-size: 22px; font-weight: 900; color: #0097A7; }
        .section { font-size: 13px; font-weight: 800; color: #0097A7; text-transform: uppercase; letter-spacing: 0.1em; margin: 20px 0 10px; }
        .card { background: #f0fafa; border-radius: 10px; padding: 16px; margin-bottom: 14px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .label { font-size: 10px; font-weight: 700; color: #666; text-transform: uppercase; margin-bottom: 4px; }
        .value { font-size: 14px; font-weight: 600; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; background: #e0f7fa; color: #0097A7; font-size: 11px; font-weight: 700; margin: 2px; }
        .score { font-size: 48px; font-weight: 900; color: #0097A7; }
        .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #999; }
      </style></head><body>
      <div class="header">
        <div class="brand">rabt NATURALS</div>
        <div style="font-size:13px;color:#666;margin-top:4px">Personalized Skin Profile Report</div>
        <div style="font-size:12px;color:#999;margin-top:2px">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>

      <div class="section">Customer Details</div>
      <div class="card grid">
        <div><div class="label">Name</div><div class="value">${customer.name}</div></div>
        <div><div class="label">Phone</div><div class="value">${customer.phone || '—'}</div></div>
        <div><div class="label">City</div><div class="value">${customer.city || '—'}</div></div>
        <div><div class="label">Total Orders</div><div class="value">${customer.orders.length}</div></div>
      </div>

      <div class="section">Skin Analysis</div>
      <div class="card" style="display:flex;gap:20px;align-items:center">
        <div style="text-align:center">
          <div class="score">${sp.skinScore || '—'}</div>
          <div style="font-size:11px;color:#666">/100 Skin Score</div>
        </div>
        <div style="flex:1">
          <div class="label">Skin Type</div>
          <div class="value" style="margin-bottom:8px">${sp.skinType || '—'}</div>
          <div class="label">Skin Category</div>
          <div class="value">${sp.skinCategory || '—'}</div>
        </div>
      </div>

      ${sp.concerns?.length || sp.skinConcerns?.length ? `
      <div class="section">Skin Concerns</div>
      <div class="card">
        ${(sp.concerns || sp.skinConcerns || []).map((c: string) => `<span class="badge">${c}</span>`).join('')}
      </div>` : ''}

      ${sp.skinSummary ? `
      <div class="section">AI Analysis</div>
      <div class="card">
        <p style="font-size:13px;line-height:1.7;color:#333;margin:0">${sp.skinSummary}</p>
      </div>` : ''}

      ${sp.recommendedRange ? `
      <div class="section">Recommended Range</div>
      <div class="card" style="background:#e8f5e9">
        <div style="font-size:18px;font-weight:800;color:#2e7d32">${sp.recommendedRange}</div>
        ${sp.specialistNote ? `<p style="font-size:12px;color:#444;margin-top:8px">${sp.specialistNote}</p>` : ''}
      </div>` : ''}

      ${customer.orders.length > 0 ? `
      <div class="section">Order History</div>
      <div class="card">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr style="border-bottom:2px solid #ddd">
            <th style="text-align:left;padding:6px">Order #</th>
            <th style="text-align:left;padding:6px">Products</th>
            <th style="text-align:right;padding:6px">Amount</th>
            <th style="text-align:left;padding:6px">Status</th>
          </tr>
          ${customer.orders.slice(0,5).map((o: any) => `
            <tr style="border-bottom:1px solid #eee">
              <td style="padding:6px;color:#0097A7;font-weight:700">${o.orderNumber || o._id?.toString().slice(-6) || '—'}</td>
              <td style="padding:6px;color:#555">${o.products || o.items?.[0]?.productSnapshot?.name || '—'}</td>
              <td style="padding:6px;text-align:right;font-weight:700">₹${o.amount || 0}</td>
              <td style="padding:6px"><span style="background:#e0f7fa;color:#0097A7;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${o.status || o.orderStatus || '—'}</span></td>
            </tr>`).join('')}
        </table>
      </div>` : ''}

      <div class="footer">Rabt Naturals · rabtnaturals.com · support@rabtnaturals.in<br>AI-powered personalized skincare</div>
      </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  const inp: any = { background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', width: '100%' }

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Customer <span style={{ color: 'var(--teal)' }}>Intelligence</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{totalCustomers} total customers · {withSkinProfile} with skin profiles · {repeatCustomers} repeat buyers</p>
        </div>
        <button onClick={loadAll} style={{ padding: '8px 16px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'overview',   l: '📊 Overview' },
          { id: 'customers',  l: '👥 All Customers' },
          { id: 'analytics',  l: '📈 Analytics' },
          { id: 'skin',       l: '🌿 Skin Profiles' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid ' + (tab === t.id ? 'rgba(0,151,167,0.3)' : 'var(--b1)'),
            background: tab === t.id ? 'rgba(0,151,167,0.1)' : 'var(--s2)',
            color: tab === t.id ? 'var(--teal)' : 'var(--mu2)',
            fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit'
          }}>{t.l}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>Loading customers...</div>}

      {!loading && (
        <>
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Total Customers', value: totalCustomers,        color: 'var(--teal)',   icon: '👥' },
                  { label: 'Website',          value: websiteCustomers,      color: 'var(--green)',  icon: '🌐' },
                  { label: 'HQ Orders',        value: hqCustomers,           color: 'var(--blue)',   icon: '🏢' },
                  { label: 'Partner',          value: partnerCustomers,      color: 'var(--orange)', icon: '🤝' },
                  { label: 'Specialist',       value: specialistCustomers,   color: 'var(--purple)', icon: '🌿' },
                  { label: 'Skin Profiles',    value: withSkinProfile,       color: 'var(--teal)',   icon: '✨' },
                  { label: 'Repeat Buyers',    value: repeatCustomers,       color: 'var(--gold)',   icon: '⭐' },
                  { label: 'Total Revenue', value: '₹' + allCustomers.reduce((s, c) => s + c.totalSpent, 0).toLocaleString('en-IN'), color: 'var(--green)', icon: '💰' },
                ].map((s, i) => (
                  <div key={i} className="card" style={{ minHeight: 110, gridColumn: s.label === "Total Revenue" ? "span 2" : "span 1" }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Syne', fontSize: s.label === 'Total Revenue' ? 18 : 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Source breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div className="card">
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>Customers by Source</div>
                  {sourceBreakdown.map((s, i) => {
                    const pct = Math.round(s.count / (totalCustomers || 1) * 100)
                    return (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{s.label}</span>
                          <span style={{ fontFamily: 'DM Mono', color: s.color }}>{s.count} ({pct}%)</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', background: s.color, borderRadius: 4, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="card">
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>Top Cities</div>
                  {topCities.map(([city, count], i) => {
                    const pct = Math.round(count / (totalCustomers || 1) * 100)
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600 }}>{city}</span>
                          <span style={{ fontFamily: 'DM Mono', color: 'var(--teal)' }}>{count}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: pct + '%', background: 'var(--teal)', borderRadius: 3 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent customers */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Recent Customers</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Customer', 'Phone', 'City', 'Orders', 'Spent', 'Source', 'Skin Profile'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {allCustomers.slice(0, 10).map((c, i) => (
                      <tr key={i} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseOut={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '9px 12px', fontWeight: 600, fontSize: 13 }}>{c.name}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12, fontFamily: 'DM Mono', color: 'var(--mu2)' }}>{c.phone || '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--mu2)' }}>{c.city || '—'}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--teal)' }}>{c.orders.length}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--green)' }}>₹{c.totalSpent.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '9px 12px' }}>
                          {[...c.sources].map((src, si) => {
                            const cfg = getSourceConfig(src)
                            return <span key={si} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontWeight: 700, marginRight: 3 }}>{cfg.label}</span>
                          })}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          {c.skinProfile
                            ? <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(0,151,167,0.1)', color: 'var(--teal)', fontWeight: 700 }}>✓ Available</span>
                            : <span style={{ fontSize: 10, color: 'var(--mu)' }}>—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ALL CUSTOMERS */}
          {tab === 'customers' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, city..." style={{ ...inp, width: 260 }} />
                <span style={{ fontSize: 11, color: 'var(--mu)' }}>Source:</span>
                {[
                  { id: 'all',        l: 'All' },
                  { id: 'website',    l: 'Website' },
                  { id: 'hq',         l: 'HQ' },
                  { id: 'partner',    l: 'Partner' },
                  { id: 'specialist', l: 'Specialist' },
                ].map(s => (
                  <span key={s.id} onClick={() => setSourceFilter(s.id)} style={{
                    padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: sourceFilter === s.id ? 'rgba(0,151,167,0.15)' : 'rgba(255,255,255,0.05)',
                    color: sourceFilter === s.id ? 'var(--teal)' : 'var(--mu2)',
                    border: '1px solid ' + (sourceFilter === s.id ? 'rgba(0,151,167,0.3)' : 'var(--b1)')
                  }}>{s.l}</span>
                ))}
                <span style={{ fontSize: 11, color: 'var(--mu)', marginLeft: 'auto' }}>{filtered.length} customers</span>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Customer', 'Phone', 'City/State', 'Orders', 'Total Spent', 'Source', 'Skin Profile', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr key={i} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseOut={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                          {c.orders.length > 1 && <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2 }}>⭐ Repeat buyer</div>}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'DM Mono', color: 'var(--mu2)' }}>{c.phone || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--mu2)' }}>{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--teal)' }}>{c.orders.length}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--green)' }}>₹{c.totalSpent.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {[...c.sources].map((src, si) => {
                            const cfg = getSourceConfig(src)
                            return <span key={si} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontWeight: 700, marginRight: 3 }}>{cfg.label}</span>
                          })}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {c.skinProfile ? (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)' }}>{c.skinProfile.skinType || '—'}</div>
                              {c.skinProfile.skinScore && <div style={{ fontSize: 10, color: 'var(--mu)' }}>Score: {c.skinProfile.skinScore}/100</div>}
                            </div>
                          ) : <span style={{ fontSize: 11, color: 'var(--mu)' }}>No profile</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {c.skinProfile && (
                            <button onClick={() => generateSkinPDF(c)} style={{ padding: '5px 10px', background: 'var(--gL)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 6, color: 'var(--gold)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                              📄 PDF
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No customers found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ANALYTICS */}
          {tab === 'analytics' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Source breakdown */}
              <div className="card">
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>Customer Source Split</div>
                {sourceBreakdown.map((s, i) => {
                  const pct = Math.round(s.count / (totalCustomers || 1) * 100)
                  return (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: s.color }}>{s.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 10, background: 'var(--s2)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: s.color, borderRadius: 5, transition: 'width 0.6s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Top cities */}
              <div className="card">
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>Top Cities</div>
                {topCities.map(([city, count], i) => {
                  const pct = Math.round(count / (totalCustomers || 1) * 100)
                  const maxCount = topCities[0]?.[1] || 1
                  return (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{city}</span>
                        <span style={{ fontFamily: 'DM Mono', color: 'var(--teal)' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: Math.round(count / maxCount * 100) + '%', background: 'var(--teal)', borderRadius: 4 }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Skin concerns */}
              {topConcerns.length > 0 && (
                <div className="card">
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>Top Skin Concerns</div>
                  {topConcerns.map(([concern, count], i) => {
                    const maxCount = topConcerns[0]?.[1] || 1
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600 }}>{concern}</span>
                          <span style={{ fontFamily: 'DM Mono', color: 'var(--purple)' }}>{count}</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: Math.round(count / maxCount * 100) + '%', background: 'var(--purple)', borderRadius: 4 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Repeat vs new */}
              <div className="card">
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>Buyer Type</div>
                {[
                  { label: 'New Buyers',    count: totalCustomers - repeatCustomers, color: 'var(--blue)'  },
                  { label: 'Repeat Buyers', count: repeatCustomers,                  color: 'var(--gold)'  },
                  { label: 'With Skin Profile', count: withSkinProfile,              color: 'var(--teal)'  },
                ].map((s, i) => {
                  const pct = Math.round(s.count / (totalCustomers || 1) * 100)
                  return (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: s.color }}>{s.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 10, background: 'var(--s2)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: s.color, borderRadius: 5 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* SKIN PROFILES */}
          {tab === 'skin' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--mu)' }}>{withSkinProfile} customers with skin profiles</div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer..." style={{ ...inp, width: 220 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {allCustomers.filter(c => c.skinProfile && (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))).map((c, i) => {
                  const sp = c.skinProfile
                  return (
                    <div key={i} className="card" style={{ border: '1px solid rgba(0,151,167,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{c.phone}</div>
                        </div>
                        {sp.skinScore && (
                          <div style={{ textAlign: 'center', background: 'rgba(0,151,167,0.1)', borderRadius: 8, padding: '4px 10px' }}>
                            <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: 'var(--teal)' }}>{sp.skinScore}</div>
                            <div style={{ fontSize: 9, color: 'var(--mu)' }}>/100</div>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <div style={{ background: 'var(--s2)', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>Skin Type</div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{sp.skinType || '—'}</div>
                        </div>
                        <div style={{ background: 'var(--s2)', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>Category</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>{sp.skinCategory || '—'}</div>
                        </div>
                      </div>

                      {(sp.concerns || sp.skinConcerns || []).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Concerns</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(sp.concerns || sp.skinConcerns || []).slice(0, 3).map((concern: string, ci: number) => (
                              <span key={ci} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--rdL)', color: 'var(--red)', fontWeight: 600 }}>{concern}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {sp.recommendedRange && (
                        <div style={{ background: 'rgba(0,151,167,0.08)', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 2 }}>Recommended</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>{sp.recommendedRange}</div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--mu)' }}>{c.orders.length} orders · ₹{c.totalSpent.toLocaleString('en-IN')}</span>
                        <button onClick={() => generateSkinPDF(c)} style={{ padding: '6px 12px', background: 'linear-gradient(135deg,#0097A7,#005F6A)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                          📄 Download PDF
                        </button>
                      </div>
                    </div>
                  )
                })}

                {allCustomers.filter(c => c.skinProfile).length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--mu)' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🌿</div>
                    <div style={{ fontSize: 14 }}>No skin profiles yet</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
