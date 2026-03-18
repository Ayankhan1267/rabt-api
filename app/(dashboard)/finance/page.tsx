'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const EXPENSE_CATEGORIES = ['Production', 'Packaging', 'Shipping', 'Marketing', 'Salaries', 'Office', 'Software', 'Logistics', 'Returns', 'Miscellaneous']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Shipping zones (ShipRocket style)
const ZONES = [
  { id: 'local',    label: 'Local (Same City)',     base: 30,  perKg: 5  },
  { id: 'zone_a',   label: 'Zone A (Same State)',   base: 45,  perKg: 10 },
  { id: 'zone_b',   label: 'Zone B (Nearby State)', base: 55,  perKg: 14 },
  { id: 'zone_c',   label: 'Zone C (Far State)',    base: 70,  perKg: 18 },
  { id: 'zone_d',   label: 'Zone D (Remote/NE)',    base: 100, perKg: 25 },
]

// Calculate shipping for one order
function calcShipping(weightKg: number, zone: string, paymentType: 'cod'|'prepaid', codCharge: number, fuelSurcharge: number): number {
  const z = ZONES.find(z => z.id === zone) || ZONES[2] // default zone_b
  const base = z.base + Math.max(0, weightKg - 0.5) * z.perKg
  const cod = paymentType === 'cod' ? codCharge : 0
  const fuel = Math.round(base * fuelSurcharge / 100)
  return Math.round(base + cod + fuel)
}

