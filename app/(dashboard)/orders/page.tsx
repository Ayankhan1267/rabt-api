'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const HQ_STATUSES = ['New', 'Processing', 'Packed', 'Shipped', 'Delivered', 'Returned', 'RTO', 'Cancelled']
const STATUS_COLORS: Record<string, string> = {
  delivered: 'var(--green)', new: 'var(--blue)', cancelled: 'var(--red)',
  canceled: 'var(--red)', processing: 'var(--gold)', shipped: 'var(--purple)',
  returned: 'var(--orange)', rto: 'var(--red)', packed: 'var(--teal)',
  Delivered: 'var(--green)', New: 'var(--blue)', Cancelled: 'var(--red)',
  Processing: 'var(--gold)', Shipped: 'var(--purple)', Returned: 'var(--orange)',
  RTO: 'var(--red)', Packed: 'var(--teal)',
}
const STATUS_BG: Record<string, string> = {
  delivered: 'var(--grL)', new: 'var(--blL)', cancelled: 'var(--rdL)',
  canceled: 'var(--rdL)', processing: 'var(--gL)', shipped: 'rgba(139,92,246,0.15)',
  returned: 'var(--orL)', rto: 'var(--rdL)', packed: 'rgba(20,184,166,0.15)',
  Delivered: 'var(--grL)', New: 'var(--blL)', Cancelled: 'var(--rdL)',
  Processing: 'var(--gL)', Shifted: 'rgba(139,92,246,0.15)', Returned: 'var(--orL)',
  RTO: 'var(--rdL)', Packed: 'rgba(20,184,166,0.15)',
}

