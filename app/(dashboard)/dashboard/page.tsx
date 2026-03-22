'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import toast from 'react-hot-toast'

interface DashboardData {
  todayRevenue: number
  todayOrders: number
  monthRevenue: number
  totalOrders: number
  totalCustomers: number
  totalLeads: number
  openTasks: number
  pendingConsultations: number
  ordersByStatus: Record<string, number>
  revenueChart: Array<{ date: string; revenue: number; orders: number }>
  topProducts: Array<{ name: string; units: number; revenue: number }>
  recentOrders: any[]
  recentLeads: any[]
  lowStockProducts: any[]
  monthlyProfit: number
  totalExpenses: number
  adSpend: number
  roas: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mongoConnected, setMongoConnected] = useState(false)
  const mongoUrl = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null

  useEffect(() => {
    loadDashboard()
    // Refresh every 5 minutes
    const interval = setInterval(loadDashboard, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const [sbOrders, sbLeads, sbTasks, sbExpenses, sbGoals, sbConsultations] = await Promise.all([
        supabase.from('hq_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*'),
        supabase.from('expenses').select('*').gte('date', new Date(new Date().setDate(1)).toISOString().split('T')[0]),
        supabase.from('goals').select('*').eq('status', 'active'),
        supabase.from('consultations').select('id, status'),
      ])

      const orders = sbOrders.data || []
      const leads = sbLeads.data || []
      const tasks = sbTasks.data || []
      const expenses = sbExpenses.data || []
      const consultations = sbConsultations.data || []

      // Try MongoDB
      let mongoOrders: any[] = []
      let mongoCustomers = 0
      let mongoProducts: any[] = []
      if (mongoUrl) {
        try {
          const [ordersRes, analyticsRes, productsRes] = await Promise.all([
            fetch(mongoUrl + '/api/orders').then(r => r.ok ? r.json() : []),
            fetch(mongoUrl + '/api/analytics').then(r => r.ok ? r.json() : null),
            fetch(mongoUrl + '/api/products').then(r => r.ok ? r.json() : []),
          ])
          mongoOrders = Array.isArray(ordersRes) ? ordersRes : []
          mongoCustomers = typeof analyticsRes?.customers === 'number' ? analyticsRes.customers : 0
          mongoProducts = Array.isArray(productsRes) ? productsRes : []
          setMongoConnected(true)
        } catch {}
      }

      const allOrders = [
        ...mongoOrders.map((o: any) => ({ ...o, _source: 'website', amount: o.amount || o.pricing?.total || 0 })),
        ...orders.map(o => ({ ...o, _source: 'hq' }))
      ]

      const today = new Date().toISOString().split('T')[0]
      const todayOrders = allOrders.filter(o => {
        const d = new Date(o.createdAt || o.created_at)
        return d.toISOString().split('T')[0] === today
      })

      const deliveredOrders = allOrders.filter(o =>
        ['Delivered', 'delivered', 'DELIVERED'].includes(o.trackingStatus || o.status || '')
      )

      const todayRevenue = todayOrders.reduce((s, o) => s + (o.amount || o.pricing?.total || 0), 0)
      const monthRevenue = allOrders
        .filter(o => {
          const d = new Date(o.createdAt || o.created_at)
          return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear()
        })
        .reduce((s, o) => s + (o.amount || o.pricing?.total || 0), 0)

      // Order status counts
      const ordersByStatus: Record<string, number> = {}
      allOrders.forEach(o => {
        const s = o.trackingStatus || o.status || 'Unknown'
        ordersByStatus[s] = (ordersByStatus[s] || 0) + 1
      })

      // Revenue chart (last 14 days)
      const revenueChart: Array<{ date: string; revenue: number; orders: number }> = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const dayOrders = allOrders.filter(o => {
          const od = new Date(o.createdAt || o.created_at)
          return od.toISOString().split('T')[0] === dateStr
        })
        revenueChart.push({
          date: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          revenue: dayOrders.reduce((s, o) => s + (o.amount || o.pricing?.total || 0), 0),
          orders: dayOrders.length,
        })
      }

      // Top products
      const productSales: Record<string, { units: number; revenue: number }> = {}
      allOrders.filter(o => !['cancelled', 'CANCELLED'].includes(o.status || '')).forEach(o => {
        const items = o.items || []
        items.forEach((item: any) => {
          const name = item.productSnapshot?.name || item.name || 'Unknown'
          if (!productSales[name]) productSales[name] = { units: 0, revenue: 0 }
          productSales[name].units += item.quantity || 1
          productSales[name].revenue += item.price?.final || item.price || 0
        })
      })
      const topProducts = Object.entries(productSales)
        .sort((a, b) => b[1].units - a[1].units)
        .slice(0, 5)
        .map(([name, d]) => ({ name: name.split(' ').slice(0, 3).join(' '), ...d, revenue: Math.round(d.revenue) }))

      // Low stock
      const lowStockProducts = mongoProducts.filter(p => {
        const stock = p.stock || p.variants?.reduce((s: number, v: any) => s + (v.stock || 0), 0) || 0
        return stock < (p.lowStockThreshold || 10)
      }).slice(0, 5)

      // Finance
      const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
      const adSpend = expenses.filter(e => e.category === 'Ad Spend').reduce((s, e) => s + (e.amount || 0), 0)
      const monthlyProfit = monthRevenue - totalExpenses
      const roas = adSpend > 0 ? monthRevenue / adSpend : 0

      setData({
        todayRevenue,
        todayOrders: todayOrders.length,
        monthRevenue,
        totalOrders: allOrders.length,
        totalCustomers: mongoCustomers || leads.length,
        totalLeads: leads.length,
        openTasks: tasks.filter(t => t.status !== 'done').length,
        pendingConsultations: consultations.filter(c => ['pending', 'scheduled'].includes(c.status)).length,
        ordersByStatus,
        revenueChart,
        topProducts,
        recentOrders: allOrders.slice(0, 5),
        recentLeads: leads.slice(0, 5),
        lowStockProducts,
        monthlyProfit,
        totalExpenses,
        adSpend,
        roas,
      })
    } catch (err) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[var(--mu)] text-sm">Loading dashboard...</p>
      </div>
    </div>
  )

  if (!data) return null

  const kpis = [
    { label: 'Today Revenue', value: `₹${data.todayRevenue.toLocaleString('en-IN')}`, sub: `${data.todayOrders} orders today`, color: 'var(--gold)', trend: '+12%' },
    { label: 'Month Revenue', value: `₹${data.monthRevenue.toLocaleString('en-IN')}`, sub: 'This month total', color: 'var(--green)', trend: '+9%' },
    { label: 'Total Orders', value: data.totalOrders, sub: 'All sources', color: 'var(--blue)', trend: `+${data.todayOrders}` },
    { label: 'Active Leads', value: data.totalLeads, sub: 'In CRM', color: 'var(--purple)', trend: '' },
    { label: 'Month Profit', value: `₹${Math.abs(data.monthlyProfit).toLocaleString('en-IN')}`, sub: data.monthlyProfit >= 0 ? 'Net profit' : 'Net loss', color: data.monthlyProfit >= 0 ? 'var(--green)' : 'var(--red)', trend: '' },
    { label: 'ROAS', value: `${data.roas.toFixed(2)}×`, sub: `Ad spend: ₹${data.adSpend.toLocaleString('en-IN')}`, color: 'var(--teal)', trend: '' },
  ]

  const statusColors: Record<string, string> = {
    NEW: 'var(--blue)', Shipped: 'var(--purple)', Delivered: 'var(--green)',
    Cancelled: 'var(--red)', RTO: 'var(--orange)', Processing: 'var(--gold)'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-syne">
            Good morning, <span className="text-[var(--gold)]">Ayan</span> ✦
          </h1>
          <p className="text-[var(--mu)] text-sm mt-1">
            {mongoConnected ? '🍃 Live: MongoDB + Supabase' : '📊 Supabase data'}
            {' · '}
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--s2)] border border-[var(--b2)] text-[var(--mu2)] hover:text-[var(--tx)] transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <div key={i} className="card">
            <div className="text-[10px] font-bold text-[var(--mu)] uppercase tracking-wider mb-2">{kpi.label}</div>
            <div className="text-2xl font-bold font-syne" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[11px] text-[var(--mu)] mt-1">{kpi.sub}</div>
            {kpi.trend && <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 bg-[var(--grL)] text-[var(--green)]">{kpi.trend}</span>}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-syne text-sm">Revenue & Orders (14 days)</h3>
            <span className="tag tag-green">Live</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.revenueChart}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: 'var(--mu)', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--mu)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#22C55E" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Pie */}
        <div className="card">
          <h3 className="font-bold font-syne text-sm mb-4">Order Status</h3>
          <div className="space-y-2">
            {Object.entries(data.ordersByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColors[status] || 'var(--mu)' }} />
                <span className="text-[12px] flex-1 text-[var(--mu2)]">{status}</span>
                <span className="text-[12px] font-bold font-mono" style={{ color: statusColors[status] || 'var(--mu)' }}>{count}</span>
              </div>
            ))}
            {Object.keys(data.ordersByStatus).length === 0 && (
              <p className="text-[var(--mu)] text-sm text-center py-4">No orders yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Three Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Recent Orders */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold font-syne text-sm">Recent Orders</h3>
            <a href="/orders" className="text-[11px] text-[var(--gold)] hover:opacity-80">View all →</a>
          </div>
          <div className="space-y-2">
            {data.recentOrders.map((o, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-[var(--b1)] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{o.customerName || o.customer_name || 'Customer'}</div>
                  <div className="text-[11px] text-[var(--mu)] truncate">{o.products || o.product || 'Product'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold font-mono">₹{(o.amount || o.pricing?.total || 0).toLocaleString('en-IN')}</div>
                  <span className="tag tag-muted text-[9px]">{o._source === 'website' ? '🍃' : '⚡'}</span>
                </div>
              </div>
            ))}
            {data.recentOrders.length === 0 && <p className="text-[var(--mu)] text-sm text-center py-4">No orders yet</p>}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold font-syne text-sm">Recent Leads</h3>
            <a href="/crm" className="text-[11px] text-[var(--gold)] hover:opacity-80">View all →</a>
          </div>
          <div className="space-y-2">
            {data.recentLeads.map((l, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-[var(--b1)] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium">{l.name}</div>
                  <div className="text-[11px] text-[var(--mu)]">{l.concern || ''} · {l.source || ''}</div>
                </div>
                <span className={`tag ${l.stage === 'converted' ? 'tag-green' : l.stage === 'consult' ? 'tag-orange' : 'tag-gold'}`}>{l.stage || 'new'}</span>
              </div>
            ))}
            {data.recentLeads.length === 0 && <p className="text-[var(--mu)] text-sm text-center py-4">No leads yet</p>}
          </div>
        </div>

        {/* Top Products + Low Stock */}
        <div className="card">
          <h3 className="font-bold font-syne text-sm mb-3">Top Products</h3>
          <div className="space-y-2 mb-4">
            {data.topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--mu)] font-mono w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate">{p.name}</div>
                  <div className="text-[10px] text-[var(--mu)]">{p.units} units · ₹{p.revenue.toLocaleString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>
          {data.lowStockProducts.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-[var(--red)] uppercase tracking-wider mb-2">⚠️ Low Stock</div>
              {data.lowStockProducts.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--b1)] last:border-0">
                  <span className="text-[12px] truncate flex-1">{p.name}</span>
                  <span className="text-[12px] font-bold font-mono text-[var(--red)]">{p.stock || 0}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Finance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Month Revenue', value: `₹${data.monthRevenue.toLocaleString('en-IN')}`, color: 'var(--green)' },
          { label: 'Total Expenses', value: `₹${data.totalExpenses.toLocaleString('en-IN')}`, color: 'var(--orange)' },
          { label: 'Ad Spend', value: `₹${data.adSpend.toLocaleString('en-IN')}`, color: 'var(--blue)' },
          { label: 'Net Profit', value: `₹${Math.abs(data.monthlyProfit).toLocaleString('en-IN')}`, color: data.monthlyProfit >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map((item, i) => (
          <div key={i} className="card text-center">
            <div className="text-[10px] font-bold text-[var(--mu)] uppercase tracking-wider mb-2">{item.label}</div>
            <div className="text-xl font-bold font-syne" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
