'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const TEMPLATES = {
  routine_morning: {
    label: '🌅 Morning Routine Reminder',
    category: 'Routine',
    color: 'var(--gold)',
    message: (data: any) => `Good morning ${data.name}! ☀️

Time for your Rabt Naturals morning routine! 🌿

${data.skinType === 'oily' || data.skinType === 'acne-prone' ? `*Your AM Routine (Oily/Acne-Prone):*
1️⃣ Moong Magic Cleanser
2️⃣ Moong Magic Toner
3️⃣ Moong Magic Serum
4️⃣ Moong Magic Moisturizer
5️⃣ Moong Magic Sunscreen` : data.skinType === 'dry' ? `*Your AM Routine (Dry):*
1️⃣ Oats Care Cleanser
2️⃣ Oats Care Serum
3️⃣ Oats Care Moisturizer
4️⃣ Sunscreen` : `*Your AM Routine:*
1️⃣ Cleanser → 2️⃣ Toner → 3️⃣ Serum
4️⃣ Moisturizer → 5️⃣ Sunscreen ☀️`}

Consistency = Results! 💪
~Rabt Naturals 🌿`,
  },
  routine_night: {
    label: '🌙 Night Routine Reminder',
    category: 'Routine',
    color: 'var(--purple)',
    message: (data: any) => `Good night ${data.name}! 🌙

Don't forget your night routine! 💤

*Your PM Routine:*
1️⃣ Cleanser 🧴
2️⃣ Serum ✨
3️⃣ Moisturizer 💧

Sweet dreams and glowing skin! 🌿
~Rabt Naturals`,
  },
  followup_7day: {
    label: '📊 7-Day Follow Up',
    category: 'Follow Up',
    color: 'var(--teal)',
    message: (data: any) => `Hi ${data.name}! 🌿

It's been 7 days since your consultation! How's your skin doing? 😊

*Quick check-in:*
Reply:
1️⃣ Amazing! Seeing results already
2️⃣ Good, adjusting to it
3️⃣ Need some help

*Your routine reminder:*
🌅 AM: Cleanser → Serum → Moisturizer → Sunscreen
🌙 PM: Cleanser → Serum → Moisturizer

Your specialist ${data.specialistName || ''} is here if you need help!
~Rabt Naturals 🌿`,
  },
  followup_14day: {
    label: '📊 14-Day Progress Check',
    category: 'Follow Up',
    color: 'var(--blue)',
    message: (data: any) => `Hi ${data.name}! 🌿

2 weeks into your Rabt Naturals journey! 🎉

You should start seeing:
✨ More even skin tone
✨ Better hydration
✨ Natural glow

📸 Take a selfie and compare with your before photo!

Still have concerns? Reply anytime!
~Rabt Naturals 🌿`,
  },
  followup_30day: {
    label: '🎯 30-Day Results Review',
    category: 'Follow Up',
    color: 'var(--gold)',
    message: (data: any) => `Hi ${data.name}! 🌟

30 DAYS of consistent skincare! You're amazing! 🎉

⭐ Rate your results and get 15% off!
Code: RABT30 at rabtnaturals.com/shop

Thank you for trusting Rabt Naturals! 🌿`,
  },
  consultation_reminder: {
    label: '⏰ Consultation Reminder',
    category: 'Consultation',
    color: 'var(--orange)',
    message: (data: any) => `Hi ${data.name}! ⏰

Your skin consultation is coming up! 🌿

📅 ${data.date || 'Date TBD'} at ${data.time || 'Time TBD'}
👩‍⚕️ ${data.specialistName || 'Rabt Specialist'}

Quick checklist:
✅ Clean face ready?
✅ Good lighting?
✅ Skin concerns noted?

See you soon! 🌿`,
  },
  diet_tip: {
    label: '🥗 Diet & Lifestyle Tip',
    category: 'Routine',
    color: 'var(--green)',
    message: (data: any) => `Hi ${data.name}! 🥗

Weekly skin health tip from your specialist!

*For ${data.skinType || 'healthy'} skin:*
🥗 Eat: Leafy greens, fruits, omega-3
❌ Avoid: Dairy, sugar, junk food
💧 Water: 3-4 litres daily!
😴 Sleep: 7-8 hours minimum

Skincare + Diet + Sleep = Glowing skin! ✨
~${data.specialistName || 'Rabt Naturals'} 🌿`,
  },
  routine_purchased: {
    label: '🛍️ Routine Purchased - Start Guide',
    category: 'Order',
    color: 'var(--pink)',
    message: (data: any) => `Hi ${data.name}! 🎉

Thank you for your purchase from Rabt Naturals! 🌿

Your routine will arrive in 3-5 days.

*Your personalized routine:*
🌅 Morning: Cleanser → Serum → Moisturizer → Sunscreen
🌙 Night: Cleanser → Serum → Moisturizer

I'll send you daily reminders to help you stay consistent! 💪

Your skin journey starts now! 🌿
~${data.specialistName || 'Your Specialist'}`,
  },
}

