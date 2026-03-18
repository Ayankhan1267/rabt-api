'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ── GST HELPERS ────────────────────────────────────────
function gstFromTotal(total: number, rate: number) { return Math.round((total * rate) / (100 + rate)) }
function netFromTotal(total: number, rate: number) { return total - gstFromTotal(total, rate) }
function cgst(total: number, rate: number) { return Math.round(gstFromTotal(total, rate) / 2) }
function sgst(total: number, rate: number) { return Math.round(gstFromTotal(total, rate) / 2) }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const REPORT_TYPES = [
  { id: 'sales',    label: '📦 Sales Report',           desc: 'Order-wise with GST breakup' },
  { id: 'gst',      label: '🧾 GST Summary',             desc: 'GSTR-1 ready monthly format' },
  { id: 'product',  label: '🧴 Product Sales',           desc: 'Top products by revenue & units' },
  { id: 'customer', label: '👥 Customer Report',         desc: 'Customer-wise purchase history' },
  { id: 'state',    label: '📍 State-wise Sales',        desc: 'Revenue breakdown by state' },
  { id: 'payment',  label: '💳 Payment Report',          desc: 'COD vs Prepaid breakdown' },
  { id: 'returns',  label: '↩️ Returns & Cancellations', desc: 'Cancelled & RTO orders' },
]

const DEFAULT_SETTINGS = {
  companyName: 'Rabt Naturals',
  gstin: '',
  address: 'Indore, Madhya Pradesh',
  email: 'support@rabtnaturals.in',
  phone: '+91-7400070127',
  gstRate: 18,
  hsnCode: '3304',
  cgstRate: 9,
  sgstRate: 9,
  showLogo: true,
  currency: '₹',
  financialYearStart: 4, // April
}