function getRealStatus(o: any) { return (o.orderStatus || o.status || 'new').toLowerCase() }
function getStatusDisplay(o: any) { const s = getRealStatus(o); return s.charAt(0).toUpperCase() + s.slice(1) }
function normalizePayment(o: any) { return (o.paymentMethod || o.payment_method || '').toLowerCase() === 'cod' ? 'COD' : 'Prepaid' }
function isPaymentFailed(o: any) { return (o.paymentMethod || o.payment_method || '').toLowerCase() !== 'cod' && (o.paymentStatus || o.payment_status || '') === 'pending' }
function isCancelled(o: any) { const s = (o.orderStatus || o.status || '').toLowerCase(); return ['cancelled','canceled','rto','returned'].includes(s) }
function isDelivered(o: any) { return getRealStatus(o) === 'delivered' }

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [mongoOrders, setMongoOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [posLoading, setPosLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    address: '', city: '', state: '', pincode: '',
    courier: '', status: 'New', payment_method: 'Prepaid', notes: ''
  })

  useEffect(() => { setMounted(true); loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    try {
      const { data } = await supabase.from('hq_orders').select('*').order('created_at', { ascending: false })
      setOrders(data || [])
      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (url) {
        const res = await fetch(url + '/api/orders')
        if (res.ok) setMongoOrders(await res.json())
      }
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  async function openPOS() {
    setShowAddModal(true)
    setPosLoading(true)
    try {
      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (url) {
        const [prodRes, couponRes] = await Promise.all([
          fetch(url + '/api/products').then(r => r.ok ? r.json() : []),
          fetch(url + '/api/coupons').then(r => r.ok ? r.json() : []),
        ])
        setProducts(Array.isArray(prodRes) ? prodRes : [])
        setCoupons(Array.isArray(couponRes) ? couponRes : [])
      }
    } catch {}
    setPosLoading(false)
  }

  const allOrders = [
    ...mongoOrders.filter(o => o.source !== 'hq' && o.source !== 'specialist_offline').map(o => ({ ...o, _source: 'website' })),
    ...mongoOrders.filter(o => o.source === 'specialist_offline').map(o => ({ ...o, _source: 'specialist' })),
    ...orders.filter(o => o.source !== 'specialist_offline').map(o => ({ ...o, _source: 'hq' }))
  ]

  const filtered = allOrders.filter(o => {
    if (statusFilter !== 'all' && getRealStatus(o) !== statusFilter) return false
    if (paymentFilter !== 'all' && normalizePayment(o).toLowerCase() !== paymentFilter) return false
    if (sourceFilter !== 'all' && o._source !== sourceFilter) return false
    if (search) {
      const s = search.toLowerCase()
      const name = (o.customerName || o.customer_name || '').toLowerCase()
      const phone = (o.customerPhone || o.customer_phone || '').toLowerCase()
      const num = (o.orderNumber || o.id || '').toString().toLowerCase()
      if (!name.includes(s) && !phone.includes(s) && !num.includes(s)) return false
    }
    return true
  })

  const deliveredOrders = allOrders.filter(isDelivered)
  const activeOrders = allOrders.filter(o => { const s = (o.orderStatus || o.status || '').toLowerCase(); return s !== 'delivered' && s !== 'cancelled' && s !== 'canceled' && s !== 'rto' && s !== 'returned' })
  const deliveredRev = deliveredOrders.reduce((s, o) => s + (o.amount || 0), 0)
  const activeRev = activeOrders.reduce((s, o) => s + (o.amount || 0), 0)
  const codCount = allOrders.filter(o => normalizePayment(o) === 'COD').length
  const prepaidCount = allOrders.filter(o => normalizePayment(o) === 'Prepaid' && !isPaymentFailed(o)).length
  const failedCount = allOrders.filter(isPaymentFailed).length
  const cancelledCount = allOrders.filter(isCancelled).length

  function addToCart(product: any, variant: any) {
    const key = product._id + (variant?.sku || '')
    const existing = cart.find((c: any) => c._key === key)
    if (existing) setCart(cart.map((c: any) => c._key === key ? { ...c, qty: c.qty + 1 } : c))
    else setCart([...cart, { ...product, _key: key, variant, qty: 1, price: variant?.price || product.price || 0 }])
  }

  function removeFromCart(i: number) { setCart(cart.filter((_: any, ci: number) => ci !== i)) }

  function applyCoupon() {
    if (!couponCode) return
    const c = coupons.find((c: any) => c.code?.toLowerCase() === couponCode.toLowerCase() && c.isActive !== false)
    if (!c) { toast.error('Invalid coupon'); return }
    if (c.expiryDate && new Date(c.expiryDate) < new Date()) { toast.error('Coupon expired!'); return }
    const subtotal = cart.reduce((s: number, i: any) => s + (Number(i.price) * Number(i.qty)), 0)
    if (c.minimumAmount && subtotal < c.minimumAmount) { toast.error('Minimum order Rs.' + c.minimumAmount + ' required'); return }
    setCouponApplied(c)
    const discVal = Number(c.discount) || 0
    const disc = c.discountType === 'percentage' ? Math.min(subtotal * discVal / 100, Number(c.maximumDiscount) || 9999) : discVal
    toast.success('Coupon applied! Rs.' + Math.round(disc) + ' off')
  }

  function getCartTotal() {
    const subtotal = cart.reduce((s: number, i: any) => s + (Number(i.price) * Number(i.qty)), 0)
    let discount = 0
    if (couponApplied) {
      const discVal = Number(couponApplied.discount) || 0
      if (couponApplied.discountType === 'percentage') { discount = subtotal * discVal / 100; discount = Math.min(discount, Number(couponApplied.maximumDiscount) || 99999) }
      else discount = discVal
    }
    return { subtotal: Math.round(subtotal), discount: Math.round(discount), total: Math.round(Math.max(0, subtotal - discount)) }
  }

  async function addOrder() {
    if (!form.customer_name || !form.customer_phone) { toast.error('Name aur phone required'); return }
    if (cart.length === 0) { toast.error('Cart mein product add karo'); return }
    toast.loading('Order create ho raha hai...', { id: 'add' })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const totals = getCartTotal()
      const productNames = cart.map((i: any) => i.name).join(', ')
      let mongoId = ''
      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (url) {
        try {
          const mRes = await fetch(url + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: form.customer_name, customerPhone: form.customer_phone, customerEmail: form.customer_email, address: form.address, city: form.city, state: form.state, pincode: form.pincode, products: productNames, items: cart.map((i: any) => ({ name: i.name, image: i.image || '', category: i.category || '', variant: i.variant || {}, qty: i.qty, price: i.price })), amount: totals.total, paymentMethod: form.payment_method, status: form.status, notes: form.notes, courier: form.courier, couponCode: couponApplied?.code || '', couponDiscount: totals.discount }) })
          const mData = await mRes.json()
          mongoId = mData.orderId?.toString() || ''
        } catch {}
      }
      await supabase.from('hq_orders').insert({ customer_name: form.customer_name, customer_phone: form.customer_phone, customer_email: form.customer_email, product: productNames, amount: totals.total, courier: form.courier, status: form.status, payment_method: form.payment_method, notes: form.notes, mongo_id: mongoId, created_by: user?.id })
      toast.success('Order created!', { id: 'add' })
      setShowAddModal(false); setCart([]); setCouponCode(''); setCouponApplied(null)
      setForm({ customer_name: '', customer_phone: '', customer_email: '', address: '', city: '', state: '', pincode: '', courier: '', status: 'New', payment_method: 'Prepaid', notes: '' })
      loadOrders()
    } catch (e: any) { toast.error('Error: ' + e.message, { id: 'add' }) }
  }

  async function cancelOrder(o: any) {
    if (!confirm('Order cancel karna chahte ho?')) return
    const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
    if (o._source === 'hq') {
      await supabase.from('hq_orders').update({ status: 'Cancelled' }).eq('id', o.id)
      if (url && o.mongo_id) { try { await fetch(url + '/api/orders/' + o.mongo_id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }) } catch {} }
    } else {
      if (url && o._id) { try { await fetch(url + '/api/orders/' + o._id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }) } catch {} }
    }
    toast.success('Order cancelled!'); setShowDetail(null); loadOrders()
  }

  async function updateStatus(id: string, status: string, mongoId?: string) {
    await supabase.from('hq_orders').update({ status }).eq('id', id)
    const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
    if (url && mongoId) { try { await fetch(url + '/api/orders/' + mongoId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: status.toLowerCase() }) }) } catch {} }
    toast.success('Updated!'); loadOrders()
  }

  // Analytics computed
  const productSales: Record<string, {units: number, revenue: number}> = {}
  allOrders.filter(o => !isCancelled(o)).forEach(o => {
    (o.items || []).forEach((item: any) => {
      const name = item.name || item.productSnapshot?.name || 'Unknown'
      if (!productSales[name]) productSales[name] = { units: 0, revenue: 0 }
      productSales[name].units += item.quantity || item.qty || 1
      productSales[name].revenue += (item.price?.final || item.price || 0) * (item.quantity || item.qty || 1)
    })
  })
  const topProducts = Object.entries(productSales).sort((a,b) => b[1].units - a[1].units).slice(0, 8)

  const monthlySales: Record<string, {count: number, revenue: number}> = {}
  allOrders.filter(o => !isCancelled(o)).forEach(o => {
    const d = new Date(o.createdAt || o.created_at || Date.now())
    const key = d.toLocaleDateString('en-IN', {month: 'short', year: '2-digit'})
    if (!monthlySales[key]) monthlySales[key] = { count: 0, revenue: 0 }
    monthlySales[key].count++
    monthlySales[key].revenue += o.amount || 0
  })
  const monthlyEntries = Object.entries(monthlySales).slice(-6)
  const maxMonthlyRev = Math.max(...monthlyEntries.map(([,v]) => v.revenue), 1)

  const statusCounts: Record<string, number> = {}
  allOrders.forEach(o => {
    const s = getRealStatus(o)
    statusCounts[s] = (statusCounts[s] || 0) + 1
  })

  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'Outfit', outline: 'none' }
  const statuses = ['all', 'new', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned', 'rto']

  if (!mounted) return null
  const totals = getCartTotal()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Order <span style={{ color: 'var(--gold)' }}>Management</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{allOrders.length} total � {mongoOrders.length} website � {orders.length} HQ</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAnalytics(!showAnalytics)} style={{ padding: '8px 14px', background: showAnalytics ? 'var(--gL)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (showAnalytics ? 'rgba(212,168,83,0.3)' : 'var(--b1)'), borderRadius: 8, color: showAnalytics ? 'var(--gold)' : 'var(--mu)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>?? Analytics</button>
          <button onClick={loadOrders} style={{ padding: '8px 14px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Refresh</button>
          <button onClick={openPOS} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>+ New Order</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Orders', value: allOrders.length, color: 'var(--blue)' },
          { label: 'Active Revenue', value: 'Rs.' + activeRev.toLocaleString('en-IN'), color: 'var(--gold)' },
          { label: 'Delivered Revenue', value: 'Rs.' + deliveredRev.toLocaleString('en-IN'), color: 'var(--green)' },
          { label: 'COD', value: codCount, color: 'var(--orange)' },
          { label: 'Prepaid', value: prepaidCount, color: 'var(--blue)' },
          { label: 'Cancelled', value: cancelledCount, color: 'var(--red)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ANALYTICS PANEL */}
      {showAnalytics && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Monthly Revenue Chart */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Monthly Revenue</div>
              {monthlyEntries.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No data yet</div>
              ) : monthlyEntries.map(([month, val], i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600 }}>{month}</span>
                    <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--gold)' }}>?{val.revenue.toLocaleString('en-IN')} � {val.count} orders</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--s2)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: Math.round(val.revenue / maxMonthlyRev * 100) + '%', background: 'linear-gradient(90deg,#D4A853,#22C55E)', borderRadius: 5, transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Status Breakdown */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Order Status Breakdown</div>
              {Object.entries(statusCounts).sort((a,b) => b[1]-a[1]).map(([status, count], i) => {
                const pct = Math.round(count / (allOrders.length || 1) * 100)
                const color = STATUS_COLORS[status] || 'var(--mu)'
                const bg = STATUS_BG[status] || 'rgba(255,255,255,0.05)'
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>
                      <span style={{ fontFamily: 'DM Mono', color }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Top Products */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Top Products</div>
              {topProducts.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No product data</div>
              ) : topProducts.map(([name, data], i) => {
                const maxUnits = topProducts[0][1].units || 1
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{name}</span>
                      <span style={{ fontFamily: 'DM Mono', color: 'var(--teal)' }}>{data.units} units � ?{Math.round(data.revenue).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(data.units / maxUnits * 100) + '%', background: 'var(--teal)', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Source + Payment Split */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Source & Payment Split</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>By Source</div>
                {[
                  { label: 'Website', count: allOrders.filter(o => o._source === 'website').length, color: 'var(--green)' },
                  { label: 'HQ', count: allOrders.filter(o => o._source === 'hq').length, color: 'var(--blue)' },
                  { label: 'Specialist', count: allOrders.filter(o => o._source === 'specialist').length, color: 'var(--purple)' },
                ].map((s, i) => {
                  const pct = Math.round(s.count / (allOrders.length || 1) * 100)
                  return (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontFamily: 'DM Mono', color: s.color }}>{s.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: s.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>By Payment</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--orL)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, color: 'var(--orange)' }}>{codCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700 }}>COD</div>
                    <div style={{ fontSize: 10, color: 'var(--mu)' }}>{Math.round(codCount / (allOrders.length || 1) * 100)}%</div>
                  </div>
                  <div style={{ background: 'var(--blL)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{prepaidCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}>Prepaid</div>
                    <div style={{ fontSize: 10, color: 'var(--mu)' }}>{Math.round(prepaidCount / (allOrders.length || 1) * 100)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {failedCount > 0 && (
        <div style={{ background: 'var(--rdL)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, fontSize: 12.5, color: 'var(--red)' }}>
          {failedCount} orders mein payment fail � Razorpay se verify karo
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--mu)' }}>Status:</span>
        {statuses.map(s => (
          <span key={s} onClick={() => setStatusFilter(s)} style={{ padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: statusFilter === s ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: statusFilter === s ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (statusFilter === s ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--mu)' }}>Payment:</span>
        {['all','prepaid','cod'].map(p => (
          <span key={p} onClick={() => setPaymentFilter(p)} style={{ padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: paymentFilter === p ? 'var(--blL)' : 'rgba(255,255,255,0.05)', color: paymentFilter === p ? 'var(--blue)' : 'var(--mu2)', border: '1px solid ' + (paymentFilter === p ? 'rgba(59,130,246,0.3)' : 'var(--b1)') }}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </span>
        ))}
        <span style={{ fontSize: 11, color: 'var(--mu)', marginLeft: 8 }}>Source:</span>
        {[{id:'all',l:'All'},{id:'website',l:'Website'},{id:'hq',l:'HQ'},{id:'specialist',l:'Specialist'}].map(s => (
          <span key={s.id} onClick={() => setSourceFilter(s.id)} style={{ padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: sourceFilter === s.id ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.05)', color: sourceFilter === s.id ? 'var(--teal)' : 'var(--mu2)', border: '1px solid ' + (sourceFilter === s.id ? 'rgba(20,184,166,0.3)' : 'var(--b1)') }}>{s.l}</span>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ ...inp, marginLeft: 8, width: 200 }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />Loading...
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['#Order','Customer','Products','Amount','Payment','Status','Source','Date','Action'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const realStatus = getRealStatus(o)
                const statusColor = STATUS_COLORS[realStatus] || 'var(--mu)'
                const statusBg = STATUS_BG[realStatus] || 'rgba(255,255,255,0.05)'
                const cancelled = isCancelled(o)
                const failed = isPaymentFailed(o)
                return (
                  <tr key={i} onMouseOver={e => (e.currentTarget.style.background='rgba(255,255,255,0.018)')} onMouseOut={e => (e.currentTarget.style.background='')} style={{ opacity: cancelled ? 0.6 : 1 }}>
                    <td style={{ padding: '11px 12px' }}><span style={{ fontFamily: 'DM Mono', color: 'var(--gold)', cursor: 'pointer', fontSize: 11.5 }} onClick={() => setShowDetail(o)}>#{(o.orderNumber || o.id || '').toString().slice(-8)}</span></td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{o.customerName || o.customer_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)' }}>{o.customerPhone || o.customer_phone || ''}</div>
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--mu2)', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.products || o.product || o.items?.[0]?.name || '�'}{(o.itemCount > 1 || o.items?.length > 1) && <span style={{ color: 'var(--mu)', fontSize: 10 }}> +{(o.itemCount || o.items?.length) - 1}</span>}</div>
                    </td>
                    <td style={{ padding: '11px 12px', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 12.5, textDecoration: cancelled ? 'line-through' : 'none', color: cancelled ? 'var(--mu)' : 'var(--tx)' }}>Rs.{(o.amount || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: normalizePayment(o) === 'COD' ? 'var(--orL)' : 'var(--blL)', color: normalizePayment(o) === 'COD' ? 'var(--orange)' : 'var(--blue)', display: 'block', marginBottom: failed ? 3 : 0 }}>{normalizePayment(o)}</span>
                      {failed && <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: 'var(--rdL)', color: 'var(--red)' }}>Failed</span>}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      {o._source === 'hq' ? (
                        <select value={o.status} onChange={e => updateStatus(o.id, e.target.value, o.mongo_id)} style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 6, padding: '4px 8px', color: STATUS_COLORS[o.status] || 'var(--mu2)', fontSize: 11, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit' }}>
                          {HQ_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: statusBg, color: statusColor }}>{getStatusDisplay(o)}</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 12px' }}><span style={{ fontSize: 10, color: o._source === 'website' ? 'var(--green)' : o._source === 'specialist' ? 'var(--purple)' : 'var(--mu)' }}>{o._source === 'website' ? 'Website' : o._source === 'specialist' ? 'Specialist' : 'HQ'}</span></td>
                    <td style={{ padding: '11px 12px', fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>{o.createdAt || o.created_at ? new Date(o.createdAt || o.created_at).toLocaleDateString('en-IN') : '�'}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setShowDetail(o)} style={{ padding: '4px 10px', background: 'var(--gL)', border: 'none', borderRadius: 6, color: 'var(--gold)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit' }}>View</button>
                        {!cancelled && <button onClick={() => cancelOrder(o)} style={{ padding: '4px 8px', background: 'var(--rdL)', border: 'none', borderRadius: 6, color: 'var(--red)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No orders found</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, width: '94vw', maxWidth: 1000, height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>New Order</div>
              <button onClick={() => { setShowAddModal(false); setCart([]); setCouponCode(''); setCouponApplied(null) }} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 20 }}>x</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', overflowY: 'auto', borderRight: '1px solid var(--b1)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Products ({products.length})</div>
                {posLoading ? (
                  <div style={{ textAlign: 'center', padding: 50, color: 'var(--mu)' }}><div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />Loading products...</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {products.map((p: any, i: number) => (
                      <div key={i} style={{ background: 'var(--s2)', borderRadius: 10, padding: 10, border: '1px solid var(--b1)' }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          {p.image && <img src={p.image} alt={p.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>Rs.{p.price}</div>
                          </div>
                        </div>
                        {p.variants && p.variants.length > 1 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {p.variants.map((v: any, vi: number) => (
                              <button key={vi} onClick={() => addToCart(p, v)} style={{ padding: '3px 7px', background: 'var(--gL)', border: 'none', borderRadius: 5, color: 'var(--gold)', fontSize: 10, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>{v.size} Rs.{v.price}</button>
                            ))}
                          </div>
                        ) : (
                          <button onClick={() => addToCart(p, p.variants?.[0])} style={{ width: '100%', padding: '5px', background: 'var(--gL)', border: 'none', borderRadius: 6, color: 'var(--gold)', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>+ Add</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '14px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Customer</div>
                  {([{ k: 'customer_name', l: 'Name*', p: 'Priya Sharma' },{ k: 'customer_phone', l: 'Phone*', p: '+91 9876543210' },{ k: 'customer_email', l: 'Email', p: 'priya@email.com' },{ k: 'address', l: 'Address', p: 'House No, Street' },{ k: 'city', l: 'City', p: 'Mumbai' },{ k: 'state', l: 'State', p: 'Maharashtra' },{ k: 'pincode', l: 'Pincode', p: '400001' }] as any[]).map((f: any) => (
                    <div key={f.k} style={{ marginBottom: 6 }}>
                      <label style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, display: 'block' }}>{f.l}</label>
                      <input value={(form as any)[f.k]} onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))} placeholder={f.p} style={inp} />
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Cart ({cart.length})</div>
                  {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '14px', color: 'var(--mu)', fontSize: 12, background: 'var(--s2)', borderRadius: 8 }}>Left se product add karo</div>
                  ) : cart.map((item: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--b1)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--mu)' }}>{item.variant?.size} Rs.{item.price}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <button onClick={() => setCart(cart.map((c: any, ci: number) => ci === i ? { ...c, qty: Math.max(1, c.qty-1) } : c))} style={{ width: 20, height: 20, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 4, cursor: 'pointer', color: 'var(--tx)', fontSize: 13 }}>-</button>
                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{item.qty}</span>
                        <button onClick={() => setCart(cart.map((c: any, ci: number) => ci === i ? { ...c, qty: c.qty+1 } : c))} style={{ width: 20, height: 20, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 4, cursor: 'pointer', color: 'var(--tx)', fontSize: 13 }}>+</button>
                        <button onClick={() => removeFromCart(i)} style={{ width: 20, height: 20, background: 'var(--rdL)', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'var(--red)', fontSize: 11 }}>x</button>
                      </div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, minWidth: 50, textAlign: 'right' }}>Rs.{(Number(item.price) * Number(item.qty)).toFixed(0)}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Coupon</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="COUPON CODE" style={{ ...inp, flex: 1 }} />
                    <button onClick={applyCoupon} style={{ padding: '8px 12px', background: 'var(--gL)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 8, color: 'var(--gold)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>Apply</button>
                  </div>
                  {couponApplied && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 5, display: 'flex', justifyContent: 'space-between' }}><span>{couponApplied.code} - Rs.{totals.discount} off</span><button onClick={() => { setCouponApplied(null); setCouponCode('') }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}>Remove</button></div>}
                </div>
                {cart.length > 0 && (
                  <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mu)', marginBottom: 4 }}><span>Subtotal</span><span>Rs.{totals.subtotal}</span></div>
                    {totals.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--green)', marginBottom: 4 }}><span>Discount</span><span>-Rs.{totals.discount}</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, fontFamily: 'Syne', borderTop: '1px solid var(--b1)', paddingTop: 6, marginTop: 4 }}><span>Total</span><span style={{ color: 'var(--gold)' }}>Rs.{totals.total}</span></div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, display: 'block' }}>Payment</label>
                    <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} style={inp}><option>Prepaid</option><option>COD</option></select>
                  </div>
                  <div>
                    <label style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, display: 'block' }}>Status</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={inp}>{HQ_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                  </div>
                </div>
                <button onClick={addOrder} disabled={cart.length === 0 || !form.customer_name} style={{ width: '100%', padding: '12px', background: cart.length > 0 && form.customer_name ? 'linear-gradient(135deg,#D4A853,#B87C30)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, color: cart.length > 0 && form.customer_name ? '#08090C' : 'var(--mu)', fontWeight: 800, fontSize: 14, cursor: cart.length > 0 && form.customer_name ? 'pointer' : 'not-allowed', fontFamily: 'Syne' }}>
                  {cart.length > 0 ? 'Create Order � Rs.' + totals.total : 'Cart mein product add karo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDetail(null)}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 540, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800 }}>#{(showDetail.orderNumber || showDetail.id || '').toString().slice(-8)}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{showDetail.createdAt ? new Date(showDetail.createdAt).toLocaleString('en-IN') : ''}</div>
              </div>
              <button onClick={() => setShowDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 16 }}>x</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Customer', value: showDetail.customerName || showDetail.customer_name },
                { label: 'Phone', value: showDetail.customerPhone || showDetail.customer_phone || '�' },
                { label: 'Email', value: showDetail.customerEmail || showDetail.customer_email || '�' },
                { label: 'Amount', value: 'Rs.' + (showDetail.amount || 0).toLocaleString('en-IN') },
                { label: 'Payment', value: normalizePayment(showDetail) + (isPaymentFailed(showDetail) ? ' - Failed' : '') },
                { label: 'Status', value: getStatusDisplay(showDetail) },
                { label: 'City', value: showDetail.city || '�' },
                { label: 'Pincode', value: showDetail.pincode || '�' },
                { label: 'State', value: showDetail.state || '�' },
                { label: 'Courier', value: showDetail.courier || '�' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>
            {showDetail.couponCode && <div style={{ background: 'var(--gL)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>Coupon: <strong>{showDetail.couponCode}</strong> � Discount: Rs.{showDetail.couponDiscount || 0}</div>}
            {showDetail.items?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Products ({showDetail.items.length})</div>
                {showDetail.items.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                    {item.image && <img src={item.image} alt={item.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)' }}>{item.size} � Qty: {item.quantity}</div>
                    </div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 13, fontWeight: 700 }}>Rs.{item.price}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {(showDetail.customerPhone || showDetail.customer_phone) && (
                <a href={`https://wa.me/${(showDetail.customerPhone || showDetail.customer_phone || '').replace(/[^0-9]/g,'')}?text=${encodeURIComponent('Hi ' + (showDetail.customerName || showDetail.customer_name) + '! Your order ' + (showDetail.orderNumber || '') + ' status: ' + getStatusDisplay(showDetail) + '. Thank you! Rabt Naturals')}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                  WhatsApp
                </a>
              )}
              {!isCancelled(showDetail) && (
                <button onClick={() => cancelOrder(showDetail)} style={{ flex: 1, padding: 10, background: 'var(--rdL)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--red)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel Order</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