export default function FinancePage() {
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [settings, setSettings] = useState({
    gstRate: 18,
    packagingPerOrder: 25,
    productionCostPct: 30, // fallback if product lab not used
    useProductLabCost: false,
    // Shipping config
    codCharge: 35,
    fuelSurcharge: 5,
    defaultWeight: 0.3, // kg per product
    defaultZone: 'zone_b',
  })
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'overview'|'pl'|'expenses'|'shipping'|'analytics'|'settings'>('overview')
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: 0, category: 'Marketing', date: new Date().toISOString().split('T')[0], notes: '', recurring: false })
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  // Shipping calc tool
  const [shipCalc, setShipCalc] = useState({ weight: 0.3, zone: 'zone_b', payment: 'prepaid' as 'cod'|'prepaid', qty: 1 })
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: expData } = await supabase.from('finance_expenses').select('*').order('date', { ascending: false })
      setExpenses(expData || [])

      const { data: settData } = await supabase.from('app_settings').select('*').eq('key', 'finance_settings').single()
      if (settData?.value) setSettings(JSON.parse(settData.value))

      // Product lab costs
      const { data: prodData } = await supabase.from('product_lab').select('name,cost,price').order('name')
      setProducts(prodData || [])

      const url = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null
      if (url) {
        const [ordRes, consRes, payRes] = await Promise.all([
          fetch(url + '/api/orders').then(r => r.ok ? r.json() : []),
          fetch(url + '/api/consultations').then(r => r.ok ? r.json() : []),
          fetch(url + '/api/payouts').then(r => r.ok ? r.json() : []),
        ])
        setOrders(Array.isArray(ordRes) ? ordRes : [])
        setConsultations(Array.isArray(consRes) ? consRes : [])
        setPayouts(Array.isArray(payRes) ? payRes : [])
      }
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  async function saveSettings() {
    setSavingSettings(true)
    await supabase.from('app_settings').upsert({ key: 'finance_settings', value: JSON.stringify(settings) })
    toast.success('Settings saved!')
    setSavingSettings(false)
  }

  async function addExpense() {
    if (!expenseForm.title || expenseForm.amount <= 0) { toast.error('Title and amount required'); return }
    const { error } = await supabase.from('finance_expenses').insert(expenseForm)
    if (error) { toast.error(error.message); return }
    toast.success('Expense added!')
    setShowAddExpense(false)
    setExpenseForm({ title: '', amount: 0, category: 'Marketing', date: new Date().toISOString().split('T')[0], notes: '', recurring: false })
    loadAll()
  }

  async function deleteExpense(id: string) {
    await supabase.from('finance_expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    toast.success('Deleted!')
  }

  // ── CALCULATIONS ──────────────────────────────────────────────────────────
  const deliveredOrders = orders.filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'delivered')
  const cancelledOrders = orders.filter(o => ['cancelled','canceled','rto','returned'].includes((o.orderStatus || o.status || '').toLowerCase()))
  const activeOrders    = orders.filter(o => !['delivered','cancelled','canceled','rto','returned'].includes((o.orderStatus || o.status || '').toLowerCase()))

  const grossRevenue    = deliveredOrders.reduce((s, o) => s + (o.amount || 0), 0)
  const pendingRevenue  = activeOrders.reduce((s, o) => s + (o.amount || 0), 0)
  const cancelledValue  = cancelledOrders.reduce((s, o) => s + (o.amount || 0), 0)

  const completedCons     = consultations.filter(c => c.status === 'completed').length
  const consultationRevenue = completedCons * 30
  const totalRevenue      = grossRevenue + consultationRevenue

  const gstCollected  = Math.round(grossRevenue * settings.gstRate / (100 + settings.gstRate))
  const revenueExGST  = grossRevenue - gstCollected

  // Production cost — from product lab if enabled, else % fallback
  let productionCost = 0
  if (settings.useProductLabCost && products.length > 0) {
    const avgCostRatio = products.filter(p => p.price > 0 && p.cost > 0).reduce((s, p) => s + (p.cost / p.price), 0) / Math.max(products.filter(p => p.price > 0 && p.cost > 0).length, 1)
    productionCost = Math.round(revenueExGST * avgCostRatio)
  } else {
    productionCost = Math.round(revenueExGST * settings.productionCostPct / 100)
  }

  const packagingCost = deliveredOrders.length * settings.packagingPerOrder

  // Smart shipping — per order based on payment type
  const codOrders      = deliveredOrders.filter(o => (o.paymentMethod || o.payment || '').toLowerCase().includes('cod'))
  const prepaidOrders  = deliveredOrders.filter(o => !(o.paymentMethod || o.payment || '').toLowerCase().includes('cod'))
  const shippingCOD    = codOrders.length * calcShipping(settings.defaultWeight, settings.defaultZone, 'cod', settings.codCharge, settings.fuelSurcharge)
  const shippingPrepaid = prepaidOrders.length * calcShipping(settings.defaultWeight, settings.defaultZone, 'prepaid', settings.codCharge, settings.fuelSurcharge)
  const totalShipping  = shippingCOD + shippingPrepaid

  const specialistCommissions = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0)
  const pendingCommissions     = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0)
  const totalExpenses  = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const totalCOGS      = productionCost + packagingCost + totalShipping + specialistCommissions
  const grossProfit    = revenueExGST - productionCost + consultationRevenue
  const operatingProfit = grossProfit - packagingCost - totalShipping - specialistCommissions
  const netProfit      = operatingProfit - totalExpenses
  const grossMargin    = revenueExGST > 0 ? Math.round(grossProfit / revenueExGST * 100) : 0
  const netMargin      = totalRevenue > 0 ? Math.round(netProfit / totalRevenue * 100) : 0

  // Monthly
  function filterByMonth(items: any[], field: string, m: number, y: number) {
    return items.filter(i => { const d = new Date(i[field] || Date.now()); return d.getMonth() === m && d.getFullYear() === y })
  }
  const monthlyData = Array.from({ length: 12 }, (_, m) => {
    const mOrds = filterByMonth(deliveredOrders, 'createdAt', m, selectedYear)
    const mCons = filterByMonth(consultations.filter(c => c.status === 'completed'), 'createdAt', m, selectedYear)
    const rev = mOrds.reduce((s, o) => s + (o.amount || 0), 0) + mCons.length * 30
    const exp = filterByMonth(expenses, 'date', m, selectedYear).reduce((s, e) => s + (e.amount || 0), 0)
    const mCod = mOrds.filter(o => (o.paymentMethod||o.payment||'').toLowerCase().includes('cod'))
    const mPre = mOrds.filter(o => !(o.paymentMethod||o.payment||'').toLowerCase().includes('cod'))
    const mShip = mCod.length * calcShipping(settings.defaultWeight, settings.defaultZone, 'cod', settings.codCharge, settings.fuelSurcharge) + mPre.length * calcShipping(settings.defaultWeight, settings.defaultZone, 'prepaid', settings.codCharge, settings.fuelSurcharge)
    const prod = Math.round((rev - Math.round(rev * settings.gstRate / (100 + settings.gstRate))) * settings.productionCostPct / 100)
    const profit = rev - prod - mShip - mOrds.length * settings.packagingPerOrder - exp
    return { month: MONTHS[m], revenue: rev, expenses: exp + prod + mShip, profit }
  })
  const maxMonthRev = Math.max(...monthlyData.map(m => m.revenue), 1)

  const expByCat: Record<string, number> = {}
  expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + (e.amount || 0) })

  const curMonthOrds = filterByMonth(deliveredOrders, 'createdAt', selectedMonth, selectedYear)
  const curMonthRev  = curMonthOrds.reduce((s, o) => s + (o.amount || 0), 0) + filterByMonth(consultations.filter(c => c.status === 'completed'), 'createdAt', selectedMonth, selectedYear).length * 30
  const curMonthExp  = filterByMonth(expenses, 'date', selectedMonth, selectedYear).reduce((s, e) => s + (e.amount || 0), 0)
  const curMonthShip = curMonthOrds.filter(o => (o.paymentMethod||o.payment||'').toLowerCase().includes('cod')).length * calcShipping(settings.defaultWeight, settings.defaultZone, 'cod', settings.codCharge, settings.fuelSurcharge) + curMonthOrds.filter(o => !(o.paymentMethod||o.payment||'').toLowerCase().includes('cod')).length * calcShipping(settings.defaultWeight, settings.defaultZone, 'prepaid', settings.codCharge, settings.fuelSurcharge)
  const curMonthProfit = curMonthRev - Math.round(curMonthRev * settings.productionCostPct / 100) - curMonthOrds.length * settings.packagingPerOrder - curMonthShip - curMonthExp

  const COLORS = ['var(--blue)','var(--orange)','var(--gold)','var(--teal)','var(--purple)','var(--green)','var(--red)']
  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  if (!mounted) return null

  const shipCalcResult = calcShipping(shipCalc.weight * shipCalc.qty, shipCalc.zone, shipCalc.payment, settings.codCharge, settings.fuelSurcharge)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Finance <span style={{ color: 'var(--gold)' }}>Dashboard</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>Auto P&L · Smart Shipping · Expenses · Profit</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ ...inp, marginBottom: 0, width: 'auto' }}>
            {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={loadAll} style={{ padding: '8px 14px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{id:'overview',l:'📊 Overview'},{id:'pl',l:'📋 P&L'},{id:'expenses',l:'💸 Expenses'},{id:'shipping',l:'🚚 Shipping'},{id:'analytics',l:'📈 Analytics'},{id:'settings',l:'⚙️ Settings'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: tab === t.id ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: tab === t.id ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (tab === t.id ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total Revenue', value: '₹' + totalRevenue.toLocaleString('en-IN'), sub: deliveredOrders.length + ' orders + ' + completedCons + ' consults', color: 'var(--green)' },
              { label: 'Gross Profit', value: '₹' + grossProfit.toLocaleString('en-IN'), sub: grossMargin + '% margin', color: 'var(--teal)' },
              { label: 'Net Profit', value: '₹' + netProfit.toLocaleString('en-IN'), sub: netMargin + '% net margin', color: netProfit >= 0 ? 'var(--gold)' : 'var(--red)' },
              { label: 'Shipping Cost', value: '₹' + totalShipping.toLocaleString('en-IN'), sub: codOrders.length + ' COD · ' + prepaidOrders.length + ' Prepaid', color: 'var(--orange)' },
              { label: 'Total Expenses', value: '₹' + totalExpenses.toLocaleString('en-IN'), sub: 'Ops expenses', color: 'var(--purple)' },
              { label: 'GST Collected', value: '₹' + gstCollected.toLocaleString('en-IN'), sub: settings.gstRate + '% rate', color: 'var(--mu)' },
            ].map((s, i) => (
              <div key={i} className="card">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: s.color, marginBottom: 3 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--mu)' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Monthly Bar Chart */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 18 }}>Monthly Revenue vs Expenses ({selectedYear})</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 160 }}>
              {monthlyData.map((m, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 130 }}>
                    <div style={{ width: '45%', background: 'var(--green)', borderRadius: '3px 3px 0 0', height: Math.round(m.revenue / maxMonthRev * 130) + 'px', minHeight: m.revenue > 0 ? 3 : 0 }} title={'₹' + m.revenue} />
                    <div style={{ width: '45%', background: 'var(--rdL)', borderRadius: '3px 3px 0 0', height: Math.round(m.expenses / maxMonthRev * 130) + 'px', minHeight: m.expenses > 0 ? 3 : 0, border: '1px solid var(--red)' }} title={'₹' + m.expenses} />
                  </div>
                  <div style={{ fontSize: 8.5, color: 'var(--mu)' }}>{m.month}</div>
                  {(m.revenue > 0 || m.profit !== 0) && <div style={{ fontSize: 8, fontFamily: 'DM Mono', color: m.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{m.profit >= 0 ? '+' : ''}₹{Math.abs(m.profit) >= 1000 ? (m.profit/1000).toFixed(0)+'K' : m.profit}</div>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)' }} /><span style={{ fontSize: 10, color: 'var(--mu)' }}>Revenue</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--rdL)', border: '1px solid var(--red)' }} /><span style={{ fontSize: 10, color: 'var(--mu)' }}>Expenses</span></div>
            </div>
          </div>

          {/* Current month */}
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 12 }}>This Month</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {MONTHS.map((m, i) => (
                <span key={i} onClick={() => setSelectedMonth(i)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', background: selectedMonth === i ? 'var(--gL)' : 'transparent', color: selectedMonth === i ? 'var(--gold)' : 'var(--mu)', fontWeight: selectedMonth === i ? 700 : 400 }}>{m}</span>
              ))}
            </div>
            {[
              { l: 'Revenue', v: '₹' + curMonthRev.toLocaleString('en-IN'), c: 'var(--green)' },
              { l: 'Shipping', v: '₹' + curMonthShip.toLocaleString('en-IN'), c: 'var(--orange)' },
              { l: 'Expenses', v: '₹' + curMonthExp.toLocaleString('en-IN'), c: 'var(--red)' },
              { l: 'Net Profit', v: '₹' + curMonthProfit.toLocaleString('en-IN'), c: curMonthProfit >= 0 ? 'var(--gold)' : 'var(--red)' },
              { l: 'Orders', v: curMonthOrds.length, c: 'var(--blue)' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--b1)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--mu2)' }}>{s.l}</span>
                <span style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, color: s.c }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P&L */}
      {tab === 'pl' && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', background: 'linear-gradient(135deg,rgba(212,168,83,0.1),rgba(212,168,83,0.05))', borderBottom: '1px solid var(--b1)' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800 }}>Profit & Loss Statement</div>
            <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 3 }}>Rabt Naturals · Auto-calculated</div>
          </div>

          {/* Revenue */}
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--b1)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>REVENUE</div>
            {[
              { l: 'Product Sales (Gross)', v: grossRevenue, bold: false },
              { l: 'Less: GST (' + settings.gstRate + '%)', v: -gstCollected, color: 'var(--mu)', indent: true },
              { l: 'Net Product Revenue', v: revenueExGST, bold: true, color: 'var(--teal)' },
              { l: 'Consultation Revenue (' + completedCons + ' × ₹30)', v: consultationRevenue, color: 'var(--teal)' },
              { l: 'TOTAL REVENUE', v: revenueExGST + consultationRevenue, bold: true, big: true, color: 'var(--green)' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: row.big ? '10px 0 4px' : '6px 0', borderTop: row.big ? '2px solid var(--b1)' : 'none', marginLeft: row.indent ? 20 : 0 }}>
                <span style={{ fontSize: row.big ? 13 : 12.5, fontWeight: row.bold ? 700 : 400, color: (row as any).color || 'var(--tx)' }}>{row.l}</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: row.big ? 14 : 12.5, fontWeight: row.bold ? 800 : 600, color: row.v >= 0 ? ((row as any).color || 'var(--tx)') : 'var(--red)' }}>
                  {row.v < 0 ? '(₹' + Math.abs(row.v).toLocaleString('en-IN') + ')' : '₹' + row.v.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>

          {/* COGS */}
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--b1)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>COST OF GOODS SOLD</div>
            {[
              { l: 'Production Cost' + (settings.useProductLabCost ? ' (from Product Lab)' : ' (' + settings.productionCostPct + '%)'), v: productionCost },
              { l: 'Packaging (' + deliveredOrders.length + ' orders × ₹' + settings.packagingPerOrder + ')', v: packagingCost },
              { l: 'Shipping — COD (' + codOrders.length + ' orders)', v: shippingCOD, sub: true },
              { l: 'Shipping — Prepaid (' + prepaidOrders.length + ' orders)', v: shippingPrepaid, sub: true },
              { l: 'Specialist Commissions', v: specialistCommissions },
              { l: 'TOTAL COGS', v: totalCOGS, bold: true, big: true, color: 'var(--orange)' },
              { l: 'GROSS PROFIT', v: grossProfit, bold: true, big: true, color: grossProfit >= 0 ? 'var(--teal)' : 'var(--red)', highlight: true },
            ].map((row: any, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: row.big ? '10px 0 4px' : '6px 0', borderTop: row.big ? '2px solid var(--b1)' : 'none', marginLeft: row.sub ? 20 : 0, background: row.highlight ? 'rgba(20,184,166,0.05)' : 'transparent', paddingLeft: row.highlight ? 8 : (row.sub ? 20 : 0), borderRadius: row.highlight ? 6 : 0 }}>
                <span style={{ fontSize: row.big ? 13 : 12.5, fontWeight: row.bold ? 700 : 400, color: row.color || (row.sub ? 'var(--mu2)' : 'var(--tx)') }}>{row.l}</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: row.big ? 14 : 12.5, fontWeight: row.bold ? 800 : 600, color: row.v >= 0 ? (row.color || 'var(--tx)') : 'var(--red)' }}>₹{row.v.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>

          {/* OpEx */}
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--b1)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>OPERATING EXPENSES</div>
            {Object.entries(expByCat).map(([cat, amt], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginLeft: 20 }}>
                <span style={{ fontSize: 12.5, color: 'var(--mu2)' }}>{cat}</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: 12.5, color: 'var(--red)' }}>₹{(amt as number).toLocaleString('en-IN')}</span>
              </div>
            ))}
            {Object.keys(expByCat).length === 0 && <div style={{ fontSize: 12, color: 'var(--mu)', marginLeft: 20 }}>No expenses recorded</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', borderTop: '2px solid var(--b1)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>TOTAL OPERATING EXPENSES</span>
              <span style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 800, color: 'var(--purple)' }}>₹{totalExpenses.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Net */}
          <div style={{ padding: '20px 22px', background: netProfit >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)' }}>
            {[
              { l: 'Pending Commissions (unpaid)', v: -pendingCommissions, color: 'var(--orange)', note: '(not yet paid)' },
              { l: 'NET PROFIT / LOSS', v: netProfit, bold: true, big: true, color: netProfit >= 0 ? 'var(--green)' : 'var(--red)' },
              { l: 'Net Profit Margin', v: netMargin, isPercent: true, bold: true, color: netMargin >= 20 ? 'var(--green)' : netMargin >= 10 ? 'var(--gold)' : 'var(--red)' },
            ].map((row: any, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < 2 ? '1px solid var(--b1)' : 'none' }}>
                <div>
                  <span style={{ fontSize: row.big ? 15 : 12.5, fontWeight: row.bold ? 800 : 500, color: row.color, fontFamily: row.big ? 'Syne' : 'inherit' }}>{row.l}</span>
                  {row.note && <span style={{ fontSize: 10, color: 'var(--mu)', marginLeft: 8 }}>{row.note}</span>}
                </div>
                <span style={{ fontFamily: 'DM Mono', fontSize: row.big ? 22 : 12.5, fontWeight: row.bold ? 800 : 600, color: row.v >= 0 ? row.color : 'var(--red)' }}>
                  {row.isPercent ? row.v + '%' : row.v < 0 ? '(₹' + Math.abs(row.v).toLocaleString('en-IN') + ')' : '₹' + row.v.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPENSES */}
      {tab === 'expenses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>Expenses <span style={{ color: 'var(--mu)', fontWeight: 500, fontSize: 13 }}>({expenses.length} · ₹{totalExpenses.toLocaleString('en-IN')})</span></div>
            <button onClick={() => setShowAddExpense(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>+ Add Expense</button>
          </div>

          {/* Category summary */}
          {Object.keys(expByCat).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 9, marginBottom: 14 }}>
              {Object.entries(expByCat).sort((a,b) => (b[1] as number) - (a[1] as number)).slice(0,5).map(([cat, amt], i) => (
                <div key={i} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>{cat}</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: COLORS[i] }}>₹{(amt as number).toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>{['Title','Category','Amount','Date','Notes',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {expenses.map((e, i) => (
                  <tr key={i} onMouseOver={ev => ev.currentTarget.style.background='rgba(255,255,255,0.018)'} onMouseOut={ev => ev.currentTarget.style.background=''}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{e.title}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: 'rgba(139,92,246,0.12)', color: 'var(--purple)' }}>{e.category}</span></td>
                    <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 13, color: 'var(--red)' }}>₹{(e.amount||0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--mu)' }}>{e.date ? new Date(e.date).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--mu2)', maxWidth: 180 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes||'—'}</div></td>
                    <td style={{ padding: '10px 14px' }}><button onClick={() => deleteExpense(e.id)} style={{ padding: '3px 9px', background: 'var(--rdL)', border: 'none', borderRadius: 5, color: 'var(--red)', fontSize: 10.5, cursor: 'pointer' }}>Del</button></td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No expenses yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SHIPPING TAB */}
      {tab === 'shipping' && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { l: 'Total Shipping', v: '₹' + totalShipping.toLocaleString('en-IN'), c: 'var(--orange)', sub: deliveredOrders.length + ' orders' },
              { l: 'COD Shipping', v: '₹' + shippingCOD.toLocaleString('en-IN'), c: 'var(--red)', sub: codOrders.length + ' orders' },
              { l: 'Prepaid Shipping', v: '₹' + shippingPrepaid.toLocaleString('en-IN'), c: 'var(--green)', sub: prepaidOrders.length + ' orders' },
              { l: 'Avg per Order', v: deliveredOrders.length > 0 ? '₹' + Math.round(totalShipping/deliveredOrders.length) : '—', c: 'var(--gold)', sub: 'avg cost' },
            ].map((s,i) => (
              <div key={i} className="card">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>{s.l}</div>
                <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.c, marginBottom: 3 }}>{s.v}</div>
                <div style={{ fontSize: 10, color: 'var(--mu)' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Zone rates table */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Shipping Zone Rates</div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr>{['Zone','Base Charge','Per Extra KG','COD Rate','0.3kg Prepaid','0.3kg COD'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {ZONES.map((z, i) => {
                    const prepaidRate = calcShipping(settings.defaultWeight, z.id, 'prepaid', settings.codCharge, settings.fuelSurcharge)
                    const codRate = calcShipping(settings.defaultWeight, z.id, 'cod', settings.codCharge, settings.fuelSurcharge)
                    return (
                      <tr key={i} style={{ background: z.id === settings.defaultZone ? 'var(--gL)' : 'transparent' }} onMouseOver={e => { if (z.id !== settings.defaultZone) e.currentTarget.style.background='rgba(255,255,255,0.02)' }} onMouseOut={e => { if (z.id !== settings.defaultZone) e.currentTarget.style.background='transparent' }}>
                        <td style={{ padding: '9px 12px', fontSize: 12.5, fontWeight: z.id === settings.defaultZone ? 700 : 500 }}>
                          {z.label}
                          {z.id === settings.defaultZone && <span style={{ marginLeft: 6, fontSize: 9, background: 'var(--gL)', color: 'var(--gold)', padding: '1px 7px', borderRadius: 50, fontWeight: 700 }}>DEFAULT</span>}
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontSize: 12 }}>₹{z.base}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontSize: 12 }}>₹{z.perKg}/kg</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--red)' }}>+₹{settings.codCharge}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>₹{prepaidRate}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>₹{codRate}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shipping Calculator */}
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>🧮 Shipping Calculator</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Weight per product (kg)</label>
                <input type="number" step="0.1" value={shipCalc.weight} onChange={e => setShipCalc(p => ({...p, weight: Number(e.target.value)}))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Quantity</label>
                <input type="number" min="1" value={shipCalc.qty} onChange={e => setShipCalc(p => ({...p, qty: Number(e.target.value)}))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Destination Zone</label>
                <select value={shipCalc.zone} onChange={e => setShipCalc(p => ({...p, zone: e.target.value}))} style={inp}>
                  {ZONES.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Payment Type</label>
                <select value={shipCalc.payment} onChange={e => setShipCalc(p => ({...p, payment: e.target.value as any}))} style={inp}>
                  <option value="prepaid">Prepaid</option>
                  <option value="cod">Cash on Delivery (COD)</option>
                </select>
              </div>
            </div>

            <div style={{ background: 'var(--s2)', borderRadius: 12, padding: '18px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>
                {shipCalc.weight * shipCalc.qty} kg · {ZONES.find(z => z.id === shipCalc.zone)?.label} · {shipCalc.payment === 'cod' ? 'COD' : 'Prepaid'}
              </div>
              <div style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: shipCalc.payment === 'cod' ? 'var(--orange)' : 'var(--green)' }}>
                ₹{shipCalcResult}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 6 }}>
                Base: ₹{ZONES.find(z => z.id === shipCalc.zone)?.base || 0}
                {shipCalc.weight * shipCalc.qty > 0.5 && ` + ₹${Math.round((shipCalc.weight * shipCalc.qty - 0.5) * (ZONES.find(z => z.id === shipCalc.zone)?.perKg || 0))} weight charge`}
                {shipCalc.payment === 'cod' && ` + ₹${settings.codCharge} COD`}
                {settings.fuelSurcharge > 0 && ` + ${settings.fuelSurcharge}% fuel surcharge`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Revenue Breakdown</div>
              {[
                { l: 'Gross Revenue', v: grossRevenue, c: 'var(--green)' },
                { l: 'Consultation Rev', v: consultationRevenue, c: 'var(--teal)' },
                { l: 'Pending Revenue', v: pendingRevenue, c: 'var(--orange)' },
              ].map((s,i) => {
                const pct = Math.round(s.v / Math.max(grossRevenue + consultationRevenue, 1) * 100)
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>{s.l}</span>
                      <span style={{ fontFamily: 'DM Mono', color: s.c }}>₹{s.v.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: s.c, borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Cost Breakdown</div>
              {[
                { l: 'Production', v: productionCost, c: 'var(--orange)' },
                { l: 'Packaging', v: packagingCost, c: 'var(--gold)' },
                { l: 'Shipping (COD)', v: shippingCOD, c: 'var(--red)' },
                { l: 'Shipping (Prepaid)', v: shippingPrepaid, c: 'var(--green)' },
                { l: 'Commissions', v: specialistCommissions, c: 'var(--teal)' },
                { l: 'Op Expenses', v: totalExpenses, c: 'var(--purple)' },
              ].map((s,i) => {
                const total = productionCost + packagingCost + totalShipping + specialistCommissions + totalExpenses
                const pct = total > 0 ? Math.round(s.v / total * 100) : 0
                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{s.l}</span>
                      <span style={{ fontFamily: 'DM Mono', color: s.c, fontSize: 10 }}>₹{s.v.toLocaleString('en-IN')} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: s.c, borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Monthly profit trend */}
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Monthly Profit Trend</div>
            {monthlyData.map((m, i) => (
              <div key={i} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{m.month}</span>
                  <div style={{ display: 'flex', gap: 14, fontFamily: 'DM Mono' }}>
                    <span style={{ color: 'var(--green)', fontSize: 10.5 }}>₹{m.revenue.toLocaleString('en-IN')}</span>
                    <span style={{ color: 'var(--red)', fontSize: 10.5 }}>₹{m.expenses.toLocaleString('en-IN')}</span>
                    <span style={{ color: m.profit >= 0 ? 'var(--gold)' : 'var(--red)', fontWeight: 700 }}>{m.profit >= 0 ? '+' : ''}₹{m.profit.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: Math.round(m.revenue / maxMonthRev * 100) + '%', background: 'var(--green)', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* General */}
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>⚙️ General Settings</div>
            <div style={{ background: 'var(--blL)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 11.5, color: 'var(--blue)', lineHeight: 1.6 }}>
              💡 These auto-calculate COGS and P&L from your orders.
            </div>
            {[
              { k: 'gstRate', l: 'GST Rate (%)', help: 'GST % included in MRP' },
              { k: 'packagingPerOrder', l: 'Packaging per Order (₹)', help: 'Box, tape, sticker etc.' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                <input type="number" value={(settings as any)[f.k]} onChange={e => setSettings(s => ({...s, [f.k]: Number(e.target.value)}))} style={inp} />
                <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: -6, marginBottom: 8 }}>{f.help}</div>
              </div>
            ))}

            {/* Production cost source */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Production Cost Source</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSettings(s => ({...s, useProductLabCost: false}))} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--b2)', background: !settings.useProductLabCost ? 'var(--gL)' : 'var(--s2)', color: !settings.useProductLabCost ? 'var(--gold)' : 'var(--mu)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>
                  % of Revenue
                </button>
                <button onClick={() => setSettings(s => ({...s, useProductLabCost: true}))} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--b2)', background: settings.useProductLabCost ? 'var(--gL)' : 'var(--s2)', color: settings.useProductLabCost ? 'var(--gold)' : 'var(--mu)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>
                  Product Lab
                </button>
              </div>
              {!settings.useProductLabCost && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Production Cost % of Net Revenue</label>
                  <input type="number" value={settings.productionCostPct} onChange={e => setSettings(s => ({...s, productionCostPct: Number(e.target.value)}))} style={inp} />
                </div>
              )}
              {settings.useProductLabCost && products.length > 0 && (
                <div style={{ marginTop: 10, background: 'var(--grL)', borderRadius: 8, padding: '10px 12px', fontSize: 11.5, color: 'var(--green)', lineHeight: 1.6 }}>
                  ✓ Using Product Lab data — {products.filter(p => p.cost > 0 && p.price > 0).length} products with cost data
                </div>
              )}
            </div>
          </div>

          {/* Shipping Settings */}
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>🚚 Shipping Settings</div>
            <div style={{ background: 'var(--orL)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 11.5, color: 'var(--orange)', lineHeight: 1.6 }}>
              📦 Shipping = Base charge + Weight charge + COD (if applicable) + Fuel surcharge
            </div>
            {[
              { k: 'codCharge', l: 'COD Charge (₹)', help: 'Extra charge for Cash on Delivery orders' },
              { k: 'fuelSurcharge', l: 'Fuel Surcharge (%)', help: 'Courier fuel surcharge % (typically 5%)' },
              { k: 'defaultWeight', l: 'Avg Product Weight (kg)', help: 'Used for bulk calculations (e.g. 0.3 = 300g)' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                <input type="number" step="0.1" value={(settings as any)[f.k]} onChange={e => setSettings(s => ({...s, [f.k]: Number(e.target.value)}))} style={inp} />
                <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: -6, marginBottom: 8 }}>{f.help}</div>
              </div>
            ))}
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Default Shipping Zone</label>
            <select value={settings.defaultZone} onChange={e => setSettings(s => ({...s, defaultZone: e.target.value}))} style={inp}>
              {ZONES.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
            <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: -6, marginBottom: 14 }}>Used for bulk P&L calculations. Per-order zone tracking needs ShipRocket API.</div>

            {/* Live preview */}
            <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>Live Preview — Avg {settings.defaultWeight}kg</div>
              {ZONES.filter(z => z.id === settings.defaultZone).map(z => (
                <div key={z.id} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, textAlign: 'center', background: 'var(--grL)', borderRadius: 8, padding: '10px' }}>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>₹{calcShipping(settings.defaultWeight, z.id, 'prepaid', settings.codCharge, settings.fuelSurcharge)}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--mu)', marginTop: 3 }}>Prepaid</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', background: 'var(--orL)', borderRadius: 8, padding: '10px' }}>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 18, fontWeight: 800, color: 'var(--orange)' }}>₹{calcShipping(settings.defaultWeight, z.id, 'cod', settings.codCharge, settings.fuelSurcharge)}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--mu)', marginTop: 3 }}>COD</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <button onClick={saveSettings} disabled={savingSettings} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 9, color: '#08090C', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit' }}>
              {savingSettings ? 'Saving...' : '💾 Save All Settings'}
            </button>
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {showAddExpense && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 28px', width: 460, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Expense</div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Title*</label>
            <input value={expenseForm.title} onChange={e => setExpenseForm(p => ({...p, title: e.target.value}))} placeholder="Meta Ads, Office rent..." style={inp} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Amount (₹)*</label>
                <input type="number" value={expenseForm.amount || ''} onChange={e => setExpenseForm(p => ({...p, amount: Number(e.target.value)}))} placeholder="0" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Date</label>
                <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({...p, date: e.target.value}))} style={inp} />
              </div>
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Category</label>
            <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({...p, category: e.target.value}))} style={inp}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Notes</label>
            <input value={expenseForm.notes} onChange={e => setExpenseForm(p => ({...p, notes: e.target.value}))} placeholder="Details..." style={inp} />
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAddExpense(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addExpense} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
