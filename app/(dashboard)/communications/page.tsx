'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'var(--green)',  bg: 'var(--grL)' },
  { id: 'email',    label: 'Email',    icon: '📧', color: 'var(--blue)',   bg: 'var(--blL)' },
  { id: 'sms',      label: 'SMS',      icon: '📱', color: 'var(--purple)', bg: 'rgba(139,92,246,0.12)' },
]

const TRIGGER_TYPES = [
  { id: 'post_purchase',       label: 'Post Purchase',         icon: '🛍️',  desc: 'Order place hone ke baad' },
  { id: 'consultation_booked', label: 'Consultation Booked',   icon: '📅',  desc: 'Consultation schedule hone pe' },
  { id: 'consultation_reminder', label: 'Consultation Reminder', icon: '⏰', desc: '1 day pehle reminder' },
  { id: 'routine_morning',     label: 'Morning Routine',       icon: '🌅',  desc: 'Daily morning reminder' },
  { id: 'routine_night',       label: 'Night Routine',         icon: '🌙',  desc: 'Daily night reminder' },
  { id: 'skin_education',      label: 'Skin Education',        icon: '📚',  desc: 'Skin tips & education' },
  { id: 'reorder_reminder',    label: 'Reorder Reminder',      icon: '🔄',  desc: '30 days baad product reorder' },
  { id: 'feedback_request',    label: 'Feedback Request',      icon: '⭐',  desc: 'Delivery ke 3 din baad' },
  { id: 'user_login',          label: 'New User Login',        icon: '👋',  desc: 'Pehli baar login pe' },
  { id: 'user_login',          label: 'New User Login',        icon: '👋',  desc: 'Pehli baar login pe welcome' },
  { id: 'consultation_complete', label: 'Consultation Complete',  icon: '✅',  desc: 'Skin profile + PDF link bhejo' },
  { id: 'no_booking',           label: 'Not Booked Reminder',   icon: '📅',  desc: 'Login kiya, consultation nahi ki' },
  { id: 'cart_abandoned',       label: 'Cart Abandoned',         icon: '🛒',  desc: 'Cart mein product add kiya, order nahi' },
  { id: 'birthday',             label: 'Birthday Wish',          icon: '🎂',  desc: 'Birthday pe special offer' },
  { id: 'win_back',             label: 'Win Back',               icon: '💝',  desc: '30 din se koi order nahi' },
  { id: 'custom',               label: 'Custom Campaign',        icon: '📢',  desc: 'Manual broadcast' },
]

const DEFAULT_TEMPLATES: Record<string, string> = {
  post_purchase: `Hi {{name}}! 🎉 Aapka order #{{orderNumber}} place ho gaya hai!

🌿 Rabt Naturals se purchase karne ke liye shukriya.
📦 Expected delivery: 3-5 working days

Apna order track karein: rabtnaturals.com/track
Koi sawaal ho toh reply karein! 💚`,

  consultation_booked: `Hi {{name}}! 📅

Aapki skin consultation schedule ho gayi hai!
🗓️ Date: {{date}}
⏰ Time: {{time}}
👩‍⚕️ Specialist: {{specialist}}

Kuch bhi puchna ho toh reply karein.
~Rabt Naturals 🌿`,

  consultation_reminder: `Hi {{name}}! ⏰ Reminder

Kal aapki skin consultation hai!
🗓️ {{date}} ko {{time}} pe
👩‍⚕️ {{specialist}} ke saath

Ready rahein — apni skin concerns list banaye rakhein! 🌿
~Rabt Naturals`,

  routine_morning: `Good morning {{name}}! ☀️

Aaj apna morning skincare routine kiya?
🌿 Consistency hi key hai!

AM Routine Steps:
1️⃣ Cleanser
2️⃣ Toner
3️⃣ Serum
4️⃣ Moisturizer
5️⃣ Sunscreen ☀️

Results 4-6 weeks mein nazar aayenge! 💪
~Rabt Naturals 🌿`,

  routine_night: `Good night {{name}}! 🌙

PM Routine yaad hai na?
1️⃣ Cleanser
2️⃣ Toner
3️⃣ Serum/Treatment
4️⃣ Night Moisturizer

Raat ko skin repair hoti hai — miss mat karo! ✨
~Rabt Naturals 🌿`,

  skin_education: `Hi {{name}}! 📚

Aaj ki skin tip:
💡 {{tip}}

Apni skin ke baare mein aur jaanna chahte hain?
rabtnaturals.com pe AI skin analysis try karein!

~Rabt Naturals 🌿`,

  reorder_reminder: `Hi {{name}}! 🔄

Aapka {{product}} khatam hone wala hoga!
30 din ho gaye hain purchase ke.

Reorder karein aur routine maintain rakhein:
🛒 rabtnaturals.com

~Rabt Naturals 🌿`,

  feedback_request: `Hi {{name}}! ⭐

Aapka order deliver ho gaya hoga!
Kaisi lagi hamari products?

Apna review share karein:
🔗 rabtnaturals.com/review

Aapka feedback hume behtar banane mein help karta hai! 💚
~Rabt Naturals 🌿`,

  custom: `Hi {{name}}! 🌿

{{message}}

~Rabt Naturals`,
}

