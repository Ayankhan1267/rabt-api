'use client'
import { useEffect, useState, useRef } from 'react'
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

export default function SpecialistDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [mongoSpec, setMongoSpec] = useState<any>(null)
  const [consultations, setConsultations] = useState<any[]>([])
  const [skinProfiles, setSkinProfiles] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [unassignedCons, setUnassignedCons] = useState<any[]>([])
  const [rejectedIds, setRejectedIds] = useState<string[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'overview'|'consultations'|'crm'|'skinprofiles'|'earnings'>('overview')

  // Consultation detail
  const [selectedCons, setSelectedCons] = useState<any>(null)
  const [rescheduleModal, setRescheduleModal] = useState<any>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')

  // Payout
  const [payoutModal, setPayoutModal] = useState(false)
  const [payoutForm, setPayoutForm] = useState({ amount: '', upiId: '', upiName: '', method: 'upi' })
  const [payoutLoading, setPayoutLoading] = useState(false)

  // Offline POS
  const [showPOS, setShowPOS] = useState(false)
  const [posStep, setPosStep] = useState<'customer'|'skin'|'analysis'|'notes'|'products'|'payment'>('customer')
  const [offlineCustomer, setOfflineCustomer] = useState({ name: '', phone: '', email: '', city: '', state: '', pincode: '', address: '' })
  const [skinImages, setSkinImages] = useState<string[]>([])
  const [skinConcern, setSkinConcern] = useState('')
  const [skinAge, setSkinAge] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [specNotes, setSpecNotes] = useState({
    primaryConcern: '', secondaryConcern: '', skinSensitivity: 'medium',
    dietIntake: '', dietAvoid: '', lifestyle: '', waterIntake: '',
    skinGoal: '', additionalNotes: ''
  })
  const [cart, setCart] = useState<any[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cod'|'prepaid'>('prepaid')
  const [posLoading, setPosLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      setProfile(prof)
      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (!url) { setLoading(false); return }
      const [specRes, consRes, ordRes, prodRes, couponRes, skinRes, payoutRes] = await Promise.all([
        fetch(url + '/api/specialists').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/consultations').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/orders').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/products').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/coupons').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/skinprofiles').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/payouts').then(r => r.ok ? r.json() : []),
      ])
      const allSpecs = Array.isArray(specRes) ? specRes : []
      const mySpec = allSpecs.find((s: any) => s.email?.toLowerCase() === prof?.email?.toLowerCase())
      setMongoSpec(mySpec)
      const allCons = Array.isArray(consRes) ? consRes : []
      setConsultations(mySpec ? allCons.filter((c: any) => c.assignedSpecialist?.toString() === mySpec._id?.toString()) : [])
      setLeads(mySpec ? allCons.filter((c: any) => c.assignedSpecialist?.toString() === mySpec._id?.toString()) : [])
      setUnassignedCons(allCons.filter((c: any) => c.status === 'pending' && !c.assignedSpecialist && !rejectedIds.includes(c._id?.toString())))
      setOrders(Array.isArray(ordRes) ? ordRes : [])
      setProducts(Array.isArray(prodRes) ? prodRes : [])
      setCoupons(Array.isArray(couponRes) ? couponRes : [])
      setSkinProfiles(Array.isArray(skinRes) ? skinRes : [])
      setPayouts(Array.isArray(payoutRes) ? payoutRes : [])
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  // Earnings
  const completedCons = consultations.filter(c => c.status === 'completed').length
  const consultationEarnings = completedCons * 30
  const myPatientIds = new Set(consultations.map(c => c.userId).filter(Boolean))
  const myPatientOrders = orders.filter(o => { const uid = o.userId || o.user; return (uid && myPatientIds.has(uid)) || o.specialistId?.toString() === mongoSpec?._id?.toString() })
  const myConsIds = new Set(consultations.map(c => c._id?.toString()).filter(Boolean))
  const mySkinProfiles = skinProfiles.filter(p => 
    (p.specialistId?.toString() === mongoSpec?._id?.toString()) ||
    (p.consultationId && myConsIds.has(p.consultationId?.toString()))
  )
  const deliveredOrders = myPatientOrders.filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'delivered')
  const pendingCommissionOrders = myPatientOrders.filter(o => { const s = (o.orderStatus || o.status || '').toLowerCase(); return s !== 'delivered' && s !== 'cancelled' && s !== 'canceled' })
  const commissionEarned = Math.round(deliveredOrders.reduce((s, o) => s + (o.amount || 0) * 0.12, 0))
  const pendingCommission = Math.round(pendingCommissionOrders.reduce((s, o) => s + (o.amount || 0) * 0.12, 0))
  const totalEarnings = consultationEarnings + commissionEarned

  // Cart
  function addToCart(product: any, variant: any) {
    const key = product._id + (variant?.sku || '')
    const existing = cart.find((c: any) => c._key === key)
    if (existing) setCart(cart.map((c: any) => c._key === key ? { ...c, qty: c.qty + 1 } : c))
    else setCart([...cart, { ...product, _key: key, variant, qty: 1, price: variant?.price || product.price || 0 }])
  }

  function getCartTotal() {
    const subtotal = cart.reduce((s: number, i: any) => s + (Number(i.price) * Number(i.qty)), 0)
    let discount = 0
    if (couponApplied) {
      const discVal = Number(couponApplied.discount) || 0
      discount = couponApplied.discountType === 'percentage'
        ? Math.min(subtotal * discVal / 100, Number(couponApplied.maximumDiscount) || 99999)
        : discVal
    }
    return { subtotal: Math.round(subtotal), discount: Math.round(discount), total: Math.round(Math.max(0, subtotal - discount)) }
  }

  function applyCoupon() {
    const c = coupons.find((c: any) => c.code?.toLowerCase() === couponCode.toLowerCase() && c.isActive !== false)
    if (!c) { toast.error('Invalid coupon'); return }
    setCouponApplied(c); toast.success('Coupon applied!')
  }

  // Image upload
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const newImages: string[] = []
    for (let i = 0; i < Math.min(files.length, 4); i++) {
      const reader = new FileReader()
      await new Promise<void>(resolve => {
        reader.onload = () => { newImages.push(reader.result as string); resolve() }
        reader.readAsDataURL(files[i])
      })
    }
    setSkinImages(prev => [...prev, ...newImages].slice(0, 4))
  }

  // AI Skin Analysis
  async function analyzeSkin() {
    if (skinImages.length === 0) { toast.error('Skin photos add karo'); return }
    setAnalyzing(true)
    try {
      const res = await fetch('/api/skin-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: skinImages, concern: skinConcern, age: skinAge })
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setAnalyzing(false); return }
      setAiAnalysis(data.analysis)
      // Auto-add suggested products to cart
      const allSuggested = [...(data.analysis.amRoutine || []), ...(data.analysis.pmRoutine || [])]
      const suggestedNames = allSuggested.map((r: any) => r.product.toLowerCase())
      const matchedProducts = products.filter(p => suggestedNames.some(name => p.name?.toLowerCase().includes(name.toLowerCase().split(' ')[0])))
      if (matchedProducts.length > 0) {
        const newCart = matchedProducts.slice(0, 6).map((p: any) => ({
          ...p, _key: p._id, variant: p.variants?.[0] || {}, qty: 1, price: p.variants?.[0]?.price || p.price || 0
        }))
        setCart(newCart)
      }
      setPosStep('analysis')
    } catch { toast.error('Analysis failed') }
    setAnalyzing(false)
  }

  // Generate & Download PDF
  function generatePDF() {
    const consNum = 'OFF' + Date.now().toString().slice(-10)
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Skin Profile - ${offlineCustomer.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 24px 32px 16px; border-bottom: 2px solid #D4A853; }
  .logo { font-size: 22px; font-weight: 900; color: #1a1a2e; letter-spacing: 1px; }
  .logo span { color: #D4A853; }
  .logo-sub { font-size: 9px; letter-spacing: 3px; color: #888; margin-top: 3px; }
  .header-info { text-align: right; font-size: 12px; color: #444; line-height: 1.8; }
  .header-info strong { color: #1a1a2e; }
  .hero { background: #1a1a2e; color: white; margin: 0 32px; border-radius: 12px; padding: 22px 24px; display: flex; align-items: center; gap: 18px; margin-top: 20px; }
  .hero-avatar { width: 54px; height: 54px; background: #D4A853; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: #1a1a2e; flex-shrink: 0; }
  .hero-name { font-size: 22px; font-weight: 800; }
  .hero-sub { font-size: 12px; color: #aaa; margin-top: 4px; }
  .tags { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .tag { background: rgba(212,168,83,0.2); color: #D4A853; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .section { padding: 20px 32px 0; }
  .section-title { font-size: 10px; font-weight: 700; color: #D4A853; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
  .grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 16px; }
  .grid2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; margin-bottom: 16px; }
  .card { background: #f8f8f8; border-radius: 8px; padding: 12px 14px; }
  .card-label { font-size: 9px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
  .card-value { font-size: 13px; font-weight: 700; color: #1a1a2e; }
  .text-box { background: #fffef5; border: 1px solid #f0e8c8; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; font-size: 13px; color: #444; line-height: 1.6; }
  .product-item { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; align-items: flex-start; }
  .product-img { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #eee; }
  .product-name { font-size: 13px; font-weight: 700; color: #1a1a2e; margin-bottom: 3px; }
  .product-price { font-size: 13px; font-weight: 700; color: #D4A853; margin-bottom: 5px; }
  .product-desc { font-size: 11.5px; color: #666; line-height: 1.5; }
  .spec-section { background: #fffef5; margin: 20px 32px 0; border-radius: 10px; padding: 18px 20px; }
  .spec-title { font-size: 10px; font-weight: 700; color: #D4A853; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 14px; }
  .spec-item { margin-bottom: 14px; }
  .spec-label { font-size: 13px; font-weight: 700; color: #D4A853; margin-bottom: 6px; }
  .spec-value { background: white; border-radius: 6px; padding: 8px 12px; font-size: 12.5px; color: #444; line-height: 1.6; }
  .images-grid { display: flex; gap: 10px; flex-wrap: wrap; }
  .cons-img { width: 100px; height: 100px; border-radius: 8px; object-fit: cover; }
  .footer { text-align: center; padding: 20px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; margin-top: 24px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">RABT <span>NATURALS</span></div>
    <div class="logo-sub">PERSONALIZED SKIN CARE REPORT</div>
  </div>
  <div class="header-info">
    <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</div>
    <div><strong>Consultation:</strong> ${consNum}</div>
    <div><strong>Specialist:</strong> ${mongoSpec?.name || 'Specialist'}</div>
    <div><strong>Status:</strong> Completed</div>
  </div>
</div>

<div class="hero">
  <div class="hero-avatar">${offlineCustomer.name.charAt(0).toUpperCase()}</div>
  <div>
    <div class="hero-name">${offlineCustomer.name}</div>
    <div class="hero-sub">Consultation: ${new Date().toLocaleDateString('en-IN')} � ${new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}</div>
    <div class="tags">
      ${(aiAnalysis?.skinConcerns || [skinConcern]).filter(Boolean).map((c: string) => `<span class="tag">${c}</span>`).join('')}
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Skin Analysis</div>
  <div class="grid3">
    <div class="card"><div class="card-label">Skin Type</div><div class="card-value">${aiAnalysis?.skinType || '�'}</div></div>
    <div class="card"><div class="card-label">Stress Level</div><div class="card-value">${specNotes.lifestyle || 'Not specified'}</div></div>
    <div class="card"><div class="card-label">Skin Goals</div><div class="card-value">${specNotes.skinGoal || aiAnalysis?.skinCondition || '�'}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Skin Concerns</div>
  <div class="text-box">${(aiAnalysis?.skinConcerns || []).join(', ') || skinConcern || 'Not specified'}</div>
</div>

<div class="section">
  <div class="section-title">Patient's Concern</div>
  <div class="text-box">${skinConcern || 'Not specified'}</div>
</div>

<div class="section">
  <div class="section-title">Diet & Lifestyle</div>
  <div class="text-box">${specNotes.dietIntake ? 'Diet: ' + specNotes.dietIntake : 'Not specified'}</div>
</div>

${cart.length > 0 ? `
<div class="section">
  <div class="section-title">Recommended Products (${cart.length})</div>
  ${cart.map((item: any) => `
  <div class="product-item">
    ${item.image ? `<img class="product-img" src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">` : '<div class="product-img"></div>'}
    <div>
      <div class="product-name">${item.name}</div>
      <div class="product-price">?${item.price}</div>
    </div>
  </div>`).join('')}
</div>` : ''}

<div class="spec-section">
  <div class="spec-title">Specialist Recommendations</div>
  ${specNotes.primaryConcern ? `<div class="spec-item"><div class="spec-label">Primary Skin Concern</div><div class="spec-value">${specNotes.primaryConcern}</div></div>` : ''}
  ${specNotes.secondaryConcern ? `<div class="spec-item"><div class="spec-label">Secondary Skin Concern</div><div class="spec-value">${specNotes.secondaryConcern}</div></div>` : ''}
  ${specNotes.skinSensitivity ? `<div class="spec-item"><div class="spec-label">Skin Sensitivity Level</div><div class="spec-value">${specNotes.skinSensitivity}</div></div>` : ''}
  ${specNotes.dietIntake ? `<div class="spec-item"><div class="spec-label">Diet Intake</div><div class="spec-value">${specNotes.dietIntake}</div></div>` : ''}
  ${specNotes.dietAvoid ? `<div class="spec-item"><div class="spec-label">Diet Avoid</div><div class="spec-value">${specNotes.dietAvoid}</div></div>` : ''}
  ${specNotes.lifestyle ? `<div class="spec-item"><div class="spec-label">Lifestyle Assessment</div><div class="spec-value">${specNotes.lifestyle}</div></div>` : ''}
  ${specNotes.waterIntake ? `<div class="spec-item"><div class="spec-label">Water Intake</div><div class="spec-value">${specNotes.waterIntake}</div></div>` : ''}
  ${specNotes.skinGoal ? `<div class="spec-item"><div class="spec-label">Skin Goal</div><div class="spec-value">${specNotes.skinGoal}</div></div>` : ''}
  ${specNotes.additionalNotes ? `<div class="spec-item"><div class="spec-label">Additional Notes</div><div class="spec-value">${specNotes.additionalNotes}</div></div>` : ''}
</div>

${skinImages.length > 0 ? `
<div class="section" style="margin-top:20px">
  <div class="section-title">Consultation Images</div>
  <div class="images-grid">
    ${skinImages.map((img: string) => `<img class="cons-img" src="${img}" alt="skin">`).join('')}
  </div>
</div>` : ''}

<div class="footer">
  Rabt Naturals � Personalized Skincare � Generated on ${new Date().toLocaleString('en-IN')}
</div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      setTimeout(() => win.print(), 800)
    }
  }

  // Save skin profile & create order
  async function createOfflineOrder() {
    if (!offlineCustomer.name || !offlineCustomer.phone) { toast.error('Name aur phone required'); return }
    if (cart.length === 0) { toast.error('Cart mein product add karo'); return }
    setPosLoading(true)
    try {
      const totals = getCartTotal()
      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (!url) { toast.error('MongoDB URL not found'); setPosLoading(false); return }
      const productNames = cart.map((i: any) => i.name).join(', ')

      // Save skin profile if analysis done
      if (aiAnalysis) {
        await fetch(url + '/api/skinprofiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: offlineCustomer.name,
            phone: offlineCustomer.phone,
            age: skinAge,
            skinType: aiAnalysis.skinType,
            skinTone: aiAnalysis.skinTone,
            skinConcerns: aiAnalysis.skinConcerns,
            skinCondition: aiAnalysis.skinCondition,
            images: skinImages,
            specialistId: mongoSpec?._id,
            source: 'offline',
            recommendedProducts: cart.map(i => ({ name: i.name, productId: i._id })),
          })
        })
      }

      // Create order in MongoDB
      const orderPayload = {
        customerName: offlineCustomer.name,
        customerPhone: offlineCustomer.phone,
        customerEmail: offlineCustomer.email,
        address: offlineCustomer.address,
        city: offlineCustomer.city, state: offlineCustomer.state, pincode: offlineCustomer.pincode,
        products: productNames,
        items: cart.map((i: any) => ({ name: i.name, image: i.image || '', category: i.category || '', variant: i.variant || {}, qty: i.qty, price: Number(i.price) })),
        amount: totals.total,
        subtotal: totals.subtotal,
        couponDiscount: totals.discount,
        couponCode: couponApplied?.code || '',
        paymentMethod: paymentMethod,
        status: 'new',
        source: 'specialist_offline',
        specialistId: mongoSpec?._id || '',
        shippingCharges: 0,
        type: 'one_time',
      }
      let mongoOrderId = ''
      const orderRes = await fetch(url + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      })
      if (orderRes.ok) {
        const orderData = await orderRes.json()
        mongoOrderId = orderData.orderId?.toString() || ''
      } else {
        const errData = await orderRes.json()
        toast.error('Order error: ' + (errData.message || errData.error || 'Unknown'))
        setPosLoading(false)
        return
      }

      // Also save to Supabase HQ orders
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('hq_orders').insert({
        customer_name: offlineCustomer.name,
        customer_phone: offlineCustomer.phone,
        customer_email: offlineCustomer.email,
        product: productNames,
        amount: totals.total,
        status: 'New',
        payment_method: paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        notes: 'Specialist offline order by ' + (mongoSpec?.name || ''),
        mongo_id: mongoOrderId,
        source: 'specialist_offline',
        created_by: user?.id,
      })

      toast.success('Order created! 12% commission pending. ??')
      // Auto generate PDF
      generatePDF()
      setShowPOS(false)
      resetPOS()
      loadAll()
    } catch { toast.error('Error') }
    setPosLoading(false)
  }

  function resetPOS() {
    setCart([]); setSkinImages([]); setAiAnalysis(null); setSkinConcern(''); setSkinAge('')
    setOfflineCustomer({ name: '', phone: '', email: '', city: '', state: '', pincode: '', address: '' })
    setCouponCode(''); setCouponApplied(null); setPosStep('customer'); setPaymentMethod('prepaid')
    setSpecNotes({ primaryConcern: '', secondaryConcern: '', skinSensitivity: 'medium', dietIntake: '', dietAvoid: '', lifestyle: '', waterIntake: '', skinGoal: '', additionalNotes: '' })
  }

  // Payout request
  async function requestPayout() {
    if (!payoutForm.amount || !payoutForm.upiId) { toast.error('Amount aur UPI ID required'); return }
    if (Number(payoutForm.amount) > totalEarnings) { toast.error('Amount earnings se zyada nahi ho sakta'); return }
    setPayoutLoading(true)
    try {
      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (!url) { toast.error('MongoDB URL not found'); setPayoutLoading(false); return }
      const res = await fetch(url + '/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialistId: mongoSpec?._id,
          amount: Number(payoutForm.amount),
          paymentMethod: payoutForm.method,
          upiId: payoutForm.upiId,
          upiName: payoutForm.upiName,
        })
      })
      if (res.ok) {
        toast.success('Payout request sent! Manager approve karega.')
        setPayoutModal(false)
        setPayoutForm({ amount: '', upiId: '', upiName: '', method: 'upi' })
      } else { toast.error('Payout request failed') }
    } catch { toast.error('Error') }
    setPayoutLoading(false)
  }

  const totals = getCartTotal()
  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'Outfit', outline: 'none' }

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>
            Namaste, <span style={{ color: 'var(--gold)' }}>{profile?.name?.split(' ')[0] || 'Doctor'}</span>
          </h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {consultations.length} consultations � Rs.{totalEarnings.toLocaleString('en-IN')} earned
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadAll} style={{ padding: '8px 14px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Refresh</button>
          <button onClick={() => setShowPOS(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
            + Offline Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Consultations', value: consultations.length, color: 'var(--blue)' },
          { label: 'Pending', value: consultations.filter(c => c.status === 'pending').length, color: 'var(--orange)' },
          { label: 'Completed', value: completedCons, color: 'var(--green)' },
          { label: 'Consultation Fee', value: 'Rs.' + consultationEarnings, color: 'var(--teal)' },
          { label: 'Commission Earned', value: 'Rs.' + commissionEarned, color: 'var(--gold)' },
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
          { id: 'overview', label: unassignedCons.length > 0 ? `Overview ??${unassignedCons.length}` : 'Overview' },
          { id: 'consultations', label: `Consultations (${consultations.length})` },
          { id: 'crm', label: `Leads (${leads.length})` },
          { id: 'skinprofiles', label: `Skin Profiles (${mySkinProfiles.length})` },
          { id: 'earnings', label: 'Earnings' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '8px 16px', background: tab === t.id ? 'var(--s1)' : 'transparent', border: 'none', borderRadius: 8, color: tab === t.id ? 'var(--gold)' : 'var(--mu)', fontWeight: tab === t.id ? 700 : 500, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit', whiteSpace: 'nowrap' }}>
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
              {unassignedCons.length > 0 && (
                <div style={{ gridColumn: '1/-1', background: 'var(--orL)', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(251,146,60,0.3)' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, color: 'var(--orange)', marginBottom: 12 }}>
                    ?? New Consultation Requests ({unassignedCons.length}) � Website se aaye hain
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {unassignedCons.slice(0, 6).map((c: any, i: number) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu2)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.concern || '�'}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 10 }}>
                          {c.scheduledDate ? new Date(c.scheduledDate).toLocaleDateString('en-IN') : '�'} {c.scheduledTime}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={async () => {
                            const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
                            if (!url) return
                            const res = await fetch(url + '/api/consultations/' + c._id, {
                              method: 'PATCH', headers: {'Content-Type':'application/json'},
                              body: JSON.stringify({status: 'accepted', assignedSpecialist: mongoSpec?._id?.toString()})
                            })
                            if (res.ok) { toast.success('Accepted! ?'); loadAll() }
                            else toast.error('Failed')
                          }} style={{ flex: 1, padding: '6px', background: 'var(--green)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                            Accept
                          </button>
                          <button onClick={() => {
                            setRejectedIds((r: string[]) => [...r, c._id?.toString()])
                            toast.success('Rejected!')
                          }} style={{ flex: 1, padding: '6px', background: 'var(--rdL)', border: 'none', borderRadius: 6, color: 'var(--red)', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card">
                <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Pending Consultations</div>
                {consultations.filter(c => c.status === 'pending').slice(0, 5).map((c, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{c.concern} � {c.scheduledDate ? new Date(c.scheduledDate).toLocaleDateString('en-IN') : '�'} {c.scheduledTime}</div>
                    </div>
                    <button onClick={() => setSelectedCons(c)} style={{ padding: '4px 10px', background: 'var(--gL)', border: 'none', borderRadius: 6, color: 'var(--gold)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit' }}>View</button>
                  </div>
                ))}
                {consultations.filter(c => c.status === 'pending').length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20, fontSize: 12 }}>No pending consultations</div>}
              </div>

              <div className="card">
                <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Earnings Breakdown</div>
                {[
                  { label: 'Consultation Fee', sub: completedCons + ' � Rs.30', value: consultationEarnings, color: 'var(--teal)' },
                  { label: 'Commission Earned', sub: '12% of delivered orders', value: commissionEarned, color: 'var(--green)' },
                  { label: 'Pending Commission', sub: 'Orders not yet delivered', value: pendingCommission, color: 'var(--orange)' },
                ].map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--b1)' }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{e.sub}</div>
                    </div>
                    <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: e.color }}>Rs.{e.value.toLocaleString('en-IN')}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Total Earned</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>Rs.{totalEarnings.toLocaleString('en-IN')}</div>
                </div>
                <button onClick={() => setPayoutModal(true)} style={{ width: '100%', marginTop: 14, padding: '10px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
                  Request Payout
                </button>
              </div>

              {/* Consultation Stats Chart */}
              <div className="card" style={{ gridColumn: '1/-1' }}>
                <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Consultation Status Overview</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Pending', count: consultations.filter(c => c.status === 'pending').length, color: 'var(--orange)', bg: 'var(--orL)' },
                    { label: 'Accepted', count: consultations.filter(c => c.status === 'accepted').length, color: 'var(--teal)', bg: 'rgba(20,184,166,0.15)' },
                    { label: 'Scheduled', count: consultations.filter(c => c.status === 'scheduled').length, color: 'var(--blue)', bg: 'var(--blL)' },
                    { label: 'Completed', count: consultations.filter(c => c.status === 'completed').length, color: 'var(--green)', bg: 'var(--grL)' },
                    { label: 'Cancelled', count: consultations.filter(c => c.status === 'cancelled').length, color: 'var(--red)', bg: 'var(--rdL)' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: s.bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: s.color }}>{s.count}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.label}</div>
                      {consultations.length > 0 && (
                        <div style={{ marginTop: 8, height: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: Math.round(s.count / consultations.length * 100) + '%', background: s.color, borderRadius: 2 }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {consultations.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>Progress Bar</div>
                    <div style={{ height: 12, background: 'var(--s2)', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                      {[
                        { status: 'pending', color: 'var(--orange)' },
                        { status: 'accepted', color: 'var(--teal)' },
                        { status: 'scheduled', color: 'var(--blue)' },
                        { status: 'completed', color: 'var(--green)' },
                        { status: 'cancelled', color: 'var(--red)' },
                      ].map((s, i) => {
                        const count = consultations.filter(c => c.status === s.status).length
                        const pct = Math.round(count / consultations.length * 100)
                        return pct > 0 ? <div key={i} style={{ width: pct + '%', background: s.color, transition: 'width 0.5s' }} title={s.status + ': ' + count} /> : null
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Patient Orders */}
              <div className="card" style={{ gridColumn: '1/-1', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>My Patient Orders � Commission Track</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Patient','Products','Amount','Status','12% Commission'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {myPatientOrders.slice(0, 8).map((o, i) => {
                      const status = (o.orderStatus || o.status || '').toLowerCase()
                      const isDelivered = status === 'delivered'
                      const isCancelled = ['cancelled','canceled'].includes(status)
                      return (
                        <tr key={i} style={{ opacity: isCancelled ? 0.5 : 1 }}>
                          <td style={{ padding: '9px 12px', fontSize: 12.5, fontWeight: 500 }}>{o.customerName}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11.5, color: 'var(--mu2)', maxWidth: 180 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.products || o.items?.[0]?.name || '�'}</div>
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontWeight: 700 }}>Rs.{o.amount}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: isDelivered ? 'var(--grL)' : isCancelled ? 'var(--rdL)' : 'var(--gL)', color: isDelivered ? 'var(--green)' : isCancelled ? 'var(--red)' : 'var(--gold)', textTransform: 'capitalize' }}>{status}</span>
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontWeight: 700, color: isDelivered ? 'var(--green)' : isCancelled ? 'var(--mu)' : 'var(--orange)', fontSize: 12 }}>
                            {isCancelled ? '�' : (isDelivered ? '+' : 'Pending ') + 'Rs.' + Math.round(o.amount * 0.12)}
                          </td>
                        </tr>
                      )
                    })}
                    {myPatientOrders.length === 0 && <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--mu)', fontSize: 12 }}>No patient orders yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CONSULTATIONS */}
          {tab === 'consultations' && (
            <div style={{ display: 'grid', gridTemplateColumns: selectedCons ? '1fr 380px' : '1fr', gap: 14 }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Patient','Concern','Date/Time','Status','Images','Action'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {consultations.map((c, i) => (
                      <tr key={i} onMouseOver={e => (e.currentTarget.style.background='rgba(255,255,255,0.018)')} onMouseOut={e => (e.currentTarget.style.background='')}>
                        <td style={{ padding: '11px 12px' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)' }}>Age {c.age}</div>
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--mu2)', maxWidth: 150 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.concern || '�'}</div>
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>
                          {c.scheduledDate ? new Date(c.scheduledDate).toLocaleDateString('en-IN') : '�'} {c.scheduledTime}
                        </td>
                        <td style={{ padding: '11px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: STATUS_BG[c.status] || 'rgba(255,255,255,0.05)', color: STATUS_COLORS[c.status] || 'var(--mu)', textTransform: 'capitalize' }}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ padding: '11px 12px' }}>
                          {c.images?.length > 0 ? (
                            <div style={{ display: 'flex', gap: 3 }}>
                              {c.images.slice(0,2).map((img: any, ii: number) => (
                                <img key={ii} src={img.url} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'cover' }} />
                              ))}
                              {c.images.length > 2 && <span style={{ fontSize: 10, color: 'var(--mu)', alignSelf: 'center' }}>+{c.images.length-2}</span>}
                            </div>
                          ) : '�'}
                        </td>
                        <td style={{ padding: '11px 12px' }}>
                          <button onClick={() => setSelectedCons(selectedCons?._id === c._id ? null : c)} style={{ padding: '4px 10px', background: 'var(--gL)', border: 'none', borderRadius: 6, color: 'var(--gold)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit' }}>View</button>
                        </td>
                      </tr>
                    ))}
                    {consultations.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No consultations assigned yet</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Detail Panel */}
              {selectedCons && (
                <div style={{ position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>{selectedCons.name}</div>
                    <button onClick={() => setSelectedCons(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>x</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[
                      { l: 'Age', v: selectedCons.age || '�' },
                      { l: 'Status', v: selectedCons.status },
                      { l: 'Date', v: selectedCons.scheduledDate ? new Date(selectedCons.scheduledDate).toLocaleDateString('en-IN') : '�' },
                      { l: 'Time', v: selectedCons.scheduledTime || '�' },
                    ].map((item, i) => (
                      <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 11px' }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>{item.l}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                  {selectedCons.concern && (
                    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Concern</div>
                      <div style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{selectedCons.concern}</div>
                    </div>
                  )}
                  {selectedCons.images?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>Skin Images</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selectedCons.images.map((img: any, i: number) => (
                          <img key={i} src={img.url} alt="skin" style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--b1)' }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedCons.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ flex: 1, padding: '9px', background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}
                          onClick={async () => {
                          const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
                          if (!url) return
                          const res = await fetch(url + '/api/consultations/' + selectedCons._id, {
                            method: 'PATCH', headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({status: 'accepted', acceptedAt: new Date()})
                          })
                          if (res.ok) { toast.success('Consultation accepted! ?'); setSelectedCons(null); loadAll() }
                          else toast.error('Failed to accept')
                        }}>Accept</button>
                        <button style={{ flex: 1, padding: '9px', background: 'var(--rdL)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--red)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}
                          onClick={async () => {
                          const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
                          if (!url) return
                          const res = await fetch(url + '/api/consultations/' + selectedCons._id, {
                            method: 'PATCH', headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({status: 'cancelled'})
                          })
                          if (res.ok) { toast.success('Consultation rejected'); setSelectedCons(null); loadAll() }
                          else toast.error('Failed to reject')
                        }}>Reject</button>
                      </div>
                    )}
                    <button onClick={() => setRescheduleModal(selectedCons)} style={{ padding: '9px', background: 'var(--gL)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 8, color: 'var(--gold)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                      Reschedule
                    </button>
                    <button onClick={async () => {
                      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
                      if (!url) return
                      const res = await fetch(url + '/api/consultations/' + selectedCons._id, {
                        method: 'PATCH', headers: {'Content-Type':'application/json'},
                        body: JSON.stringify({status: 'cancelled'})
                      })
                      if (res.ok) { toast.success('Consultation cancelled'); setSelectedCons(null); loadAll() }
                      else toast.error('Failed')
                    }} style={{ padding: '9px', background: 'var(--rdL)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--red)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                      Cancel Consultation
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CRM / LEADS */}
          {tab === 'crm' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontSize: 12, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase' }}>
                My Assigned Leads & Consultations
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Patient','Age','Concern','Scheduled','Status','Reminder'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {leads.map((c, i) => (
                    <tr key={i} onMouseOver={e => (e.currentTarget.style.background='rgba(255,255,255,0.018)')} onMouseOut={e => (e.currentTarget.style.background='')}>
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                        {c.phone && <div style={{ fontSize: 11, color: 'var(--mu)' }}>{c.phone}</div>}
                      </td>
                      <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--mu)' }}>{c.age || '�'}</td>
                      <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--mu2)', maxWidth: 160 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.concern || '�'}</div>
                      </td>
                      <td style={{ padding: '11px 12px', fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap' }}>
                        {c.scheduledDate ? new Date(c.scheduledDate).toLocaleDateString('en-IN') : '�'} {c.scheduledTime}
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: STATUS_BG[c.status] || 'rgba(255,255,255,0.05)', color: STATUS_COLORS[c.status] || 'var(--mu)', textTransform: 'capitalize' }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        {c.phone && (
                          <a href={'https://wa.me/' + c.phone.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent('Hi ' + c.name + '! Your consultation reminder from Rabt Naturals. Please confirm your appointment. ??')}
                            target="_blank" rel="noopener noreferrer"
                            style={{ padding: '4px 10px', background: 'var(--grL)', border: 'none', borderRadius: 6, color: 'var(--green)', fontSize: 10.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
                            WA
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No leads assigned yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* SKIN PROFILES */}
          {tab === 'skinprofiles' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>My Patient Skin Profiles</div>
                <span style={{ fontSize: 12, color: 'var(--mu)' }}>{mySkinProfiles.length} profiles</span>
              </div>
              {mySkinProfiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)', fontSize: 13 }}>No skin profiles yet</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                  {mySkinProfiles.map((p, i) => (
                    <div key={i} className="card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: '#08090C', flexShrink: 0 }}>
                          {(p.name || 'P').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || 'Patient'}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)' }}>{p.phone || '�'} {p.age ? '� Age ' + p.age : ''}</div>
                        </div>
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: p.source === 'offline' ? 'var(--orL)' : 'var(--blL)', color: p.source === 'offline' ? 'var(--orange)' : 'var(--blue)' }}>
                          {p.source === 'offline' ? 'Offline' : 'Online'}
                        </span>
                      </div>
                      {p.skinType && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase' }}>Skin Type: </span>
                          <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, textTransform: 'capitalize' }}>{p.skinType}</span>
                        </div>
                      )}
                      {p.skinConcerns?.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                          {p.skinConcerns.slice(0,3).map((c: string, ci: number) => (
                            <span key={ci} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--orL)', color: 'var(--orange)', fontWeight: 600 }}>{c}</span>
                          ))}
                        </div>
                      )}
                      {p.recommendedProducts?.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>
                          {p.recommendedProducts.length} products recommended
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: 'var(--mu)', borderTop: '1px solid var(--b1)', paddingTop: 8, marginTop: 4 }}>
                        {new Date(p.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EARNINGS */}
          {tab === 'earnings' && (
            <div>
              {/* Top Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'Total Earned', value: 'Rs.' + totalEarnings.toLocaleString('en-IN'), sub: 'Consultation + Commission', color: 'var(--gold)', big: true },
                  { label: 'Consultation Fee', value: 'Rs.' + consultationEarnings, sub: completedCons + ' � Rs.30', color: 'var(--teal)' },
                  { label: 'Commission Earned', value: 'Rs.' + commissionEarned, sub: 'From delivered orders', color: 'var(--green)' },
                  { label: 'Pending Commission', value: 'Rs.' + pendingCommission, sub: 'Orders in transit', color: 'var(--orange)' },
                ].map((s: any, i) => (
                  <div key={i} className="card" style={{ border: s.big ? '1px solid var(--gold)' : undefined }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Syne', fontSize: s.big ? 28 : 22, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Monthly Breakdown */}
                <div className="card">
                  <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Monthly Earnings</div>
                  {(() => {
                    const months: Record<string, {cons: number, commission: number}> = {}
                    consultations.filter(c => c.status === 'completed').forEach(c => {
                      const d = new Date(c.createdAt || c.acceptedAt || Date.now())
                      const key = d.toLocaleDateString('en-IN', {month: 'short', year: '2-digit'})
                      if (!months[key]) months[key] = {cons: 0, commission: 0}
                      months[key].cons += 30
                    })
                    myPatientOrders.filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'delivered').forEach(o => {
                      const d = new Date(o.createdAt || Date.now())
                      const key = d.toLocaleDateString('en-IN', {month: 'short', year: '2-digit'})
                      if (!months[key]) months[key] = {cons: 0, commission: 0}
                      months[key].commission += Math.round((o.amount || 0) * 0.12)
                    })
                    const entries = Object.entries(months).slice(-6)
                    const maxVal = Math.max(...entries.map(([,v]) => v.cons + v.commission), 1)
                    return entries.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20, fontSize: 12 }}>No earnings yet</div>
                    ) : entries.map(([month, val], i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                          <span style={{ fontWeight: 600 }}>{month}</span>
                          <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--gold)' }}>Rs.{(val.cons + val.commission).toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: Math.round(val.cons / maxVal * 100) + '%', background: 'var(--teal)', borderRadius: '4px 0 0 4px' }} title={'Consultation: Rs.' + val.cons} />
                          <div style={{ width: Math.round(val.commission / maxVal * 100) + '%', background: 'var(--green)' }} title={'Commission: Rs.' + val.commission} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--teal)' }}>? Consultation Rs.{val.cons}</span>
                          <span style={{ fontSize: 10, color: 'var(--green)' }}>? Commission Rs.{val.commission}</span>
                        </div>
                      </div>
                    ))
                  })()}
                </div>

                {/* Order Commission Detail */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Order-wise Commission</div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['Patient','Amount','Status','Commission'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)', background: 'var(--s1)' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {myPatientOrders.map((o, i) => {
                          const status = (o.orderStatus || o.status || '').toLowerCase()
                          const isDelivered = status === 'delivered'
                          const isCancelled = ['cancelled','canceled'].includes(status)
                          const commission = Math.round((o.amount || 0) * 0.12)
                          return (
                            <tr key={i} style={{ opacity: isCancelled ? 0.5 : 1 }}>
                              <td style={{ padding: '8px 12px', fontSize: 12 }}>{o.customerName}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700 }}>Rs.{o.amount}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: isDelivered ? 'var(--grL)' : isCancelled ? 'var(--rdL)' : 'var(--gL)', color: isDelivered ? 'var(--green)' : isCancelled ? 'var(--red)' : 'var(--gold)' }}>{status}</span>
                              </td>
                              <td style={{ padding: '8px 12px', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 12, color: isDelivered ? 'var(--green)' : isCancelled ? 'var(--mu)' : 'var(--orange)' }}>
                                {isCancelled ? '�' : (isDelivered ? '+' : '? ') + 'Rs.' + commission}
                              </td>
                            </tr>
                          )
                        })}
                        {myPatientOrders.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--mu)', fontSize: 12 }}>No orders yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Payout History */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Payout History</div>
                  <button onClick={() => setPayoutModal(true)} style={{ padding: '7px 16px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>
                    + Request Payout
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Payout #','Amount','UPI ID','Requested','Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {payouts.filter((p: any) => p.specialistId?.toString() === mongoSpec?._id?.toString()).map((p: any, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontSize: 11, color: 'var(--mu)' }}>{p.payoutNumber || p._id?.slice(-8)}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>Rs.{p.amount}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--mu2)' }}>{p.upiId || '�'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--mu)' }}>{p.requestedAt ? new Date(p.requestedAt).toLocaleDateString('en-IN') : '�'}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: p.status === 'completed' ? 'var(--grL)' : p.status === 'rejected' ? 'var(--rdL)' : 'var(--orL)', color: p.status === 'completed' ? 'var(--green)' : p.status === 'rejected' ? 'var(--red)' : 'var(--orange)' }}>
                            {p.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {payouts.filter((p: any) => p.specialistId?.toString() === mongoSpec?._id?.toString()).length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--mu)', fontSize: 12 }}>No payout requests yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* OFFLINE POS MODAL */}
      {showPOS && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, width: '96vw', maxWidth: 1060, height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* POS Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>Offline Order � AI Skin Analysis</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {[
                    { id: 'customer', label: '1. Customer' },
                    { id: 'skin', label: '2. Skin Photos' },
                    { id: 'analysis', label: '3. AI Analysis' },
                    { id: 'notes', label: '4. Specialist Notes' },
                    { id: 'products', label: '5. Products' },
                    { id: 'payment', label: '6. Payment' },
                  ].map((step, i) => (
                    <span key={step.id} style={{ fontSize: 11, fontWeight: 700, color: posStep === step.id ? 'var(--gold)' : 'var(--mu)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: posStep === step.id ? 'var(--gold)' : 'var(--s2)', color: posStep === step.id ? '#08090C' : 'var(--mu)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>{i+1}</span>
                      {step.label.split('. ')[1]}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => { setShowPOS(false); resetPOS() }} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 20 }}>x</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

              {/* Step 1: Customer */}
              {posStep === 'customer' && (
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, marginBottom: 20 }}>Customer Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { k: 'name', l: 'Name*', p: 'Priya Sharma' },
                      { k: 'phone', l: 'Phone*', p: '+91 9876543210' },
                      { k: 'email', l: 'Email', p: 'priya@email.com' },
                      { k: 'address', l: 'Address', p: 'House No, Street' },
                      { k: 'city', l: 'City', p: 'Mumbai' },
                      { k: 'state', l: 'State', p: 'Maharashtra' },
                      { k: 'pincode', l: 'Pincode', p: '400001' },
                    ].map(f => (
                      <div key={f.k}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>{f.l}</label>
                        <input value={(offlineCustomer as any)[f.k]} onChange={e => setOfflineCustomer(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.p} style={inp} />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { if (!offlineCustomer.name || !offlineCustomer.phone) { toast.error('Name aur phone required'); return } setPosStep('skin') }}
                    style={{ width: '100%', marginTop: 20, padding: '12px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 10, color: '#08090C', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Syne' }}>
                    Next: Skin Photos ?
                  </button>
                </div>
              )}

              {/* Step 2: Skin Photos */}
              {posStep === 'skin' && (
                <div style={{ maxWidth: 540, margin: '0 auto' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Skin Analysis</div>
                  <div style={{ fontSize: 12.5, color: 'var(--mu)', marginBottom: 20 }}>Customer ki skin photos lo � AI analyze karega aur Rabt products suggest karega</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Age</label>
                      <input value={skinAge} onChange={e => setSkinAge(e.target.value)} placeholder="25" style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Main Concern</label>
                      <input value={skinConcern} onChange={e => setSkinConcern(e.target.value)} placeholder="Acne, pigmentation, dryness..." style={inp} />
                    </div>
                  </div>

                  <div style={{ border: '2px dashed var(--b2)', borderRadius: 12, padding: 30, textAlign: 'center', marginBottom: 16, cursor: 'pointer', background: 'var(--s2)' }}
                    onClick={() => fileInputRef.current?.click()}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>??</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Click to upload skin photos</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)' }}>Max 4 photos � Front, sides, close-up</div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                  </div>

                  {skinImages.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                      {skinImages.map((img, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={img} alt="skin" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--b1)' }} />
                          <button onClick={() => setSkinImages(skinImages.filter((_, ii) => ii !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--red)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setPosStep('customer')} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 10, color: 'var(--mu2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>? Back</button>
                    <button onClick={analyzeSkin} disabled={analyzing || skinImages.length === 0}
                      style={{ flex: 2, padding: '11px', background: skinImages.length > 0 ? 'linear-gradient(135deg,#D4A853,#B87C30)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, color: skinImages.length > 0 ? '#08090C' : 'var(--mu)', fontWeight: 800, fontSize: 13, cursor: skinImages.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Syne' }}>
                      {analyzing ? 'AI Analyzing... ??' : 'Analyze Skin with AI ?'}
                    </button>
                  </div>
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <button onClick={() => setPosStep('products')} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                      Skip AI Analysis ? Products directly
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: AI Analysis Results */}
              {posStep === 'analysis' && aiAnalysis && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, marginBottom: 14, color: 'var(--gold)' }}>AI Skin Analysis Results</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                      {[
                        { l: 'Skin Type', v: aiAnalysis.skinType },
                        { l: 'Skin Tone', v: aiAnalysis.skinTone },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 4 }}>{item.l}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'capitalize' }}>{item.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>Skin Concerns</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {aiAnalysis.skinConcerns?.map((c: string, i: number) => (
                          <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--orL)', color: 'var(--orange)', fontWeight: 600 }}>{c}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Skin Condition</div>
                      <div style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{aiAnalysis.skinCondition}</div>
                    </div>
                    {aiAnalysis.specialNotes && (
                      <div style={{ background: 'var(--gL)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(212,168,83,0.2)' }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Special Notes</div>
                        <div style={{ fontSize: 12, color: 'var(--mu2)', lineHeight: 1.6 }}>{aiAnalysis.specialNotes}</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Recommended Routine</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 6 }}>AM Routine</div>
                    {aiAnalysis.amRoutine?.map((r: any, i: number) => (
                      <div key={i} style={{ padding: '8px 10px', background: 'var(--s2)', borderRadius: 8, marginBottom: 5 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>Step {r.step}: {r.product}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--mu)', marginTop: 2 }}>{r.reason}</div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>PM Routine</div>
                    {aiAnalysis.pmRoutine?.map((r: any, i: number) => (
                      <div key={i} style={{ padding: '8px 10px', background: 'var(--s2)', borderRadius: 8, marginBottom: 5 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>Step {r.step}: {r.product}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--mu)', marginTop: 2 }}>{r.reason}</div>
                      </div>
                    ))}
                    <button onClick={() => setPosStep('notes')} style={{ width: '100%', marginTop: 16, padding: '11px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 10, color: '#08090C', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Syne' }}>
                      Next: Add Specialist Notes ?
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3.5: Specialist Notes */}
              {posStep === 'notes' && (
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, marginBottom: 6, color: 'var(--gold)' }}>Specialist Notes</div>
                  <div style={{ fontSize: 12.5, color: 'var(--mu)', marginBottom: 20 }}>Yeh notes PDF mein jayenge aur customer ko share honge</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Primary Skin Concern</label>
                      <input value={specNotes.primaryConcern} onChange={e => setSpecNotes(p => ({...p, primaryConcern: e.target.value}))} placeholder="e.g. Acne free skin" style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Secondary Skin Concern</label>
                      <input value={specNotes.secondaryConcern} onChange={e => setSpecNotes(p => ({...p, secondaryConcern: e.target.value}))} placeholder="e.g. Even tone, Glow" style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Skin Sensitivity</label>
                      <select value={specNotes.skinSensitivity} onChange={e => setSpecNotes(p => ({...p, skinSensitivity: e.target.value}))} style={inp}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Water Intake</label>
                      <input value={specNotes.waterIntake} onChange={e => setSpecNotes(p => ({...p, waterIntake: e.target.value}))} placeholder="e.g. 2-3 liter" style={inp} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Diet Intake (kya khayein)</label>
                    <textarea value={specNotes.dietIntake} onChange={e => setSpecNotes(p => ({...p, dietIntake: e.target.value}))} placeholder="Vegetables, Coconut water, Fresh fruits..." rows={3} style={{...inp, resize: 'none'}} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Diet Avoid (kya na khayein)</label>
                    <textarea value={specNotes.dietAvoid} onChange={e => setSpecNotes(p => ({...p, dietAvoid: e.target.value}))} placeholder="Junk food, Spicy food, Too much tea..." rows={3} style={{...inp, resize: 'none'}} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Lifestyle Assessment</label>
                    <input value={specNotes.lifestyle} onChange={e => setSpecNotes(p => ({...p, lifestyle: e.target.value}))} placeholder="e.g. Low outdoor exposure, Low stress level" style={inp} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Skin Goals</label>
                    <input value={specNotes.skinGoal} onChange={e => setSpecNotes(p => ({...p, skinGoal: e.target.value}))} placeholder="e.g. Even tone, Glow, Acne free skin" style={inp} />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Additional Notes</label>
                    <textarea value={specNotes.additionalNotes} onChange={e => setSpecNotes(p => ({...p, additionalNotes: e.target.value}))} placeholder="Koi aur important notes..." rows={2} style={{...inp, resize: 'none'}} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <button onClick={() => setPosStep('analysis')} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 10, color: 'var(--mu2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>? Back</button>
                    <button onClick={generatePDF} style={{ flex: 1, padding: '11px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, color: 'var(--blue)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
                      Preview PDF
                    </button>
                    <button onClick={() => setPosStep('products')} style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 10, color: '#08090C', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Syne' }}>
                      Next: Products ?
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Products */}
              {posStep === 'products' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, height: '100%' }}>
                  <div style={{ overflowY: 'auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 12 }}>Products ({products.length})</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                      {products.map((p: any, i: number) => (
                        <div key={i} style={{ background: 'var(--s2)', borderRadius: 10, padding: 10, border: '1px solid var(--b1)' }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            {p.image && <img src={p.image} alt={p.name} style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>Rs.{p.price}</div>
                            </div>
                          </div>
                          {p.variants && p.variants.length > 1 ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {p.variants.map((v: any, vi: number) => (
                                <button key={vi} onClick={() => addToCart(p, v)} style={{ padding: '3px 7px', background: 'var(--gL)', border: 'none', borderRadius: 5, color: 'var(--gold)', fontSize: 10, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>
                                  {v.size} Rs.{v.price}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <button onClick={() => addToCart(p, p.variants?.[0])} style={{ width: '100%', padding: '5px', background: 'var(--gL)', border: 'none', borderRadius: 6, color: 'var(--gold)', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>+ Add</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase' }}>Cart ({cart.length})</div>
                    {cart.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--mu)', fontSize: 12, background: 'var(--s2)', borderRadius: 8 }}>Add products</div>
                    ) : cart.map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--b1)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--mu)' }}>Rs.{item.price}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <button onClick={() => setCart(cart.map((c: any, ci: number) => ci === i ? { ...c, qty: Math.max(1, c.qty-1) } : c))} style={{ width: 20, height: 20, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 4, cursor: 'pointer', color: 'var(--tx)' }}>-</button>
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{item.qty}</span>
                          <button onClick={() => setCart(cart.map((c: any, ci: number) => ci === i ? { ...c, qty: c.qty+1 } : c))} style={{ width: 20, height: 20, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 4, cursor: 'pointer', color: 'var(--tx)' }}>+</button>
                          <button onClick={() => setCart(cart.filter((_: any, ci: number) => ci !== i))} style={{ width: 20, height: 20, background: 'var(--rdL)', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'var(--red)' }}>x</button>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, minWidth: 50, textAlign: 'right' }}>Rs.{(Number(item.price) * item.qty).toFixed(0)}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="COUPON" style={{ ...inp, flex: 1, fontSize: 11 }} />
                      <button onClick={applyCoupon} style={{ padding: '8px 10px', background: 'var(--gL)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 8, color: 'var(--gold)', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>Apply</button>
                    </div>
                    {cart.length > 0 && (
                      <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mu)', marginBottom: 4 }}><span>Subtotal</span><span>Rs.{totals.subtotal}</span></div>
                        {totals.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--green)', marginBottom: 4 }}><span>Discount</span><span>-Rs.{totals.discount}</span></div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, fontFamily: 'Syne', borderTop: '1px solid var(--b1)', paddingTop: 6, marginTop: 4 }}>
                          <span>Total</span><span style={{ color: 'var(--gold)' }}>Rs.{totals.total}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 6, textAlign: 'center' }}>Your 12% commission: Rs.{Math.round(totals.total * 0.12)}</div>
                      </div>
                    )}
                    <button onClick={() => { if (cart.length === 0) { toast.error('Cart empty'); return } setPosStep('payment') }}
                      disabled={cart.length === 0}
                      style={{ padding: '11px', background: cart.length > 0 ? 'linear-gradient(135deg,#D4A853,#B87C30)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, color: cart.length > 0 ? '#08090C' : 'var(--mu)', fontWeight: 800, fontSize: 13, cursor: cart.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Syne' }}>
                      Next: Payment ?
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Payment */}
              {posStep === 'payment' && (
                <div style={{ maxWidth: 480, margin: '0 auto' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, marginBottom: 20 }}>Payment</div>
                  <div style={{ background: 'var(--s2)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 10 }}>Order Summary � {offlineCustomer.name}</div>
                    {cart.map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                        <span>{item.name} � {item.qty}</span>
                        <span style={{ fontFamily: 'DM Mono', fontWeight: 700 }}>Rs.{(Number(item.price) * item.qty).toFixed(0)}</span>
                      </div>
                    ))}
                    {totals.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--green)', marginTop: 6 }}><span>Discount</span><span>-Rs.{totals.discount}</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, fontFamily: 'Syne', borderTop: '1px solid var(--b1)', paddingTop: 10, marginTop: 8 }}>
                      <span>Total</span><span style={{ color: 'var(--gold)' }}>Rs.{totals.total}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: 8, textAlign: 'center', fontWeight: 600 }}>Your commission: Rs.{Math.round(totals.total * 0.12)}</div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 10 }}>Payment Method</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { id: 'prepaid', label: 'Prepaid', sub: 'UPI / Online', icon: '??' },
                        { id: 'cod', label: 'Cash on Delivery', sub: 'Pay later', icon: '??' },
                      ].map(pm => (
                        <div key={pm.id} onClick={() => setPaymentMethod(pm.id as any)}
                          style={{ padding: 14, borderRadius: 10, cursor: 'pointer', border: '2px solid ' + (paymentMethod === pm.id ? 'var(--gold)' : 'var(--b1)'), background: paymentMethod === pm.id ? 'var(--gL)' : 'var(--s2)', transition: 'all 0.15s' }}>
                          <div style={{ fontSize: 20, marginBottom: 6 }}>{pm.icon}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: paymentMethod === pm.id ? 'var(--gold)' : 'var(--tx)' }}>{pm.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{pm.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setPosStep('products')} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 10, color: 'var(--mu2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>? Back</button>
                    <button onClick={createOfflineOrder} disabled={posLoading}
                      style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 10, color: '#08090C', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Syne' }}>
                      {posLoading ? 'Creating...' : 'Confirm Order � Rs.' + totals.total}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 380, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 18 }}>Reschedule � {rescheduleModal.name}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>New Date</label>
              <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} style={inp} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>New Time</label>
              <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setRescheduleModal(null)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={() => { toast.success('Reschedule request sent!'); setRescheduleModal(null) }}
                style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Request Modal */}
      {payoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 420, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Request Payout</div>
            <div style={{ fontSize: 12.5, color: 'var(--mu)', marginBottom: 20 }}>Available: <strong style={{ color: 'var(--gold)' }}>Rs.{totalEarnings.toLocaleString('en-IN')}</strong></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Amount*</label>
                <input value={payoutForm.amount} onChange={e => setPayoutForm(p => ({ ...p, amount: e.target.value }))} placeholder={'Max Rs.' + totalEarnings} style={inp} type="number" />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>UPI ID*</label>
                <input value={payoutForm.upiId} onChange={e => setPayoutForm(p => ({ ...p, upiId: e.target.value }))} placeholder="yourname@upi" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Account Name</label>
                <input value={payoutForm.upiName} onChange={e => setPayoutForm(p => ({ ...p, upiName: e.target.value }))} placeholder="Your full name" style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setPayoutModal(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={requestPayout} disabled={payoutLoading}
                style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                {payoutLoading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