export default function ReportsPage() {
  const [orders, setOrders]           = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [mounted, setMounted]         = useState(false)
  const [reportType, setReportType]   = useState('sales')
  const [activeTab, setActiveTab]     = useState<'report'|'settings'>('report')
  const [dateFrom, setDateFrom]       = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [dateTo, setDateTo]           = useState(() => new Date().toISOString().split('T')[0])
  const [quickRange, setQuickRange]   = useState('this_month')
  const [settings, setSettings]       = useState(DEFAULT_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)
  const [generating, setGenerating]   = useState(false)

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    // Load settings from Supabase
    try {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'report_settings').single()
      if (data?.value) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(data.value) })
    } catch {}
    // Load orders from MongoDB
    const url = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null
    if (url) {
      try {
        const res = await fetch(url + '/api/orders')
        if (res.ok) { const d = await res.json(); setOrders(Array.isArray(d) ? d : []) }
      } catch {}
    }
    setLoading(false)
  }

  async function saveSettings() {
    setSavingSettings(true)
    await supabase.from('app_settings').upsert({ key: 'report_settings', value: JSON.stringify(settings) })
    toast.success('Settings saved!')
    setSavingSettings(false)
  }

  function applyQuickRange(range: string) {
    setQuickRange(range)
    const now = new Date()
    let from = new Date(), to = new Date()
    switch(range) {
      case 'today':        from = new Date(now); break
      case 'yesterday':    from = new Date(now); from.setDate(from.getDate()-1); to = new Date(from); break
      case 'this_week':    from = new Date(now); from.setDate(from.getDate()-from.getDay()); break
      case 'last_week':    from = new Date(now); from.setDate(from.getDate()-from.getDay()-7); to = new Date(now); to.setDate(to.getDate()-to.getDay()-1); break
      case 'this_month':   from = new Date(now.getFullYear(), now.getMonth(), 1); break
      case 'last_month':   from = new Date(now.getFullYear(), now.getMonth()-1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); break
      case 'q1':           from = new Date(now.getFullYear(), 3, 1); to = new Date(now.getFullYear(), 5, 30); break
      case 'q2':           from = new Date(now.getFullYear(), 6, 1); to = new Date(now.getFullYear(), 8, 30); break
      case 'q3':           from = new Date(now.getFullYear(), 9, 1); to = new Date(now.getFullYear(), 11, 31); break
      case 'q4':           from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear(), 2, 31); break
      case 'this_year':    from = new Date(now.getFullYear(), 0, 1); break
      case 'fy':           { const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1; from = new Date(fy, 3, 1); to = new Date(fy+1, 2, 31); break }
      case 'all':          from = new Date('2020-01-01'); break
    }
    setDateFrom(from.toISOString().split('T')[0])
    setDateTo(to.toISOString().split('T')[0])
  }

  // ── FILTERED DATA ──
  const filtered = orders.filter(o => {
    if (!o.createdAt) return false
    const d = new Date(o.createdAt)
    return d >= new Date(dateFrom+'T00:00:00') && d <= new Date(dateTo+'T23:59:59')
  })
  const delivered   = filtered.filter(o => ['delivered','DELIVERED'].includes(o.status||o.orderStatus||''))
  const cancelled   = filtered.filter(o => ['cancelled','canceled','rto','returned'].includes((o.status||o.orderStatus||'').toLowerCase()))
  const codOrders   = delivered.filter(o => (o.paymentMethod||'').toLowerCase().includes('cod'))
  const prepaidOrd  = delivered.filter(o => !(o.paymentMethod||'').toLowerCase().includes('cod'))
  const R = settings.gstRate

  const grossRevenue  = delivered.reduce((s,o) => s+(o.amount||0), 0)
  const totalGST      = gstFromTotal(grossRevenue, R)
  const totalCGST     = cgst(grossRevenue, R)
  const totalSGST     = sgst(grossRevenue, R)
  const netRevenue    = netFromTotal(grossRevenue, R)
  const cancelledVal  = cancelled.reduce((s,o) => s+(o.amount||0), 0)

  // Product map
  const productMap: Record<string, {units:number,revenue:number,orders:number}> = {}
  delivered.forEach(o => (o.items||[]).forEach((item: any) => {
    const n = item.name||'Unknown'
    if (!productMap[n]) productMap[n] = {units:0,revenue:0,orders:0}
    productMap[n].units   += item.quantity||1
    productMap[n].revenue += (item.price||0)*(item.quantity||1)
    productMap[n].orders++
  }))
  const topProducts = Object.entries(productMap).sort((a,b) => b[1].revenue-a[1].revenue)

  // State map
  const stateMap: Record<string, {orders:number,revenue:number,gst:number}> = {}
  delivered.forEach(o => {
    const st = o.state||o.shippingAddress?.state||'Unknown'
    if (!stateMap[st]) stateMap[st] = {orders:0,revenue:0,gst:0}
    stateMap[st].orders++; stateMap[st].revenue += o.amount||0
    stateMap[st].gst += gstFromTotal(o.amount||0, R)
  })
  const topStates = Object.entries(stateMap).sort((a,b) => b[1].revenue-a[1].revenue)

  // Monthly
  const monthlyMap: Record<string, {gross:number,net:number,orders:number}> = {}
  delivered.forEach(o => {
    const d = new Date(o.createdAt)
    const key = MONTHS[d.getMonth()]+' '+d.getFullYear()
    if (!monthlyMap[key]) monthlyMap[key] = {gross:0,net:0,orders:0}
    monthlyMap[key].gross  += o.amount||0
    monthlyMap[key].net    += netFromTotal(o.amount||0, R)
    monthlyMap[key].orders++
  })
  const monthlyData = Object.entries(monthlyMap).slice(-12)
  const maxMonthly  = Math.max(...monthlyData.map(([,d])=>d.gross), 1)

  // ── CSV EXPORT ──
  function downloadCSV(rows: string[][], filename: string) {
    const csv = rows.map(r => r.map(c => `"${(c||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename })
    a.click(); toast.success('CSV downloaded!')
  }

  function handleCSVExport() {
    const period = `${dateFrom}_${dateTo}`
    switch(reportType) {
      case 'sales': {
        const h = ['Order No','Date','Customer','Phone','City','State','Products','Payment','Status',`Gross (${settings.currency})`,`GST ${R}% (${settings.currency})`,`CGST ${R/2}% (${settings.currency})`,`SGST ${R/2}% (${settings.currency})`,`Net (${settings.currency})`,'HSN Code']
        const rows = filtered.map(o => {
          const g = o.amount||0, tax = gstFromTotal(g,R)
          return [o.orderNumber||o._id, new Date(o.createdAt).toLocaleDateString('en-IN'), o.customerName||'', o.customerPhone||'', o.city||'', o.state||'', o.products||'', o.paymentMethod||'', o.status||'', g, tax, Math.round(tax/2), Math.round(tax/2), g-tax, settings.hsnCode]
        })
        downloadCSV([h, ...rows.map(r=>r.map(String))], `sales_${period}.csv`); break
      }
      case 'gst': {
        const h = ['Month','Orders',`Gross (${settings.currency})`,`Taxable Value (${settings.currency})`,`CGST ${R/2}% (${settings.currency})`,`SGST ${R/2}% (${settings.currency})`,`Total GST (${settings.currency})`,'HSN Code']
        const rows = Object.entries(monthlyMap).sort().map(([mo, d]) => {
          const tax = gstFromTotal(d.gross, R)
          return [mo, d.orders, d.gross, d.gross-tax, Math.round(tax/2), Math.round(tax/2), tax, settings.hsnCode]
        })
        const total = ['TOTAL', delivered.length, grossRevenue, netRevenue, totalCGST, totalSGST, totalGST, '']
        downloadCSV([h, ...rows.map(r=>r.map(String)), [], total.map(String)], `gst_${period}.csv`); break
      }
      case 'product': {
        const h = ['Product','Units Sold','Orders',`Revenue (${settings.currency})`,`GST (${settings.currency})`,`Net (${settings.currency})`,`Avg Price (${settings.currency})`,'% of Total','HSN Code']
        const rows = topProducts.map(([n,d]) => {
          const tax = gstFromTotal(d.revenue,R)
          return [n, d.units, d.orders, d.revenue, tax, d.revenue-tax, Math.round(d.revenue/d.units), grossRevenue>0?Math.round(d.revenue/grossRevenue*100)+'%':'0%', settings.hsnCode]
        })
        downloadCSV([h,...rows.map(r=>r.map(String))], `products_${period}.csv`); break
      }
      case 'customer': {
        const custMap: Record<string,any> = {}
        filtered.forEach(o => {
          const k = o.customerPhone||o.customerName||'Unknown'
          if (!custMap[k]) custMap[k] = {name:o.customerName||'',phone:o.customerPhone||'',city:o.city||'',state:o.state||'',orders:0,revenue:0}
          custMap[k].orders++; custMap[k].revenue += o.amount||0
        })
        const h = ['Customer','Phone','City','State','Orders',`Revenue (${settings.currency})`,`GST (${settings.currency})`,`Net (${settings.currency})`,`Avg Order (${settings.currency})`]
        const rows = Object.entries(custMap).sort((a,b)=>(b[1] as any).revenue-(a[1] as any).revenue).map(([,d]:any[]) => {
          const tax = gstFromTotal(d.revenue,R)
          return [d.name,d.phone,d.city,d.state,d.orders,d.revenue,tax,d.revenue-tax,Math.round(d.revenue/d.orders)]
        })
        downloadCSV([h,...rows.map(r=>r.map(String))], `customers_${period}.csv`); break
      }
      case 'state': {
        const h = ['State','Orders',`Gross (${settings.currency})`,`GST (${settings.currency})`,`Net (${settings.currency})`,'% of Total',`Avg Order (${settings.currency})`]
        const rows = topStates.map(([st,d]) => [st,d.orders,d.revenue,d.gst,d.revenue-d.gst,grossRevenue>0?Math.round(d.revenue/grossRevenue*100)+'%':'0%',Math.round(d.revenue/d.orders)])
        downloadCSV([h,...rows.map(r=>r.map(String))], `states_${period}.csv`); break
      }
      case 'payment': {
        const codRev = codOrders.reduce((s,o)=>s+(o.amount||0),0)
        const preRev = prepaidOrd.reduce((s,o)=>s+(o.amount||0),0)
        const h = ['Payment Type','Orders',`Revenue (${settings.currency})`,`GST (${settings.currency})`,`Net (${settings.currency})`,'% Orders','% Revenue']
        const rows = [
          ['COD',codOrders.length,codRev,gstFromTotal(codRev,R),netFromTotal(codRev,R),filtered.length>0?Math.round(codOrders.length/filtered.length*100)+'%':'0%',grossRevenue>0?Math.round(codRev/grossRevenue*100)+'%':'0%'],
          ['Prepaid',prepaidOrd.length,preRev,gstFromTotal(preRev,R),netFromTotal(preRev,R),filtered.length>0?Math.round(prepaidOrd.length/filtered.length*100)+'%':'0%',grossRevenue>0?Math.round(preRev/grossRevenue*100)+'%':'0%'],
        ]
        downloadCSV([h,...rows.map(r=>r.map(String))], `payments_${period}.csv`); break
      }
      case 'returns': {
        const h = ['Order No','Date','Customer','Phone','City','State','Products',`Amount (${settings.currency})`,'Status']
        const rows = cancelled.map(o => [o.orderNumber||o._id, new Date(o.createdAt).toLocaleDateString('en-IN'), o.customerName||'', o.customerPhone||'', o.city||'', o.state||'', o.products||'', o.amount||0, o.status||''])
        downloadCSV([h,...rows.map(r=>r.map(String))], `returns_${period}.csv`); break
      }
    }
  }

  function printPDF() {
    setGenerating(true)
    setTimeout(() => { window.print(); setGenerating(false); toast.success('Use Ctrl+P → Save as PDF') }, 300)
  }

  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  if (!mounted) return null

  return (
    <div>
      <style>{`@media print { body * { visibility: hidden !important; } #print-area, #print-area * { visibility: visible !important; } #print-area { position: fixed; top: 0; left: 0; width: 100%; background: white; color: black; font-family: Arial; padding: 20px; } .no-print { display: none !important; } }`}</style>

      {/* HEADER */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>📋 Reports <span style={{ color: 'var(--gold)' }}>& GST</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {settings.companyName} {settings.gstin && `· GSTIN: ${settings.gstin}`} · {orders.length} total orders
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCSVExport} style={{ padding: '9px 18px', background: 'var(--grL)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
            ⬇ CSV
          </button>
          <button onClick={printPDF} disabled={generating} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
            🖨️ {generating ? 'Preparing...' : 'Print / PDF'}
          </button>
        </div>
      </div>

      {/* MAIN TABS */}
      <div className="no-print" style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[{id:'report',l:'📊 Reports'},{id:'settings',l:'⚙️ GST Settings'}].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: activeTab === t.id ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: activeTab === t.id ? 'var(--gold)' : 'var(--mu2)', border: '1px solid '+(activeTab===t.id?'rgba(212,168,83,0.3)':'var(--b1)') }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════════ SETTINGS TAB ════════ */}
      {activeTab === 'settings' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Company Info */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>🏢 Company Information</div>
              <div style={{ background: 'var(--blL)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 11.5, color: 'var(--blue)', lineHeight: 1.6 }}>
                💡 Yeh details reports ke print header mein dikhte hain aur CSV mein company info ke liye use hoti hain.
              </div>
              {[
                { k: 'companyName', l: 'Company Name', p: 'Rabt Naturals' },
                { k: 'address', l: 'Address', p: 'Indore, Madhya Pradesh' },
                { k: 'email', l: 'Email', p: 'support@rabtnaturals.in' },
                { k: 'phone', l: 'Phone', p: '+91-7400070127' },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                  <input value={(settings as any)[f.k]} onChange={e => setSettings(s => ({...s, [f.k]: e.target.value}))} placeholder={f.p} style={inp} />
                </div>
              ))}
            </div>

            {/* GST Settings */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>🧾 GST Configuration</div>
              <div style={{ background: 'var(--orL)', border: '1px solid rgba(249,115,22,.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 11.5, color: 'var(--orange)', lineHeight: 1.6 }}>
                ⚠️ GSTIN sahi bharna zaroori hai GST filing ke liye. Skincare products ka HSN: 3304
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>GSTIN (GST Number)</label>
                <input value={settings.gstin} onChange={e => setSettings(s => ({...s, gstin: e.target.value.toUpperCase()}))} placeholder="23AABCR1234D1Z5 (15 digits)" style={{ ...inp, fontFamily: 'DM Mono', letterSpacing: '.08em' }} maxLength={15} />
                {settings.gstin && settings.gstin.length !== 15 && <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: -6, marginBottom: 8 }}>⚠ GSTIN must be 15 characters</div>}
                {settings.gstin && settings.gstin.length === 15 && <div style={{ fontSize: 10.5, color: 'var(--green)', marginTop: -6, marginBottom: 8 }}>✓ Valid GSTIN format</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>GST Rate (%)</label>
                  <select value={settings.gstRate} onChange={e => setSettings(s => ({...s, gstRate: Number(e.target.value), cgstRate: Number(e.target.value)/2, sgstRate: Number(e.target.value)/2}))} style={inp}>
                    <option value={5}>5% (CGST 2.5% + SGST 2.5%)</option>
                    <option value={12}>12% (CGST 6% + SGST 6%)</option>
                    <option value={18}>18% (CGST 9% + SGST 9%)</option>
                    <option value={28}>28% (CGST 14% + SGST 14%)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>HSN Code</label>
                  <input value={settings.hsnCode} onChange={e => setSettings(s => ({...s, hsnCode: e.target.value}))} placeholder="3304" style={inp} />
                </div>
              </div>
              {/* GST breakdown preview */}
              <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>GST Preview (on ₹1000 order)</div>
                {[
                  ['Invoice Value (MRP)', '₹1,000'],
                  [`GST ${settings.gstRate}% (inclusive)`, `₹${gstFromTotal(1000, settings.gstRate)}`],
                  [`CGST ${settings.gstRate/2}%`, `₹${cgst(1000, settings.gstRate)}`],
                  [`SGST ${settings.gstRate/2}%`, `₹${sgst(1000, settings.gstRate)}`],
                  ['Taxable Value (Net)', `₹${netFromTotal(1000, settings.gstRate)}`],
                ].map(([l,v],i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 4 ? '1px solid var(--b1)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--mu2)' }}>{l}</span>
                    <span style={{ fontFamily: 'DM Mono', fontSize: 12, fontWeight: i===4?800:600, color: i===4?'var(--green)':i===0?'var(--teal)':'var(--orange)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Report Preferences */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 16 }}>⚙️ Report Preferences</div>
              {[
                { k: 'currency', l: 'Currency Symbol', p: '₹' },
                { k: 'financialYearStart', l: 'Financial Year Start Month (1-12)', p: '4 (April)', type: 'number' },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                  <input type={f.type||'text'} value={(settings as any)[f.k]} onChange={e => setSettings(s => ({...s, [f.k]: f.type === 'number' ? Number(e.target.value) : e.target.value}))} placeholder={f.p} style={inp} />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: 'var(--s2)', borderRadius: 8 }}>
                  <input type="checkbox" checked={settings.showLogo} onChange={e => setSettings(s => ({...s, showLogo: e.target.checked}))} style={{ width: 16, height: 16, accentColor: 'var(--gold)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Show company name in report header</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)' }}>Printed on top of every PDF report</div>
                  </div>
                </label>
              </div>
            </div>

            {/* GST Filing Guide */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>📚 GST Filing Guide</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { title: 'GSTR-1', desc: 'Monthly/Quarterly outward supply. File by 11th of next month. Use "GST Summary" report → CSV → give to CA.', c: 'var(--blue)' },
                  { title: 'GSTR-3B', desc: 'Monthly summary return. Pay GST by 20th. Net Revenue × 18% = GST payable (CGST + SGST split equally).', c: 'var(--orange)' },
                  { title: 'HSN Code', desc: 'Rabt Naturals skincare products → 3304 (Beauty or skin-care preparations). Enter in Settings.', c: 'var(--green)' },
                  { title: 'B2C Sales', desc: 'All consumer orders are B2C. Under GSTR-1, report under "B2C Others" if order value < ₹2.5L.', c: 'var(--teal)' },
                  { title: 'COD Orders', desc: 'COD orders — GST liability arises at delivery, not booking. Use delivered orders for filing.', c: 'var(--gold)' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'var(--s2)', borderRadius: 10, padding: '11px 13px', borderLeft: `3px solid ${item.c}` }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: item.c, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={saveSettings} disabled={savingSettings} style={{ marginTop: 16, width: '100%', padding: '13px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 9, color: '#08090C', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit' }}>
            {savingSettings ? 'Saving...' : '💾 Save GST Settings'}
          </button>
        </div>
      )}

      {/* ════════ REPORT TAB ════════ */}
      {activeTab === 'report' && (
        <div>
          {/* Date Filters */}
          <div className="no-print card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 300 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 7 }}>Quick Range</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[['today','Today'],['this_week','This Week'],['this_month','This Month'],['last_month','Last Month'],['q1','Q1 Apr-Jun'],['q2','Q2 Jul-Sep'],['q3','Q3 Oct-Dec'],['q4','Q4 Jan-Mar'],['fy','FY '+new Date().getFullYear()+'-'+(new Date().getFullYear()+1).toString().slice(2)],['this_year','This Year'],['all','All Time']].map(([v,l]) => (
                    <button key={v} onClick={() => applyQuickRange(v)} style={{ padding: '4px 11px', borderRadius: 50, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: quickRange===v?'var(--gL)':'var(--s2)', color: quickRange===v?'var(--gold)':'var(--mu2)', border: '1px solid '+(quickRange===v?'rgba(212,168,83,.3)':'var(--b1)') }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5 }}>From</div><input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setQuickRange('')}} style={{ ...inp, marginBottom: 0 }} /></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5 }}>To</div><input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setQuickRange('')}} style={{ ...inp, marginBottom: 0 }} /></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5 }}>GST %</div>
                  <select value={settings.gstRate} onChange={e => setSettings(s=>({...s,gstRate:Number(e.target.value),cgstRate:Number(e.target.value)/2,sgstRate:Number(e.target.value)/2}))} style={{ ...inp, marginBottom: 0, width: 80 }}>
                    {[5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Report Type Selector */}
          <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, marginBottom: 20 }}>
            {REPORT_TYPES.map(r => (
              <div key={r.id} onClick={() => setReportType(r.id)} style={{ background: reportType===r.id?'var(--gL)':'var(--s1)', border: '1px solid '+(reportType===r.id?'rgba(212,168,83,.4)':'var(--b1)'), borderRadius: 12, padding: '13px 15px', cursor: 'pointer', transition: 'all .15s' }}>
                <div style={{ fontFamily: 'Syne', fontSize: 12.5, fontWeight: 800, marginBottom: 3, color: reportType===r.id?'var(--gold)':'var(--tx)' }}>{r.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--mu)', lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            ))}
          </div>

          {/* Summary KPIs */}
          <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { l: 'Total Orders', v: filtered.length, c: 'var(--blue)', sub: 'All orders' },
              { l: 'Delivered', v: delivered.length, c: 'var(--green)', sub: 'Revenue orders' },
              { l: 'Gross Revenue', v: settings.currency+grossRevenue.toLocaleString('en-IN'), c: 'var(--teal)', sub: 'Incl GST' },
              { l: `GST ${R}%`, v: settings.currency+totalGST.toLocaleString('en-IN'), c: 'var(--orange)', sub: 'To be paid' },
              { l: 'Net Revenue', v: settings.currency+netRevenue.toLocaleString('en-IN'), c: 'var(--gold)', sub: 'Excl GST' },
              { l: `CGST ${R/2}%`, v: settings.currency+totalCGST.toLocaleString('en-IN'), c: 'var(--purple)', sub: 'Central' },
              { l: `SGST ${R/2}%`, v: settings.currency+totalSGST.toLocaleString('en-IN'), c: 'var(--blue)', sub: 'State' },
              { l: 'Cancelled', v: settings.currency+cancelledVal.toLocaleString('en-IN'), c: 'var(--red)', sub: cancelled.length+' orders' },
            ].map((s,i)=>(
              <div key={i} className="card">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 7 }}>{s.l}</div>
                <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, color: s.c }}>{loading?'...':s.v}</div>
                <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Monthly chart */}
          {monthlyData.length > 0 && (
            <div className="no-print card" style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Monthly Revenue — Gross vs Net (ex-GST)</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 130, overflowX: 'auto' }}>
                {monthlyData.map(([month,d],i)=>(
                  <div key={i} style={{ flex: '0 0 auto', minWidth: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 110 }}>
                      <div title={`Gross: ${settings.currency}${d.gross}`} style={{ width: 13, background: 'var(--teal)', borderRadius: '2px 2px 0 0', height: Math.round(d.gross/maxMonthly*105)+'px', minHeight: d.gross>0?3:0 }} />
                      <div title={`Net: ${settings.currency}${d.net}`} style={{ width: 13, background: 'var(--green)', borderRadius: '2px 2px 0 0', height: Math.round(d.net/maxMonthly*105)+'px', minHeight: d.net>0?3:0, opacity: .75 }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--mu)', textAlign: 'center', lineHeight: 1.3 }}>{month.split(' ')[0]}<br/><span style={{ opacity: .7 }}>{d.orders}</span></div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                {[['var(--teal)','Gross'],['var(--green)','Net (ex-GST)']].map(([c,l],i)=>(
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: c, opacity: i===1?.75:1 }} /><span style={{ fontSize: 10, color: 'var(--mu)' }}>{l}</span></div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ PRINT AREA ═══ */}
          <div id="print-area">
            {/* Print header */}
            {settings.showLogo && (
              <div style={{ textAlign: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '2px solid #000', display: 'none' }} className="print-show">
                <div style={{ fontSize: 20, fontWeight: 800 }}>{settings.companyName}</div>
                {settings.gstin && <div style={{ fontSize: 13, marginTop: 3 }}>GSTIN: {settings.gstin}</div>}
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{settings.address} · {settings.phone} · {settings.email}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{REPORT_TYPES.find(r=>r.id===reportType)?.label} · {dateFrom} to {dateTo}</div>
                <div style={{ fontSize: 11, color: '#777', marginTop: 3 }}>Generated: {new Date().toLocaleString('en-IN')} · GST Rate: {R}% · HSN: {settings.hsnCode}</div>
              </div>
            )}

            {/* SALES */}
            {reportType==='sales' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>📦 Sales Report · {dateFrom} to {dateTo}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--mu)' }}>{filtered.length} orders</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                    <thead>
                      <tr style={{ background: 'var(--s2)' }}>
                        {['Order No','Date','Customer','Phone','City','State','Products','Payment','Status',`Gross (${settings.currency})`,`GST ${R}% (${settings.currency})`,`CGST ${R/2}%`,`SGST ${R/2}%`,`Net (${settings.currency})`,'HSN'].map(h=>(
                          <th key={h} style={{ textAlign: 'left', padding: '8px 11px', fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0,100).map((o,i)=>{
                        const g = o.amount||0, tax = gstFromTotal(g,R), net = g-tax
                        const isDel = ['delivered','DELIVERED'].includes(o.status||'')
                        const isCan = ['cancelled','canceled','rto'].includes((o.status||'').toLowerCase())
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--b1)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                            <td style={{ padding: '8px 11px', fontSize: 11, fontFamily: 'DM Mono', color: 'var(--blue)' }}>{o.orderNumber||String(o._id).slice(-6)}</td>
                            <td style={{ padding: '8px 11px', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                            <td style={{ padding: '8px 11px', fontSize: 12, fontWeight: 600, maxWidth: 110 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customerName||'—'}</div></td>
                            <td style={{ padding: '8px 11px', fontSize: 11, fontFamily: 'DM Mono' }}>{o.customerPhone||'—'}</td>
                            <td style={{ padding: '8px 11px', fontSize: 11, color: 'var(--mu2)' }}>{o.city||'—'}</td>
                            <td style={{ padding: '8px 11px', fontSize: 11, color: 'var(--mu2)' }}>{o.state||'—'}</td>
                            <td style={{ padding: '8px 11px', fontSize: 10.5, maxWidth: 150 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--mu2)' }}>{o.products||'—'}</div></td>
                            <td style={{ padding: '8px 11px' }}><span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 50, background: (o.paymentMethod||'').toLowerCase().includes('cod')?'var(--orL)':'var(--blL)', color: (o.paymentMethod||'').toLowerCase().includes('cod')?'var(--orange)':'var(--blue)', fontWeight: 700 }}>{(o.paymentMethod||'—').toUpperCase()}</span></td>
                            <td style={{ padding: '8px 11px' }}><span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 50, background: isDel?'var(--grL)':isCan?'var(--rdL)':'var(--blL)', color: isDel?'var(--green)':isCan?'var(--red)':'var(--blue)', fontWeight: 700 }}>{o.status||'—'}</span></td>
                            <td style={{ padding: '8px 11px', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700 }}>{settings.currency}{g.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '8px 11px', fontFamily: 'DM Mono', fontSize: 11, color: 'var(--orange)' }}>{settings.currency}{tax.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '8px 11px', fontFamily: 'DM Mono', fontSize: 11, color: 'var(--purple)' }}>{settings.currency}{Math.round(tax/2).toLocaleString('en-IN')}</td>
                            <td style={{ padding: '8px 11px', fontFamily: 'DM Mono', fontSize: 11, color: 'var(--blue)' }}>{settings.currency}{Math.round(tax/2).toLocaleString('en-IN')}</td>
                            <td style={{ padding: '8px 11px', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{settings.currency}{net.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '8px 11px', fontSize: 11, fontFamily: 'DM Mono', color: 'var(--mu)' }}>{settings.hsnCode}</td>
                          </tr>
                        )
                      })}
                      {filtered.length === 0 && <tr><td colSpan={15} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No orders in selected period</td></tr>}
                    </tbody>
                    {filtered.length > 0 && (
                      <tfoot>
                        <tr style={{ background: 'var(--s2)', borderTop: '2px solid var(--b2)' }}>
                          <td colSpan={9} style={{ padding: '10px 11px', fontFamily: 'Syne', fontWeight: 800, fontSize: 13 }}>TOTAL ({filtered.length} orders · {delivered.length} delivered)</td>
                          <td style={{ padding: '10px 11px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--teal)' }}>{settings.currency}{grossRevenue.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 11px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--orange)' }}>{settings.currency}{totalGST.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 11px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--purple)' }}>{settings.currency}{totalCGST.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 11px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--blue)' }}>{settings.currency}{totalSGST.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 11px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--green)' }}>{settings.currency}{netRevenue.toLocaleString('en-IN')}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {filtered.length > 100 && <div style={{ padding: '10px 18px', fontSize: 12, color: 'var(--orange)', background: 'var(--orL)' }}>⚠ Showing first 100. Export CSV for all {filtered.length} orders.</div>}
              </div>
            )}

            {/* GST */}
            {reportType==='gst' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    { l: 'Taxable Value', v: settings.currency+netRevenue.toLocaleString('en-IN'), c: 'var(--teal)', h: 'Revenue excl GST' },
                    { l: 'Total GST '+R+'%', v: settings.currency+totalGST.toLocaleString('en-IN'), c: 'var(--orange)', h: 'Total payable' },
                    { l: 'CGST '+R/2+'%', v: settings.currency+totalCGST.toLocaleString('en-IN'), c: 'var(--purple)', h: 'Central Govt' },
                    { l: 'SGST '+R/2+'%', v: settings.currency+totalSGST.toLocaleString('en-IN'), c: 'var(--blue)', h: 'State Govt' },
                    { l: 'Gross (Invoice)', v: settings.currency+grossRevenue.toLocaleString('en-IN'), c: 'var(--green)', h: 'Incl GST' },
                    { l: 'B2C Orders', v: delivered.length, c: 'var(--mu)', h: 'GSTR-1 B2C Others' },
                  ].map((s,i)=>(
                    <div key={i} className="card">
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>{s.l}</div>
                      <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>{s.h}</div>
                    </div>
                  ))}
                </div>
                {settings.gstin && (
                  <div style={{ background: 'var(--grL)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--green)' }}>
                    ✓ GSTIN: <strong style={{ fontFamily: 'DM Mono' }}>{settings.gstin}</strong> · HSN: {settings.hsnCode} · {settings.companyName}
                  </div>
                )}
                {!settings.gstin && (
                  <div style={{ background: 'var(--orL)', border: '1px solid rgba(249,115,22,.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--orange)' }}>
                    ⚠️ GSTIN not set — go to GST Settings tab to add your GST number
                  </div>
                )}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Monthly GST Breakup — GSTR-1 Format</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--s2)' }}>
                        {['Month','Orders','Gross Invoice ('+settings.currency+')','Taxable Value ('+settings.currency+')','CGST '+R/2+'% ('+settings.currency+')','SGST '+R/2+'% ('+settings.currency+')','Total GST ('+settings.currency+')'].map(h=>(
                          <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map(([mo,d],i)=>{
                        const tax = gstFromTotal(d.gross,R), net = d.gross-tax
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--b1)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                            <td style={{ padding: '10px 14px', fontWeight: 700 }}>{mo}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono' }}>{d.orders}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--teal)' }}>{settings.currency}{d.gross.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', color: 'var(--green)' }}>{settings.currency}{net.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', color: 'var(--purple)' }}>{settings.currency}{Math.round(tax/2).toLocaleString('en-IN')}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', color: 'var(--blue)' }}>{settings.currency}{Math.round(tax/2).toLocaleString('en-IN')}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--orange)' }}>{settings.currency}{tax.toLocaleString('en-IN')}</td>
                          </tr>
                        )
                      })}
                      {monthlyData.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No delivered orders in this period</td></tr>}
                    </tbody>
                    {monthlyData.length > 0 && (
                      <tfoot>
                        <tr style={{ background: 'var(--s2)', borderTop: '2px solid var(--b2)' }}>
                          <td colSpan={2} style={{ padding: '10px 14px', fontFamily: 'Syne', fontWeight: 800 }}>TOTAL ({delivered.length} orders)</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--teal)' }}>{settings.currency}{grossRevenue.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--green)' }}>{settings.currency}{netRevenue.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--purple)' }}>{settings.currency}{totalCGST.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--blue)' }}>{settings.currency}{totalSGST.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--orange)' }}>{settings.currency}{totalGST.toLocaleString('en-IN')}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* PRODUCT */}
            {reportType==='product' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>🧴 Product Sales</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--s2)' }}>
                      {['#','Product','Units','Orders','Revenue','GST','Net Revenue','Avg Price','% Total'].map(h=>(
                        <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map(([n,d],i)=>{
                      const tax = gstFromTotal(d.revenue,R)
                      const pct = grossRevenue>0?Math.round(d.revenue/grossRevenue*100):0
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--b1)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding: '10px 14px', fontFamily: 'Syne', fontWeight: 800, color: i<3?'var(--gold)':'var(--mu)' }}>#{i+1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{n}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--blue)' }}>{d.units}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono' }}>{d.orders}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--teal)' }}>{settings.currency}{d.revenue.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', color: 'var(--orange)' }}>{settings.currency}{tax.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--green)' }}>{settings.currency}{(d.revenue-tax).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono' }}>{settings.currency}{Math.round(d.revenue/d.units).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden', width: 44 }}><div style={{ height: '100%', width: pct+'%', background: 'var(--teal)', borderRadius: 3 }} /></div>
                              <span style={{ fontSize: 11, fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--teal)' }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {topProducts.length===0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No product data</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* STATE */}
            {reportType==='state' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>📍 State-wise Sales</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--s2)' }}>
                      {['#','State','Orders','Gross','GST','Net Revenue','% Total','Avg Order'].map(h=>(
                        <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topStates.map(([st,d],i)=>{
                      const pct = grossRevenue>0?Math.round(d.revenue/grossRevenue*100):0
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--b1)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding: '10px 14px', fontFamily: 'Syne', fontWeight: 800, color: i<3?'var(--gold)':'var(--mu)' }}>#{i+1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700 }}>{st}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', color: 'var(--blue)' }}>{d.orders}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--teal)' }}>{settings.currency}{d.revenue.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', color: 'var(--orange)' }}>{settings.currency}{d.gst.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--green)' }}>{settings.currency}{(d.revenue-d.gst).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden', width: 44 }}><div style={{ height: '100%', width: pct+'%', background: 'var(--green)', borderRadius: 3 }} /></div>
                              <span style={{ fontSize: 11, fontFamily: 'DM Mono', fontWeight: 700 }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono' }}>{settings.currency}{Math.round(d.revenue/d.orders).toLocaleString('en-IN')}</td>
                        </tr>
                      )
                    })}
                    {topStates.length===0&&<tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No data</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAYMENT */}
            {reportType==='payment' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[{label:'COD',orders:codOrders,c:'var(--orange)'},{label:'Prepaid',orders:prepaidOrd,c:'var(--green)'}].map((s,i)=>{
                  const rev = s.orders.reduce((sum,o)=>sum+(o.amount||0),0)
                  const tax = gstFromTotal(rev,R)
                  return (
                    <div key={i} className="card">
                      <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, color: s.c, marginBottom: 16 }}>{s.label} Orders</div>
                      {[['Orders',s.orders.length,s.c],['Gross Revenue',settings.currency+rev.toLocaleString('en-IN'),'var(--tx)'],['GST '+R+'%',settings.currency+tax.toLocaleString('en-IN'),'var(--orange)'],['CGST '+R/2+'%',settings.currency+Math.round(tax/2).toLocaleString('en-IN'),'var(--purple)'],['SGST '+R/2+'%',settings.currency+Math.round(tax/2).toLocaleString('en-IN'),'var(--blue)'],['Net Revenue',settings.currency+(rev-tax).toLocaleString('en-IN'),'var(--green)'],['Avg Order',settings.currency+(s.orders.length>0?Math.round(rev/s.orders.length):0).toLocaleString('en-IN'),'var(--mu2)'],['% of Total',filtered.length>0?Math.round(s.orders.length/filtered.length*100)+'%':'—','var(--mu2)']].map(([l,v,c],j)=>(
                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                          <span style={{ fontSize: 12.5, color: 'var(--mu2)' }}>{l as string}</span>
                          <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: c as string }}>{v as any}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 14, height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: (filtered.length>0?Math.round(s.orders.length/filtered.length*100):0)+'%', background: s.c, borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 5 }}>{filtered.length>0?Math.round(s.orders.length/filtered.length*100):0}% of total orders</div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* CUSTOMER */}
            {reportType==='customer' && (() => {
              const custMap: Record<string,any> = {}
              filtered.forEach(o => {
                const k = o.customerPhone||o.customerName||'Unknown'
                if (!custMap[k]) custMap[k] = {name:o.customerName||'',phone:o.customerPhone||'',city:o.city||'',state:o.state||'',orders:0,revenue:0}
                custMap[k].orders++; custMap[k].revenue += o.amount||0
              })
              const sorted = Object.entries(custMap).sort((a,b)=>(b[1] as any).revenue-(a[1] as any).revenue)
              return (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>👥 Top Customers</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--s2)' }}>
                        {['#','Customer','Phone','City','State','Orders','Revenue','GST','Net','Avg Order'].map(h=>(
                          <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.slice(0,50).map(([,d],i)=>{
                        const tax = gstFromTotal((d as any).revenue,R)
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--b1)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                            <td style={{ padding: '9px 14px', fontFamily: 'Syne', fontWeight: 800, color: i<3?'var(--gold)':'var(--mu)' }}>#{i+1}</td>
                            <td style={{ padding: '9px 14px', fontWeight: 600 }}>{(d as any).name||'—'}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', fontSize: 11.5 }}>{(d as any).phone||'—'}</td>
                            <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--mu2)' }}>{(d as any).city||'—'}</td>
                            <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--mu2)' }}>{(d as any).state||'—'}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--blue)' }}>{(d as any).orders}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--teal)' }}>{settings.currency}{(d as any).revenue.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', color: 'var(--orange)' }}>{settings.currency}{tax.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--green)' }}>{settings.currency}{((d as any).revenue-tax).toLocaleString('en-IN')}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', fontSize: 11 }}>{settings.currency}{Math.round((d as any).revenue/(d as any).orders).toLocaleString('en-IN')}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {/* RETURNS */}
            {reportType==='returns' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
                  {[
                    { l: 'Cancellations', v: cancelled.length, c: 'var(--red)' },
                    { l: 'Lost Revenue', v: settings.currency+cancelledVal.toLocaleString('en-IN'), c: 'var(--red)' },
                    { l: 'Cancel Rate', v: filtered.length>0?Math.round(cancelled.length/filtered.length*100)+'%':'—', c: 'var(--orange)' },
                  ].map((s,i)=>(
                    <div key={i} className="card">
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 7 }}>{s.l}</div>
                      <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>↩️ Returns & Cancellations</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: 'var(--s2)' }}>
                        {['Order No','Date','Customer','Phone','City','Products','Amount','Status'].map(h=>(
                          <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cancelled.map((o,i)=>(
                        <tr key={i} style={{ borderBottom: '1px solid var(--b1)' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', fontSize: 11.5, color: 'var(--blue)' }}>{o.orderNumber||String(o._id).slice(-6)}</td>
                          <td style={{ padding: '9px 14px', fontSize: 11.5 }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                          <td style={{ padding: '9px 14px', fontWeight: 600 }}>{o.customerName||'—'}</td>
                          <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', fontSize: 11.5 }}>{o.customerPhone||'—'}</td>
                          <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--mu2)' }}>{o.city||'—'}</td>
                          <td style={{ padding: '9px 14px', fontSize: 11, maxWidth: 160 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--mu2)' }}>{o.products||'—'}</div></td>
                          <td style={{ padding: '9px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--red)' }}>{settings.currency}{(o.amount||0).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '9px 14px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 50, background: 'var(--rdL)', color: 'var(--red)', fontWeight: 700 }}>{o.status||'—'}</span></td>
                        </tr>
                      ))}
                      {cancelled.length===0&&<tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No cancellations 🎉</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
