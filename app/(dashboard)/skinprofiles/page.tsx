'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function SkinProfilePage() {
  const [skinProfiles, setSkinProfiles] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [specialists, setSpecialists] = useState<any[]>([])
  const [hqProfiles, setHqProfiles] = useState<any[]>([])
  const [myProfile, setMyProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<'cards'|'analytics'>('cards')
  const [skinTypeFilter, setSkinTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [specFilterId, setSpecFilterId] = useState('all')

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
    const { data: hq } = await supabase.from('profiles').select('*').eq('role', 'specialist')
    setMyProfile(prof)
    setHqProfiles(hq || [])
    const url = process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
    if (!url) { setLoading(false); return }
    try {
      const [spRes, consRes, custRes, prodRes, specRes] = await Promise.all([
        fetch(url + '/api/skinprofiles').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/consultations').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/users').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/products').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/specialists').then(r => r.ok ? r.json() : []),
      ])
      const allProfiles = Array.isArray(spRes) ? spRes : []
      const allCons = Array.isArray(consRes) ? consRes : []
      const allCusts = Array.isArray(custRes) ? custRes : []
      const allProds = Array.isArray(prodRes) ? prodRes : []
      const allSpecs = Array.isArray(specRes) ? specRes : []
      setConsultations(allCons)
      setCustomers(allCusts)
      setProducts(allProds)
      setSpecialists(allSpecs)
      if (prof?.role === 'specialist') {
        const myMongoSpec = allSpecs.find((s: any) => s.email === prof.email || s.name?.toLowerCase() === prof.name?.toLowerCase())
        if (myMongoSpec) {
          const myConsIds = new Set(allCons.filter((c: any) => c.assignedSpecialist?.toString() === myMongoSpec._id?.toString()).map((c: any) => c._id?.toString()))
          setSkinProfiles(allProfiles.filter((p: any) => myConsIds.has(p.consultationId?.toString()) || p.specialistId?.toString() === myMongoSpec._id?.toString()))
        } else setSkinProfiles([])
      } else {
        setSkinProfiles(allProfiles)
      }
    } catch { toast.error('MongoDB error') }
    setLoading(false)
  }

  function getConsultation(sp: any) { return consultations.find(c => c._id?.toString() === sp.consultationId?.toString() || c._id?.toString() === sp.consultation?.toString()) }
  function getCustomer(sp: any) { return customers.find(c => c._id === sp.userId || c._id === sp.user) }
  function getSpecialist(sp: any) {
    if (sp.specialistId) { const d = specialists.find((s: any) => s._id?.toString() === sp.specialistId?.toString()); if (d) return d }
    const cons = getConsultation(sp)
    if (!cons?.assignedSpecialist) return null
    return specialists.find((s: any) => s._id?.toString() === cons.assignedSpecialist?.toString())
  }
  function getProduct(productId: string) { return products.find(p => p._id === productId) }
  function getPatientName(sp: any) {
    if (sp.name && sp.name.trim()) return sp.name.trim()
    const cons = getConsultation(sp)
    if (cons?.name || cons?.fullName) return cons.name || cons.fullName
    const cust = getCustomer(sp)
    if (cust?.firstName) return (cust.firstName + ' ' + (cust.lastName || '')).trim()
    return 'Patient'
  }
  function getPatientPhone(sp: any) {
    if (sp.phone) return sp.phone
    const cust = getCustomer(sp)
    return cust?.phoneNumber || cust?.phone || ''
  }

  // Analytics computed
  const skinTypeCounts: Record<string, number> = {}
  skinProfiles.forEach(sp => { const t = sp.skinType || 'Unknown'; skinTypeCounts[t] = (skinTypeCounts[t] || 0) + 1 })

  const concernCounts: Record<string, number> = {}
  skinProfiles.forEach(sp => { (sp.skinConcerns || []).forEach((c: string) => { concernCounts[c] = (concernCounts[c] || 0) + 1 }) })
  const topConcerns = Object.entries(concernCounts).sort((a,b) => b[1]-a[1]).slice(0, 10)

  const specProfileCounts: Record<string, {name: string, count: number}> = {}
  skinProfiles.forEach(sp => {
    const spec = getSpecialist(sp)
    if (spec) { if (!specProfileCounts[spec._id]) specProfileCounts[spec._id] = { name: spec.name, count: 0 }; specProfileCounts[spec._id].count++ }
  })
  const topSpecs = Object.values(specProfileCounts).sort((a,b) => b.count - a.count)

  const monthlyProfiles: Record<string, number> = {}
  skinProfiles.forEach(sp => {
    const d = new Date(sp.createdAt || Date.now())
    const key = d.toLocaleDateString('en-IN', {month:'short', year:'2-digit'})
    monthlyProfiles[key] = (monthlyProfiles[key] || 0) + 1
  })
  const monthEntries = Object.entries(monthlyProfiles).slice(-6)
  const maxMonth = Math.max(...monthEntries.map(([,v]) => v), 1)

  const onlineCount = skinProfiles.filter(sp => sp.source !== 'offline').length
  const offlineCount = skinProfiles.filter(sp => sp.source === 'offline').length
  const maxSkinType = Math.max(...Object.values(skinTypeCounts), 1)
  const maxConcern = topConcerns[0]?.[1] || 1

  // Filtered list
  const filtered = skinProfiles.filter(sp => {
    const name = getPatientName(sp).toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase())
    const matchSkinType = skinTypeFilter === 'all' || sp.skinType === skinTypeFilter
    const matchSource = sourceFilter === 'all' || (sourceFilter === 'offline' ? sp.source === 'offline' : sp.source !== 'offline')
    const spec = getSpecialist(sp)
    const matchSpec = specFilterId === 'all' || spec?._id?.toString() === specFilterId
    return matchSearch && matchSkinType && matchSource && matchSpec
  })

  const skinTypes = [...new Set(skinProfiles.map(sp => sp.skinType).filter(Boolean))]

  function printProfile(sp: any) {
    const name = getPatientName(sp)
    const cons = getConsultation(sp)
    const spec = getSpecialist(sp)
    const isOffline = sp.source === 'offline'
    const recProducts = (sp.aiRecommendations || sp.recommendedProducts || []).map((rp: any) => ({ ...getProduct(rp.product || rp.productId), reason: rp.reason })).filter(Boolean)
    const consultationLabel = cons?.consultationNumber || (isOffline ? 'Offline Session' : 'N/A')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Skin Profile - ${name}</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;background:#fff}.page{max-width:800px;margin:0 auto;padding:40px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:3px solid #D4A853}.logo{font-size:28px;font-weight:900;color:#D4A853}.patient-banner{background:linear-gradient(135deg,#1a1a2e,#2d1b4e);color:#fff;border-radius:16px;padding:28px 32px;margin-bottom:28px;display:flex;align-items:center;gap:24px}.patient-avatar{width:64px;height:64px;background:linear-gradient(135deg,#D4A853,#B87C30);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#1a1a2e}.section{margin-bottom:28px}.section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#D4A853;margin-bottom:14px}.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.info-card{background:#f8f9ff;border-radius:12px;padding:14px 16px;border:1px solid #eee}.info-label{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:4px}.info-value{font-size:14px;font-weight:700;color:#1a1a2e}.concern-badge{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;background:#fff3e0;color:#D4A853;border:1px solid #D4A85333;margin:4px}.notes-box{background:#fffbf0;border:1px solid #D4A85333;border-radius:12px;padding:16px 18px;font-size:13px;line-height:1.7;color:#444}.product-card{display:flex;align-items:flex-start;gap:14px;padding:14px;background:#f8f9ff;border-radius:12px;margin-bottom:10px;border:1px solid #eee}.footer{margin-top:40px;padding-top:20px;border-top:2px solid #D4A853;display:flex;justify-content:space-between}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><div class="page"><div class="header"><div><div class="logo">RABT NATURALS</div><div style="font-size:11px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:.1em">Personalized Skin Care Report</div></div><div style="text-align:right;font-size:12px;color:#666;line-height:1.8"><div><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div><div><strong>Consultation:</strong> ${consultationLabel}</div><div><strong>Specialist:</strong> ${spec?.name||'N/A'}</div></div></div><div class="patient-banner"><div class="patient-avatar">${name.charAt(0)}</div><div><div style="font-size:26px;font-weight:800;margin-bottom:4px">${name}</div><div style="font-size:13px;color:rgba(255,255,255,.6)">${cons?.scheduledDate?new Date(cons.scheduledDate).toLocaleDateString('en-IN'):''}</div><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">${sp.skinType?`<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(212,168,83,.2);color:#D4A853;border:1px solid rgba(212,168,83,.3)">${sp.skinType} skin</span>`:''}${(sp.skinConcerns||[]).map((c:string)=>`<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(212,168,83,.2);color:#D4A853;border:1px solid rgba(212,168,83,.3)">${c}</span>`).join('')}</div></div></div><div class="section"><div class="section-title">Skin Analysis</div><div class="info-grid"><div class="info-card"><div class="info-label">Skin Type</div><div class="info-value">${sp.skinType||'N/A'}</div></div><div class="info-card"><div class="info-label">Stress Level</div><div class="info-value">${sp.stressLevel||'N/A'}</div></div><div class="info-card"><div class="info-label">Skin Goals</div><div class="info-value" style="font-size:12px">${sp.skinGoals||'N/A'}</div></div></div></div>${(sp.skinConcerns||[]).length>0?`<div class="section"><div class="section-title">Skin Concerns</div><div>${(sp.skinConcerns||[]).map((c:string)=>`<span class="concern-badge">${c}</span>`).join('')}</div></div>`:''}${cons?.concern?`<div class="section"><div class="section-title">Patient Concern</div><div class="notes-box">${cons.concern}</div></div>`:''}${recProducts.length>0?`<div class="section"><div class="section-title">Recommended Products</div>${recProducts.map((p:any)=>`<div class="product-card">${p?.image?`<img src="${p.image}" style="width:56px;height:56px;border-radius:10px;object-fit:cover"/>`:`<div style="width:56px;height:56px;border-radius:10px;background:linear-gradient(135deg,#D4A853,#B87C30);display:flex;align-items:center;justify-content:center;font-size:20px">🌿</div>`}<div><div style="font-size:13.5px;font-weight:700">${p?.name||'Product'}</div><div style="font-size:12px;color:#D4A853;font-weight:700">${p?.price?'₹'+p.price:''}</div><div style="font-size:11.5px;color:#555;line-height:1.5">${p?.reason||''}</div></div></div>`).join('')}</div>`:''}${(()=>{const n=sp.specialistNotes;if(!n)return'';if(Array.isArray(n)&&n.length>0)return`<div class="section"><div class="section-title">Specialist Notes</div>${n.map((cf:any)=>`<div style="margin-bottom:10px;background:#f8f9ff;border-radius:10px;padding:12px 14px"><div style="font-size:12px;font-weight:700;color:#D4A853;margin-bottom:5px">${cf.key}</div><div style="font-size:12.5px;color:#444;line-height:1.7">${cf.value}</div></div>`).join('')}</div>`;if(typeof n==='object'&&!Array.isArray(n)){const e=Object.entries(n).filter(([k,v])=>v&&String(v).trim());if(e.length===0)return'';return`<div class="section"><div class="section-title">Specialist Notes</div>${e.map(([k,v])=>`<div style="margin-bottom:10px;background:#f8f9ff;border-radius:10px;padding:12px 14px"><div style="font-size:12px;font-weight:700;color:#D4A853;margin-bottom:5px">${k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}</div><div style="font-size:12.5px;color:#444;line-height:1.7">${v}</div></div>`).join('')}</div>`}return''})()}<div class="footer"><div><div style="font-size:16px;font-weight:800;color:#D4A853">RABT NATURALS</div><div style="font-size:11px;color:#999;margin-top:2px">rabtnaturals.com</div></div><div style="font-size:11px;color:#999;text-align:right"><div>Confidential — For Patient Use Only</div><div>Generated by Rabt HQ</div></div></div></div></body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 800)
  }

  function shareWhatsApp(sp: any, toPatient = false) {
    const name = getPatientName(sp)
    const cons = getConsultation(sp)
    const spec = getSpecialist(sp)
    const recProducts = (sp.aiRecommendations || sp.recommendedProducts || []).map((rp: any) => getProduct(rp.product || rp.productId)).filter(Boolean)
    const msg = `🌿 *RABT NATURALS — Skin Profile*\n━━━━━━━━━━━━━━━━━━\n\n👤 *Patient:* ${name}\n👩‍⚕️ *Specialist:* ${spec?.name || 'N/A'}\n🔬 *Skin Type:* ${sp.skinType || 'N/A'}\n\n*Skin Concerns:*\n${(sp.skinConcerns || []).map((c: string) => `• ${c}`).join('\n') || '—'}\n\n*Recommended Products:*\n${recProducts.slice(0, 5).map((p: any, i: number) => `${i+1}. ${p.name} — ₹${p.price}`).join('\n') || '—'}\n\n━━━━━━━━━━━━━━━━━━\n🌿 *Rabt Naturals* | rabtnaturals.com`
    const phone = toPatient ? getPatientPhone(sp).replace(/[^0-9]/g, '') : ''
    window.open((phone ? `https://wa.me/${phone}?text=` : `https://wa.me/?text=`) + encodeURIComponent(msg), '_blank')
    toast.success(toPatient ? 'WhatsApp opened for patient!' : 'WhatsApp opened!')
  }

  if (!mounted) return null
  const inp: any = { background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'Outfit', outline: 'none' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Skin <span style={{ color: 'var(--gold)' }}>Profiles</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {skinProfiles.length} total · {onlineCount} online · {offlineCount} offline
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['cards','analytics'].map(v => (
            <button key={v} onClick={() => setView(v as any)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', textTransform: 'capitalize', background: view === v ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: view === v ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (view === v ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
              {v === 'analytics' ? '📊 Analytics' : '🧴 Profiles'}
            </button>
          ))}
          <button onClick={loadAll} style={{ padding: '8px 14px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Profiles', value: skinProfiles.length, color: 'var(--blue)' },
          { label: 'Online', value: onlineCount, color: 'var(--teal)' },
          { label: 'Offline', value: offlineCount, color: 'var(--orange)' },
          { label: 'Skin Types', value: Object.keys(skinTypeCounts).length, color: 'var(--purple)' },
          { label: 'Concerns Tracked', value: Object.keys(concernCounts).length, color: 'var(--gold)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ANALYTICS VIEW */}
      {view === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Skin Type Distribution */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Skin Type Distribution</div>
              {Object.entries(skinTypeCounts).sort((a,b) => b[1]-a[1]).map(([type, count], i) => {
                const colors = ['var(--blue)','var(--teal)','var(--gold)','var(--purple)','var(--orange)','var(--green)']
                const color = colors[i % colors.length]
                const pct = Math.round(count / (skinProfiles.length || 1) * 100)
                return (
                  <div key={type} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{type}</span>
                      <span style={{ fontFamily: 'DM Mono', color }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 10, background: 'var(--s2)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(count / maxSkinType * 100) + '%', background: color, borderRadius: 5 }} />
                    </div>
                  </div>
                )
              })}
              {Object.keys(skinTypeCounts).length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No data yet</div>}
            </div>

            {/* Top Concerns */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Top Skin Concerns</div>
              {topConcerns.map(([concern, count], i) => (
                <div key={concern} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{concern}</span>
                    <span style={{ fontFamily: 'DM Mono', color: 'var(--orange)' }}>{count}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: Math.round(count / maxConcern * 100) + '%', background: 'var(--orange)', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              {topConcerns.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No concerns tracked</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Monthly Growth */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Monthly Profile Creation</div>
              {monthEntries.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No data yet</div>
              ) : monthEntries.map(([month, count], i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600 }}>{month}</span>
                    <span style={{ fontFamily: 'DM Mono', color: 'var(--teal)' }}>{count}</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--s2)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: Math.round(count / maxMonth * 100) + '%', background: 'linear-gradient(90deg,#14B8A6,#6366F1)', borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Specialist wise */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Profiles by Specialist</div>
              {topSpecs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No specialist data</div>
              ) : topSpecs.map((s, i) => {
                const maxCount = topSpecs[0].count || 1
                const pct = Math.round(s.count / maxCount * 100)
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ fontFamily: 'DM Mono', color: 'var(--green)' }}>{s.count}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: 'var(--green)', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Online vs Offline + Concern Tags */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Source Breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { label: 'Online (Website)', count: onlineCount, color: 'var(--teal)', bg: 'rgba(20,184,166,0.15)' },
                  { label: 'Offline (HQ/Specialist)', count: offlineCount, color: 'var(--orange)', bg: 'var(--orL)' },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 34, fontWeight: 800, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginTop: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>{Math.round(s.count / (skinProfiles.length || 1) * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>All Concerns Cloud</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {Object.entries(concernCounts).sort((a,b) => b[1]-a[1]).map(([concern, count]) => (
                  <span key={concern} style={{ fontSize: 10 + Math.min(count, 5), padding: '3px 10px', borderRadius: 20, background: 'var(--orL)', color: 'var(--orange)', fontWeight: 600 }}>
                    {concern} <span style={{ fontFamily: 'DM Mono', opacity: 0.7 }}>({count})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFILES VIEW */}
      {view === 'cards' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient name..." style={{ ...inp, flex: 1, minWidth: 200 }} />
            <select value={skinTypeFilter} onChange={e => setSkinTypeFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
              <option value="all">All Skin Types</option>
              {skinTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
              <option value="all">All Sources</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
            <select value={specFilterId} onChange={e => setSpecFilterId(e.target.value)} style={{ ...inp, width: 'auto' }}>
              <option value="all">All Specialists</option>
              {specialists.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'var(--s1)', borderRadius: 12, border: '1px solid var(--b1)' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🌿</div>
              <div style={{ color: 'var(--mu)' }}>No skin profiles found</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 440px' : 'repeat(3,1fr)', gap: 14, alignItems: 'start' }}>
              <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
                {filtered.map((sp, i) => {
                  const name = getPatientName(sp)
                  const cons = getConsultation(sp)
                  const spec = getSpecialist(sp)
                  const recProducts = (sp.aiRecommendations || sp.recommendedProducts || []).map((rp: any) => getProduct(rp.product || rp.productId)).filter(Boolean)
                  const isSelected = selected?._id === sp._id
                  const statusLabel = cons?.status || (sp.source === 'offline' ? 'completed' : 'pending')
                  return (
                    <div key={i} onClick={() => setSelected(isSelected ? null : sp)} style={{ background: 'var(--s1)', border: '1px solid ' + (isSelected ? 'var(--gold)' : 'var(--b1)'), borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg,#C2185B,#880E4F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 17, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{name.charAt(0)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)' }}>{sp.skinType || 'Unknown'} skin</div>
                        </div>
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: sp.source === 'offline' ? 'var(--orL)' : 'var(--blL)', color: sp.source === 'offline' ? 'var(--orange)' : 'var(--blue)', flexShrink: 0 }}>
                          {sp.source === 'offline' ? 'Offline' : 'Online'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                        {(sp.skinConcerns || []).slice(0, 3).map((c: string, ci: number) => (
                          <span key={ci} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--gL)', color: 'var(--gold)', fontWeight: 600 }}>{c}</span>
                        ))}
                      </div>
                      {spec && <div style={{ fontSize: 11, color: 'var(--teal)', marginBottom: 6 }}>👩‍⚕️ {spec.name}</div>}
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 12 }}>{recProducts.length} products recommended</div>
                      <div style={{ display: 'flex', gap: 7 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => printProfile(sp)} style={{ flex: 1, padding: '7px', background: 'var(--gL)', border: 'none', borderRadius: 7, color: 'var(--gold)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>Print PDF</button>
                        <button onClick={() => shareWhatsApp(sp)} style={{ flex: 1, padding: '7px', background: 'var(--grL)', border: 'none', borderRadius: 7, color: 'var(--green)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 700 }}>WhatsApp</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {selected && (() => {
                const name = getPatientName(selected)
                const cons = getConsultation(selected)
                const spec = getSpecialist(selected)
                const phone = getPatientPhone(selected)
                const recProducts = (selected.aiRecommendations || selected.recommendedProducts || []).map((rp: any) => ({ ...getProduct(rp.product || rp.productId), reason: rp.reason })).filter((p: any) => p._id)
                return (
                  <div style={{ position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800 }}>{name}</div>
                        <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 3 }}>{selected.skinType} skin · {cons?.consultationNumber || (selected.source === 'offline' ? 'Offline' : 'N/A')}</div>
                      </div>
                      <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                      {[
                        { label: 'Skin Type', value: selected.skinType },
                        { label: 'Specialist', value: spec?.name || 'N/A' },
                        { label: 'Stress Level', value: selected.stressLevel },
                        { label: 'Status', value: cons?.status || (selected.source === 'offline' ? 'Completed' : 'N/A') },
                        { label: 'Source', value: selected.source === 'offline' ? 'Offline' : 'Online' },
                        { label: 'Age', value: selected.age || 'N/A' },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 11px' }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{item.value || 'N/A'}</div>
                        </div>
                      ))}
                    </div>
                    {(selected.skinConcerns || []).length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 7 }}>Skin Concerns</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(selected.skinConcerns || []).map((c: string, i: number) => (
                            <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--rdL)', color: 'var(--red)', fontWeight: 600 }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {cons?.concern && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 7 }}>Patient Concern</div>
                        <div style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6, background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>{cons.concern}</div>
                      </div>
                    )}
                    {selected.skinGoals && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 7 }}>Skin Goals</div>
                        <div style={{ fontSize: 12.5, color: 'var(--mu2)', background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>{selected.skinGoals}</div>
                      </div>
                    )}
                    {selected.diet && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 7 }}>Diet</div>
                        <div style={{ fontSize: 12.5, color: 'var(--mu2)', background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>{selected.diet}</div>
                      </div>
                    )}
                    {selected.specialistNotes && (
                      Array.isArray(selected.specialistNotes) ? selected.specialistNotes.length > 0 : Object.keys(selected.specialistNotes || {}).length > 0
                    ) && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7 }}>Specialist Notes</div>
                        {Array.isArray(selected.specialistNotes) ? selected.specialistNotes.map((cf: any, i: number) => (
                          <div key={i} style={{ marginBottom: 8, background: 'var(--s2)', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>{cf.key}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{cf.value}</div>
                          </div>
                        )) : Object.entries(selected.specialistNotes).filter(([k, v]) => v && String(v).trim()).map(([k, v]: any, i: number) => (
                          <div key={i} style={{ marginBottom: 8, background: 'var(--s2)', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>{k.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase())}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {recProducts.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 7 }}>Recommended Products ({recProducts.length})</div>
                        {recProducts.map((p: any, i: number) => (
                          <div key={i} style={{ display: 'flex', gap: 10, padding: 10, background: 'var(--s2)', borderRadius: 10, marginBottom: 8 }}>
                            {p.image ? <img src={p.image} alt={p.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--gL)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🌿</div>}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>{p.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, marginBottom: 3 }}>₹{p.price}</div>
                              {p.reason && <div style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.4 }}>{p.reason?.slice(0, 80)}...</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(cons?.images) && cons.images.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 7 }}>Skin Images</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {cons.images.slice(0, 4).map((img: any, i: number) => (
                            <img key={i} src={img.url} alt="skin" style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--b1)' }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <button onClick={() => printProfile(selected)} style={{ width: '100%', padding: 11, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 9, color: '#08090C', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>Print / Download PDF</button>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => shareWhatsApp(selected)} style={{ flex: 1, padding: 10, background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 9, color: 'var(--green)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>WhatsApp Share</button>
                        {phone && <button onClick={() => shareWhatsApp(selected, true)} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#25D366,#128C7E)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>Send to Patient</button>}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}