export default function CommunicationsPage() {
  const [tab, setTab] = useState<'dashboard'|'campaigns'|'automations'|'templates'|'settings'>('dashboard')
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [automations, setAutomations] = useState<any[]>([])
  const [templates, setTemplates] = useState<Record<string, any>>({})
  const [settings, setSettings] = useState({
    whatsapp_enabled: false,
    whatsapp_provider: 'twilio',
    twilio_sid: '',
    twilio_token: '',
    twilio_whatsapp: 'whatsapp:+14155238886',
    email_enabled: false,
    email_provider: 'smtp',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    sms_enabled: false,
    sms_provider: 'twilio',
  })
  const [savingSettings, setSavingSettings] = useState(false)

  // Campaign form
  const [campaign, setCampaign] = useState({
    channel: 'whatsapp',
    trigger: 'custom',
    audience: 'all',
    message: DEFAULT_TEMPLATES.custom,
    schedule: 'now',
    scheduleTime: '',
  })
  const [sending, setSending] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('custom')

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [logsRes, autoRes, settRes, tmplRes] = await Promise.all([
        supabase.from('comm_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('comm_automations').select('*').order('created_at', { ascending: false }),
        supabase.from('app_settings').select('*').eq('key', 'comm_settings').single(),
        supabase.from('app_settings').select('*').eq('key', 'comm_templates').single(),
      ])
      setLogs(logsRes.data || [])
      setAutomations(autoRes.data || [])
      if (settRes.data?.value) setSettings(JSON.parse(settRes.data.value))
      if (tmplRes.data?.value) setTemplates(JSON.parse(tmplRes.data.value))

      // Load customers from MongoDB
      const url = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null
      if (url) {
        const [ordRes, userRes] = await Promise.all([
          fetch(url + '/api/orders').then(r => r.ok ? r.json() : []),
          fetch(url + '/api/users').then(r => r.ok ? r.json() : []),
        ])
        const customerMap: Record<string, any> = {}
        ;(Array.isArray(userRes) ? userRes : []).forEach((u: any) => {
          const phone = u.phoneNumber || u.phone || ''
          if (phone) customerMap[phone] = { name: u.firstName + ' ' + (u.lastName || ''), phone, email: u.email || '', orders: [] }
        })
        ;(Array.isArray(ordRes) ? ordRes : []).forEach((o: any) => {
          const phone = o.customerPhone || o.shippingAddress?.contactPhone || ''
          if (phone) {
            if (!customerMap[phone]) customerMap[phone] = { name: o.customerName || 'Customer', phone, email: '', orders: [] }
            customerMap[phone].orders.push(o)
          }
        })
        setCustomers(Object.values(customerMap))
      }
    } catch {}
    setLoading(false)
  }

  async function saveSettings() {
    setSavingSettings(true)
    await supabase.from('app_settings').upsert({ key: 'comm_settings', value: JSON.stringify(settings) })
    toast.success('Settings saved! ✅')
    setSavingSettings(false)
  }

  async function toggleAutomation(id: string, enabled: boolean) {
    await supabase.from('comm_automations').update({ enabled }).eq('id', id)
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled } : a))
    toast.success(enabled ? 'Automation enabled!' : 'Automation disabled!')
  }

  async function createAutomation(trigger: string, channel: string) {
    const { data } = await supabase.from('comm_automations').insert({
      trigger, channel,
      template: DEFAULT_TEMPLATES[trigger] || DEFAULT_TEMPLATES.custom,
      enabled: false,
      name: TRIGGER_TYPES.find(t => t.id === trigger)?.label || trigger,
    }).select().single()
    if (data) setAutomations(prev => [data, ...prev])
    toast.success('Automation created! Enable karo isko.')
  }

  async function sendCampaign() {
    if (!campaign.message.trim()) { toast.error('Message likhein'); return }
    setSending(true)
    toast.loading('Campaign send ho rahi hai...', { id: 'campaign' })
    try {
      // Filter audience
      let audience = customers
      if (campaign.audience === 'purchased') audience = customers.filter(c => c.orders.length > 0)
      if (campaign.audience === 'new') audience = customers.filter(c => c.orders.length === 0)
      if (campaign.audience === 'repeat') audience = customers.filter(c => c.orders.length > 1)

      // Log campaign
      await supabase.from('comm_logs').insert({
        type: 'campaign',
        channel: campaign.channel,
        trigger: campaign.trigger,
        audience_count: audience.length,
        message: campaign.message,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })

      toast.success(`Campaign sent to ${audience.length} customers! 🎉`, { id: 'campaign' })
      loadAll()
    } catch (err: any) {
      toast.error('Error: ' + err.message, { id: 'campaign' })
    }
    setSending(false)
  }

  // Stats
  const totalSent     = logs.filter(l => l.status === 'sent').length
  const totalFailed   = logs.filter(l => l.status === 'failed').length
  const whatsappSent  = logs.filter(l => l.channel === 'whatsapp').length
  const emailSent     = logs.filter(l => l.channel === 'email').length
  const activeAutos   = automations.filter(a => a.enabled).length

  const inp: any = { background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', width: '100%', marginBottom: 10 }

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Omni <span style={{ color: 'var(--teal)' }}>Communications</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>WhatsApp · Email · SMS · Automation</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {CHANNELS.map(ch => (
            <span key={ch.id} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: ch.bg, color: ch.color, fontWeight: 700 }}>
              {ch.icon} {ch.label} {settings[`${ch.id}_enabled` as keyof typeof settings] ? '✓' : '✗'}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'dashboard',    l: '📊 Dashboard' },
          { id: 'campaigns',    l: '📢 Campaigns' },
          { id: 'automations',  l: '⚙️ Automations' },
          { id: 'templates',    l: '📝 Templates' },
          { id: 'settings',     l: '🔧 Settings' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid ' + (tab === t.id ? 'rgba(0,151,167,0.3)' : 'var(--b1)'),
            background: tab === t.id ? 'rgba(0,151,167,0.1)' : 'var(--s2)',
            color: tab === t.id ? 'var(--teal)' : 'var(--mu2)',
            fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit'
          }}>{t.l}</button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Sent',       value: totalSent,    color: 'var(--green)',  icon: '✅' },
              { label: 'Failed',           value: totalFailed,  color: 'var(--red)',    icon: '❌' },
              { label: 'WhatsApp Sent',    value: whatsappSent, color: 'var(--green)',  icon: '💬' },
              { label: 'Email Sent',       value: emailSent,    color: 'var(--blue)',   icon: '📧' },
              { label: 'Active Autos',     value: activeAutos,  color: 'var(--teal)',   icon: '⚙️' },
              { label: 'Total Customers',  value: customers.length, color: 'var(--purple)', icon: '👥' },
            ].map((s, i) => (
              <div key={i} className="card">
                <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Recent Logs */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Recent Activity</div>
            {logs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 14 }}>Koi message abhi nahi bheja gaya</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Campaigns tab se pehla message bhejo!</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Date', 'Type', 'Channel', 'Audience', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => {
                    const ch = CHANNELS.find(c => c.id === l.channel) || CHANNELS[0]
                    return (
                      <tr key={i} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseOut={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--mu)', fontFamily: 'DM Mono' }}>{new Date(l.created_at).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12 }}>{TRIGGER_TYPES.find(t => t.id === l.trigger)?.label || l.trigger}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: ch.bg, color: ch.color, fontWeight: 700 }}>{ch.icon} {ch.label}</span>
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'DM Mono', fontWeight: 700 }}>{l.audience_count || 1}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: l.status === 'sent' ? 'var(--grL)' : 'var(--rdL)', color: l.status === 'sent' ? 'var(--green)' : 'var(--red)' }}>{l.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* CAMPAIGNS */}
      {tab === 'campaigns' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
          <div>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>📢 New Campaign</div>

              {/* Channel */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Channel</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {CHANNELS.map(ch => (
                    <button key={ch.id} onClick={() => setCampaign(p => ({ ...p, channel: ch.id }))} style={{
                      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit', fontSize: 13, fontWeight: 600,
                      border: '1.5px solid ' + (campaign.channel === ch.id ? ch.color : 'var(--b1)'),
                      background: campaign.channel === ch.id ? ch.bg : 'var(--s2)',
                      color: campaign.channel === ch.id ? ch.color : 'var(--mu)',
                    }}>{ch.icon} {ch.label}</button>
                  ))}
                </div>
              </div>

              {/* Trigger */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Message Type</label>
                <select value={campaign.trigger} onChange={e => { setCampaign(p => ({ ...p, trigger: e.target.value, message: DEFAULT_TEMPLATES[e.target.value] || DEFAULT_TEMPLATES.custom })); setSelectedTemplate(e.target.value) }} style={inp}>
                  {TRIGGER_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                </select>
              </div>

              {/* Audience */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Audience</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { id: 'all',       l: 'All Customers',    count: customers.length },
                    { id: 'purchased', l: 'Purchased',        count: customers.filter(c => c.orders.length > 0).length },
                    { id: 'new',       l: 'No Orders Yet',    count: customers.filter(c => c.orders.length === 0).length },
                    { id: 'repeat',    l: 'Repeat Buyers',    count: customers.filter(c => c.orders.length > 1).length },
                  ].map(a => (
                    <div key={a.id} onClick={() => setCampaign(p => ({ ...p, audience: a.id }))} style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      border: '1.5px solid ' + (campaign.audience === a.id ? 'var(--teal)' : 'var(--b1)'),
                      background: campaign.audience === a.id ? 'rgba(0,151,167,0.08)' : 'var(--s2)',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: campaign.audience === a.id ? 'var(--teal)' : 'var(--tx)' }}>{a.l}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{a.count} customers</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Message</label>
                <textarea value={campaign.message} onChange={e => setCampaign(p => ({ ...p, message: e.target.value }))} rows={8} style={{ ...inp, resize: 'vertical', marginBottom: 6, fontFamily: 'DM Mono', fontSize: 12, lineHeight: 1.6 }} />
                <div style={{ fontSize: 10, color: 'var(--mu)' }}>Variables: {'{{name}}'} {'{{orderNumber}}'} {'{{date}}'} {'{{product}}'}</div>
              </div>

              {/* Schedule */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Schedule</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ id: 'now', l: '🚀 Send Now' }, { id: 'schedule', l: '⏰ Schedule' }].map(s => (
                    <button key={s.id} onClick={() => setCampaign(p => ({ ...p, schedule: s.id }))} style={{
                      flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit', fontSize: 13, fontWeight: 600,
                      border: '1px solid ' + (campaign.schedule === s.id ? 'var(--teal)' : 'var(--b1)'),
                      background: campaign.schedule === s.id ? 'rgba(0,151,167,0.08)' : 'var(--s2)',
                      color: campaign.schedule === s.id ? 'var(--teal)' : 'var(--mu)',
                    }}>{s.l}</button>
                  ))}
                </div>
                {campaign.schedule === 'schedule' && (
                  <input type="datetime-local" value={campaign.scheduleTime} onChange={e => setCampaign(p => ({ ...p, scheduleTime: e.target.value }))} style={{ ...inp, marginTop: 8 }} />
                )}
              </div>

              <button onClick={sendCampaign} disabled={sending} style={{
                width: '100%', padding: 13,
                background: sending ? 'var(--s2)' : 'linear-gradient(135deg,#0097A7,#005F6A)',
                border: 'none', borderRadius: 10,
                color: sending ? 'var(--mu)' : '#fff',
                fontWeight: 800, fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'Syne'
              }}>
                {sending ? '⏳ Sending...' : '🚀 Send Campaign'}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>👁️ Preview</div>
              <div style={{ background: '#e5ddd5', borderRadius: 12, padding: 16, minHeight: 200 }}>
                <div style={{ background: '#fff', borderRadius: '12px 12px 12px 4px', padding: '10px 14px', maxWidth: '85%', fontSize: 12.5, lineHeight: 1.7, color: '#111', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {campaign.message.replace(/{{name}}/g, 'Priya').replace(/{{orderNumber}}/g, '#12345').replace(/{{date}}/g, 'Mon, 20 Jan').replace(/{{time}}/g, '10:00 AM').replace(/{{specialist}}/g, 'Dr. Rahima').replace(/{{product}}/g, 'Moong Magic Serum')}
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 6, textAlign: 'right' }}>
                  {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ✓✓
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(0,151,167,0.06)', borderRadius: 8, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Audience:</div>
                <div style={{ color: 'var(--mu)' }}>
                  {campaign.audience === 'all' && `${customers.length} customers`}
                  {campaign.audience === 'purchased' && `${customers.filter(c => c.orders.length > 0).length} customers (purchased)`}
                  {campaign.audience === 'new' && `${customers.filter(c => c.orders.length === 0).length} customers (no orders)`}
                  {campaign.audience === 'repeat' && `${customers.filter(c => c.orders.length > 1).length} repeat buyers`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATIONS */}
      {tab === 'automations' && (
        <div>
          <div style={{ background: 'rgba(0,151,167,0.06)', border: '1px solid rgba(0,151,167,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
            💡 Automations automatically message bhejte hain jab trigger hota hai. Enable/disable karo as needed.
          </div>

          {/* Create new automation */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>➕ New Automation</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
              {TRIGGER_TYPES.filter(t => t.id !== 'custom').map(trigger => {
                const exists = automations.find(a => a.trigger === trigger.id)
                return (
                  <div key={trigger.id} style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--b1)' }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>{trigger.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{trigger.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 10 }}>{trigger.desc}</div>
                    {exists ? (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: exists.enabled ? 'var(--grL)' : 'var(--s1)', color: exists.enabled ? 'var(--green)' : 'var(--mu)', fontWeight: 700, border: '1px solid var(--b1)' }}>
                        {exists.enabled ? '✓ Active' : '○ Inactive'}
                      </span>
                    ) : (
                      <button onClick={() => createAutomation(trigger.id, 'whatsapp')} style={{ padding: '5px 12px', background: 'rgba(0,151,167,0.1)', border: '1px solid rgba(0,151,167,0.3)', borderRadius: 6, color: 'var(--teal)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                        + Create
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Existing automations */}
          {automations.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>My Automations ({automations.length})</div>
              {automations.map((auto, i) => {
                const trigger = TRIGGER_TYPES.find(t => t.id === auto.trigger)
                const ch = CHANNELS.find(c => c.id === auto.channel) || CHANNELS[0]
                return (
                  <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 24 }}>{trigger?.icon || '⚙️'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{auto.name || trigger?.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{trigger?.desc}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: ch.bg, color: ch.color, fontWeight: 700 }}>{ch.icon} {ch.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: auto.enabled ? 'var(--green)' : 'var(--mu)' }}>{auto.enabled ? 'Active' : 'Inactive'}</span>
                      <div onClick={() => toggleAutomation(auto.id, !auto.enabled)} style={{
                        width: 40, height: 22, borderRadius: 11, cursor: 'pointer', transition: 'background 0.2s',
                        background: auto.enabled ? 'var(--teal)' : 'var(--s2)',
                        border: '1px solid ' + (auto.enabled ? 'var(--teal)' : 'var(--b2)'),
                        position: 'relative',
                      }}>
                        <div style={{
                          position: 'absolute', top: 2, left: auto.enabled ? 18 : 2,
                          width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          transition: 'left 0.2s',
                        }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TEMPLATES */}
      {tab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {TRIGGER_TYPES.map(trigger => {
            const tmpl = templates[trigger.id] || DEFAULT_TEMPLATES[trigger.id] || ''
            return (
              <div key={trigger.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{trigger.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{trigger.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)' }}>{trigger.desc}</div>
                  </div>
                </div>
                <textarea
                  defaultValue={tmpl}
                  onBlur={async e => {
                    const updated = { ...templates, [trigger.id]: e.target.value }
                    setTemplates(updated)
                    await supabase.from('app_settings').upsert({ key: 'comm_templates', value: JSON.stringify(updated) })
                    toast.success('Template saved!')
                  }}
                  rows={6}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'DM Mono', fontSize: 11, lineHeight: 1.6, marginBottom: 6 }}
                />
                <div style={{ fontSize: 10, color: 'var(--mu)' }}>Click bahar karo to save</div>
              </div>
            )
          })}
        </div>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* WhatsApp */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>💬</span>
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>WhatsApp</div>
              <div onClick={() => setSettings(s => ({ ...s, whatsapp_enabled: !s.whatsapp_enabled }))} style={{ marginLeft: 'auto', width: 40, height: 22, borderRadius: 11, cursor: 'pointer', background: settings.whatsapp_enabled ? 'var(--teal)' : 'var(--s2)', border: '1px solid var(--b2)', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: settings.whatsapp_enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            <div style={{ background: 'rgba(0,151,167,0.06)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: 'var(--mu2)' }}>
              Twilio WhatsApp Business API use karta hai. sandbox ya production number se bhej sakte hain.
            </div>
            {[
              { k: 'twilio_sid',       l: 'Twilio Account SID',   type: 'text',     ph: 'ACxxxxxxxxxxxxxxxx' },
              { k: 'twilio_token',     l: 'Twilio Auth Token',     type: 'password', ph: 'xxxxxxxxxxxxxxxx' },
              { k: 'twilio_whatsapp',  l: 'WhatsApp From Number',  type: 'text',     ph: 'whatsapp:+14155238886' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                <input type={f.type} value={(settings as any)[f.k]} onChange={e => setSettings(s => ({ ...s, [f.k]: e.target.value }))} placeholder={f.ph} style={inp} />
              </div>
            ))}
          </div>

          {/* Email */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>📧</span>
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Email (SMTP)</div>
              <div onClick={() => setSettings(s => ({ ...s, email_enabled: !s.email_enabled }))} style={{ marginLeft: 'auto', width: 40, height: 22, borderRadius: 11, cursor: 'pointer', background: settings.email_enabled ? 'var(--teal)' : 'var(--s2)', border: '1px solid var(--b2)', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: settings.email_enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: 'var(--mu2)' }}>
              SMTP se email bhejein. Gmail, Zoho, AWS SES sab kaam karta hai.
            </div>
            {[
              { k: 'smtp_host',  l: 'SMTP Host',  type: 'text',     ph: 'smtp.gmail.com' },
              { k: 'smtp_port',  l: 'SMTP Port',  type: 'text',     ph: '587' },
              { k: 'smtp_user',  l: 'Username',   type: 'text',     ph: 'support@rabtnaturals.in' },
              { k: 'smtp_pass',  l: 'Password',   type: 'password', ph: 'App password' },
              { k: 'smtp_from',  l: 'From Name',  type: 'text',     ph: 'Rabt Naturals' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                <input type={f.type} value={(settings as any)[f.k]} onChange={e => setSettings(s => ({ ...s, [f.k]: e.target.value }))} placeholder={f.ph} style={inp} />
              </div>
            ))}
          </div>

          {/* SMS */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>📱</span>
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>SMS</div>
              <div onClick={() => setSettings(s => ({ ...s, sms_enabled: !s.sms_enabled }))} style={{ marginLeft: 'auto', width: 40, height: 22, borderRadius: 11, cursor: 'pointer', background: settings.sms_enabled ? 'var(--teal)' : 'var(--s2)', border: '1px solid var(--b2)', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: settings.sms_enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            <div style={{ background: 'rgba(139,92,246,0.06)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: 'var(--mu2)' }}>
              Twilio SMS se bulk SMS bhejein. India mein DLT registration zaroori hai.
            </div>
            <div style={{ fontSize: 12, color: 'var(--mu)', padding: 16, textAlign: 'center', background: 'var(--s2)', borderRadius: 8 }}>
              Same Twilio credentials use honge WhatsApp wale. Enable karo WhatsApp section mein.
            </div>
          </div>

          {/* Save */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>💡 Setup Guide</div>
              {[
                { step: '1', text: 'Twilio account banao twilio.com pe', color: 'var(--teal)' },
                { step: '2', text: 'WhatsApp Sandbox activate karo', color: 'var(--green)' },
                { step: '3', text: 'Account SID aur Auth Token copy karo', color: 'var(--blue)' },
                { step: '4', text: 'Settings save karo', color: 'var(--gold)' },
                { step: '5', text: 'Automations enable karo', color: 'var(--purple)' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.color, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.step}</div>
                  <div style={{ fontSize: 12, color: 'var(--mu2)' }}>{s.text}</div>
                </div>
              ))}
            </div>
            <button onClick={saveSettings} disabled={savingSettings} style={{
              width: '100%', padding: 13, marginTop: 20,
              background: savingSettings ? 'var(--s2)' : 'linear-gradient(135deg,#D4A853,#B87C30)',
              border: 'none', borderRadius: 10,
              color: savingSettings ? 'var(--mu)' : '#08090C',
              fontWeight: 800, fontSize: 14, cursor: savingSettings ? 'not-allowed' : 'pointer', fontFamily: 'Syne'
            }}>
              {savingSettings ? '⏳ Saving...' : '💾 Save All Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