async function sendWhatsApp(phone: string, message: string) {
  const cleanPhone = phone.replace(/[^0-9]/g, '')
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
  await supabase.from('whatsapp_logs').insert({
    to_number: phone, message: message.substring(0, 500), status: 'sent', type: 'manual'
  })
}

export default function RemindersPage() {
  const [mongoSpec, setMongoSpec] = useState<any>(null)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [patients, setPatients] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [skinProfiles, setSkinProfiles] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('routine_morning')
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [previewMsg, setPreviewMsg] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [bulkSelected, setBulkSelected] = useState<string[]>([])
  const [bulkMode, setBulkMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true); loadAll() }, [])

  useEffect(() => {
    if (selectedPatient && selectedTemplate) generatePreview(selectedPatient)
  }, [selectedPatient, selectedTemplate])

  function generatePreview(patient: any) {
    const tmpl = TEMPLATES[selectedTemplate as keyof typeof TEMPLATES]
    const sp = skinProfiles.find(s => 
      s.specialistId?.toString() === mongoSpec?._id?.toString() &&
      (s.name?.toLowerCase() === patient.name?.toLowerCase() || s.phone === patient.phone)
    )
    const msg = tmpl.message({
      name: patient.name || 'Patient',
      phone: patient.phone || '',
      skinType: sp?.skinType || patient.skinType || '',
      specialistName: mongoSpec?.name || 'Your Specialist',
      date: patient.scheduledDate ? new Date(patient.scheduledDate).toLocaleDateString('en-IN') : '',
      time: patient.scheduledTime || '',
    })
    setPreviewMsg(msg)
  }

  async function loadAll() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      setMyProfile(prof)
      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (!url) { setLoading(false); return }

      const [specRes, consRes, ordRes, skinRes, userRes] = await Promise.all([
        fetch(url + '/api/specialists').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/consultations').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/orders').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/skinprofiles').then(r => r.ok ? r.json() : []),
        fetch(url + '/api/users').then(r => r.ok ? r.json() : []),
      ])

      const allSpecs = Array.isArray(specRes) ? specRes : []
      const mySpec = allSpecs.find((s: any) => s.email?.toLowerCase() === prof?.email?.toLowerCase())
      setMongoSpec(mySpec)

      if (mySpec) {
        const allCons = Array.isArray(consRes) ? consRes : []
        const allOrders = Array.isArray(ordRes) ? ordRes : []
        const allSkins = Array.isArray(skinRes) ? skinRes : []
        const allUsers = Array.isArray(userRes) ? userRes : []

        const myCons = allCons.filter((c: any) => c.assignedSpecialist?.toString() === mySpec._id?.toString())
        setConsultations(myCons)

        const myConsIds = new Set(myCons.map((c: any) => c._id?.toString()))
        const mySkins = allSkins.filter((p: any) =>
          p.specialistId?.toString() === mySpec._id?.toString() ||
          (p.consultationId && myConsIds.has(p.consultationId?.toString()))
        )
        setSkinProfiles(mySkins)

        const myPatientIds = new Set(myCons.map((c: any) => c.userId).filter(Boolean))
        const myOrders = allOrders.filter((o: any) => {
          const uid = o.userId || o.user
          return (uid && myPatientIds.has(uid)) || o.specialistId?.toString() === mySpec._id?.toString()
        })
        setOrders(myOrders)

        // Build patients list
        const patientMap: Record<string, any> = {}
        myCons.forEach((c: any) => {
          const key = c.name?.toLowerCase().trim()
          if (!key) return
          const u = allUsers.find((u: any) => u._id?.toString() === c.userId?.toString())
          const phone = c.phone || u?.phoneNumber || u?.phone || ''
          if (!patientMap[key]) patientMap[key] = { name: c.name, phone, source: 'online', skinType: '', consultations: [], orders: [] }
          patientMap[key].consultations.push(c)
          if (phone) patientMap[key].phone = phone
        })
        mySkins.forEach((sp: any) => {
          if (!sp.name) return
          const key = sp.name?.toLowerCase().trim()
          if (!patientMap[key]) patientMap[key] = { name: sp.name, phone: sp.phone || '', source: 'offline', skinType: sp.skinType || '', consultations: [], orders: [] }
          if (sp.skinType) patientMap[key].skinType = sp.skinType
          if (sp.phone) patientMap[key].phone = sp.phone
          if (sp.source === 'offline') patientMap[key].source = 'offline'
        })
        myOrders.forEach((o: any) => {
          const key = o.customerName?.toLowerCase().trim()
          if (!key) return
          if (!patientMap[key]) patientMap[key] = { name: o.customerName, phone: o.customerPhone || '', source: o.source === 'specialist_offline' ? 'offline' : 'online', skinType: '', consultations: [], orders: [] }
          patientMap[key].orders.push(o)
          if (o.customerPhone) patientMap[key].phone = o.customerPhone
        })
        setPatients(Object.values(patientMap))
      }

      const { data: logsData } = await supabase.from('whatsapp_logs').select('*').order('created_at', { ascending: false }).limit(20)
      setLogs(logsData || [])
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  const categories = ['All', 'Routine', 'Follow Up', 'Consultation', 'Order']
  const filteredTemplates = Object.entries(TEMPLATES).filter(([_, t]) => activeCategory === 'All' || t.category === activeCategory)
  const filteredPatients = patients.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search))

  // Patients who purchased (have orders)
  const purchasedPatients = patients.filter(p => p.orders.length > 0)

  const inp: any = { background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'Outfit', outline: 'none' }

  if (!mounted) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Reminders & <span style={{ color: 'var(--gold)' }}>Follow-Up</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>Sirf apne patients — WhatsApp reminders aur routine alerts</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setBulkMode(!bulkMode)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit', background: bulkMode ? 'var(--blL)' : 'var(--s2)', color: bulkMode ? 'var(--blue)' : 'var(--mu)', border: '1px solid var(--b1)' }}>
            {bulkMode ? '✓ Bulk ON' : 'Bulk Send'}
          </button>
          <button onClick={loadAll} style={{ padding: '8px 14px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'My Patients', value: patients.length, color: 'var(--blue)' },
          { label: 'Purchased Routine', value: purchasedPatients.length, color: 'var(--green)' },
          { label: 'With Phone', value: patients.filter(p => p.phone).length, color: 'var(--teal)' },
          { label: 'Messages Sent', value: logs.length, color: 'var(--gold)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Routine Reminder Alert */}
      {purchasedPatients.length > 0 && (
        <div style={{ background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>🔔 {purchasedPatients.length} patients ne routine purchase ki hai</div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 3 }}>Inhe daily routine reminders bhejo!</div>
          </div>
          <button onClick={() => { setSelectedTemplate('routine_morning'); setBulkMode(true); setBulkSelected(purchasedPatients.map(p => p.name)) }} style={{ padding: '8px 16px', background: 'var(--green)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Select All → Send Reminder
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 340px', gap: 14 }}>

        {/* TEMPLATES */}
        <div>
          <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Templates</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: activeCategory === cat ? 'var(--gL)' : 'transparent', color: activeCategory === cat ? 'var(--gold)' : 'var(--mu)', border: '1px solid ' + (activeCategory === cat ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
            {filteredTemplates.map(([key, tmpl]) => (
              <div key={key} onClick={() => setSelectedTemplate(key)} style={{ background: selectedTemplate === key ? tmpl.color + '18' : 'var(--s1)', border: `1px solid ${selectedTemplate === key ? tmpl.color + '44' : 'var(--b1)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: selectedTemplate === key ? tmpl.color : 'var(--tx)' }}>{tmpl.label}</div>
                <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>{tmpl.category}</div>
              </div>
            ))}
          </div>
        </div>

        {/* PATIENTS */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>My Patients ({filteredPatients.length})</div>
            {bulkMode && bulkSelected.length > 0 && (
              <button onClick={async () => {
                const tmpl = TEMPLATES[selectedTemplate as keyof typeof TEMPLATES]
                for (const name of bulkSelected) {
                  const p = patients.find(x => x.name === name)
                  if (p?.phone) {
                    const sp = skinProfiles.find(s => s.name?.toLowerCase() === p.name?.toLowerCase())
                    const msg = tmpl.message({ name: p.name, skinType: sp?.skinType || p.skinType || '', specialistName: mongoSpec?.name || 'Your Specialist' })
                    await sendWhatsApp(p.phone, msg)
                    await new Promise(r => setTimeout(r, 500))
                  }
                }
                toast.success(`Sent to ${bulkSelected.length} patients!`)
                setBulkSelected([])
                loadAll()
              }} style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#22C55E,#16A34A)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Send to {bulkSelected.length} selected
              </button>
            )}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient..." style={{ ...inp, width: '100%', marginBottom: 10 }} />

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--mu)' }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
              {filteredPatients.map((p: any, i: number) => {
                const isSelected = selectedPatient?.name === p.name
                const isBulk = bulkSelected.includes(p.name)
                const sp = skinProfiles.find(s => s.name?.toLowerCase() === p.name?.toLowerCase())
                return (
                  <div key={i} onClick={() => {
                    if (bulkMode) setBulkSelected(prev => prev.includes(p.name) ? prev.filter(x => x !== p.name) : [...prev, p.name])
                    else { setSelectedPatient(isSelected ? null : p); if (!isSelected) generatePreview(p) }
                  }} style={{ background: isSelected || isBulk ? 'var(--gL)' : 'var(--s1)', border: `1px solid ${isSelected || isBulk ? 'rgba(212,168,83,0.4)' : 'var(--b1)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {bulkMode && (
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isBulk ? 'var(--gold)' : 'var(--b2)'}`, background: isBulk ? 'var(--gold)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isBulk && <div style={{ width: 8, height: 8, borderRadius: 2, background: '#08090C' }} />}
                      </div>
                    )}
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: p.source === 'offline' ? 'linear-gradient(135deg,#D4A853,#B87C30)' : 'linear-gradient(135deg,#3B82F6,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {(p.name || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: 'DM Mono' }}>{p.phone || 'No phone'}</div>
                      {sp?.skinType && <div style={{ fontSize: 10, color: 'var(--teal)' }}>🔬 {sp.skinType}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700, background: p.source === 'offline' ? 'var(--orL)' : 'var(--blL)', color: p.source === 'offline' ? 'var(--orange)' : 'var(--blue)' }}>{p.source}</span>
                      {p.orders.length > 0 && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700, background: 'var(--grL)', color: 'var(--green)' }}>🛍️ Purchased</span>}
                    </div>
                  </div>
                )
              })}
              {filteredPatients.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--mu)', fontSize: 12 }}>No patients found</div>}
            </div>
          )}
        </div>

        {/* PREVIEW + SEND */}
        <div>
          <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Preview & Send</div>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, overflow: 'hidden' }}>
            {selectedPatient && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--b1)', background: 'var(--s2)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>To: {selectedPatient.name}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: 'DM Mono' }}>{selectedPatient.phone || 'No phone'}</div>
              </div>
            )}
            <div style={{ padding: 14, minHeight: 280, maxHeight: 380, overflowY: 'auto' }}>
              {previewMsg ? (
                <div style={{ background: '#DCF8C6', borderRadius: '12px 12px 3px 12px', padding: '12px 14px', fontSize: 12.5, lineHeight: 1.7, color: '#1a1a1a', whiteSpace: 'pre-wrap', fontFamily: 'system-ui' }}>
                  {previewMsg}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--mu)' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
                  <div style={{ fontSize: 12 }}>Patient aur template select karo</div>
                </div>
              )}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--b1)', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <button onClick={async () => {
                if (!selectedPatient || !previewMsg) { toast.error('Patient aur template select karo'); return }
                if (!selectedPatient.phone) { toast.error('Is patient ka phone number nahi hai'); return }
                await sendWhatsApp(selectedPatient.phone, previewMsg)
                toast.success(`WhatsApp opened for ${selectedPatient.name}!`)
                loadAll()
              }} disabled={!selectedPatient || !previewMsg} style={{ width: '100%', padding: 10, background: selectedPatient && previewMsg ? 'linear-gradient(135deg,#22C55E,#16A34A)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, color: selectedPatient && previewMsg ? '#fff' : 'var(--mu)', fontSize: 13, fontWeight: 700, cursor: selectedPatient && previewMsg ? 'pointer' : 'not-allowed', fontFamily: 'Outfit' }}>
                💬 Send WhatsApp
              </button>
              <button onClick={() => { if (previewMsg) { navigator.clipboard.writeText(previewMsg); toast.success('Copied!') } }} style={{ width: '100%', padding: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>
                📋 Copy Message
              </button>
            </div>
          </div>

          {/* Recent Logs */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Recent Sent</div>
            {logs.slice(0, 4).map((log, i) => (
              <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontFamily: 'DM Mono' }}>{log.to_number}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'var(--grL)', color: 'var(--green)', fontWeight: 700 }}>{log.status}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</div>
              </div>
            ))}
            {logs.length === 0 && <div style={{ fontSize: 12, color: 'var(--mu)', textAlign: 'center', padding: 16 }}>No messages sent yet</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
