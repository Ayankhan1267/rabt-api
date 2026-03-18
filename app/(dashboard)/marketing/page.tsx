'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const INFLUENCER_STAGES = ['Outreach Sent', 'Contacted', 'Negotiating', 'Confirmed ✅', 'Posted ✅', 'Cancelled']
const CAMPAIGN_PLATFORMS = ['Meta Ads', 'Instagram', 'Google Ads', 'YouTube', 'WhatsApp', 'Email', 'Organic']
const CAMPAIGN_STATUSES = ['Draft', 'Scheduled', 'Live', 'Paused', 'Completed']
const NICHES = ['Skincare', 'Lifestyle', 'Beauty', 'Health', 'Fitness', 'Wellness', 'Fashion']

export default function MarketingPage() {
  const [tab, setTab] = useState<'overview'|'campaigns'|'influencers'|'calendar'|'analytics'>('overview')
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [influencers, setInfluencers] = useState<any[]>([])
  const [launches, setLaunches] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showAddCampaign, setShowAddCampaign] = useState(false)
  const [showAddInfluencer, setShowAddInfluencer] = useState(false)
  const [showAddLaunch, setShowAddLaunch] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null)
  const [selectedInfluencer, setSelectedInfluencer] = useState<any>(null)
  const [campaignForm, setCampaignForm] = useState({ name: '', platform: 'Meta Ads', status: 'Draft', budget: '', spend: '', leads: '0', roas: '0', objective: '', notes: '', start_date: '', end_date: '' })
  const [influencerForm, setInfluencerForm] = useState({ name: '', handle: '', followers: '', niche: 'Skincare', stage: 'Outreach Sent', platform: 'Instagram', email: '', phone: '', rate: '', notes: '' })
  const [launchForm, setLaunchForm] = useState({ label: '', date: '', color: 'var(--gold)', notes: '' })

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [campRes, infRes, launchRes] = await Promise.all([
        supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false }),
        supabase.from('marketing_influencers').select('*').order('created_at', { ascending: false }),
        supabase.from('marketing_launches').select('*').order('date'),
      ])
      setCampaigns(campRes.data || [])
      setInfluencers(infRes.data || [])
      setLaunches(launchRes.data || [])

      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (url) {
        const [ordRes, consRes] = await Promise.all([
          fetch(url + '/api/orders').then(r => r.ok ? r.json() : []),
          fetch(url + '/api/consultations').then(r => r.ok ? r.json() : []),
        ])
        setOrders(Array.isArray(ordRes) ? ordRes : [])
        setConsultations(Array.isArray(consRes) ? consRes : [])
      }
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  async function addCampaign() {
    if (!campaignForm.name) { toast.error('Name required'); return }
    const { error } = await supabase.from('marketing_campaigns').insert({
      name: campaignForm.name, platform: campaignForm.platform, status: campaignForm.status,
      budget: campaignForm.budget, spend: Number(campaignForm.spend) || 0,
      leads: Number(campaignForm.leads) || 0, roas: Number(campaignForm.roas) || 0,
      objective: campaignForm.objective, notes: campaignForm.notes,
      start_date: campaignForm.start_date || null, end_date: campaignForm.end_date || null
    })
    if (error) { toast.error(error.message); return }
    toast.success('Campaign added!')
    setShowAddCampaign(false)
    setCampaignForm({ name: '', platform: 'Meta Ads', status: 'Draft', budget: '', spend: '', leads: '0', roas: '0', objective: '', notes: '', start_date: '', end_date: '' })
    loadAll()
  }

  async function addInfluencer() {
    if (!influencerForm.name) { toast.error('Name required'); return }
    const { error } = await supabase.from('marketing_influencers').insert(influencerForm)
    if (error) { toast.error(error.message); return }
    toast.success('Influencer added!')
    setShowAddInfluencer(false)
    setInfluencerForm({ name: '', handle: '', followers: '', niche: 'Skincare', stage: 'Outreach Sent', platform: 'Instagram', email: '', phone: '', rate: '', notes: '' })
    loadAll()
  }

  async function addLaunch() {
    if (!launchForm.label || !launchForm.date) { toast.error('Label and date required'); return }
    const { error } = await supabase.from('marketing_launches').insert(launchForm)
    if (error) { toast.error(error.message); return }
    toast.success('Launch added!')
    setShowAddLaunch(false)
    setLaunchForm({ label: '', date: '', color: 'var(--gold)', notes: '' })
    loadAll()
  }

  async function updateCampaign(id: string, updates: any) {
    await supabase.from('marketing_campaigns').update(updates).eq('id', id)
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    if (selectedCampaign?.id === id) setSelectedCampaign((s: any) => ({ ...s, ...updates }))
    toast.success('Updated!')
  }

  async function updateInfluencer(id: string, updates: any) {
    await supabase.from('marketing_influencers').update(updates).eq('id', id)
    setInfluencers(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    if (selectedInfluencer?.id === id) setSelectedInfluencer((s: any) => ({ ...s, ...updates }))
    toast.success('Updated!')
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete?')) return
    await supabase.from('marketing_campaigns').delete().eq('id', id)
    setCampaigns(prev => prev.filter(c => c.id !== id))
    setSelectedCampaign(null)
    toast.success('Deleted!')
  }

  async function deleteInfluencer(id: string) {
    if (!confirm('Delete?')) return
    await supabase.from('marketing_influencers').delete().eq('id', id)
    setInfluencers(prev => prev.filter(i => i.id !== id))
    setSelectedInfluencer(null)
    toast.success('Deleted!')
  }

  async function deleteLaunch(id: string) {
    await supabase.from('marketing_launches').delete().eq('id', id)
    setLaunches(prev => prev.filter(l => l.id !== id))
    toast.success('Deleted!')
  }

  // Analytics
  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
  const totalLeads = campaigns.reduce((s, c) => s + (c.leads || 0), 0)
  const liveCampaigns = campaigns.filter(c => c.status === 'Live').length
  const avgROAS = campaigns.length > 0 ? (campaigns.reduce((s, c) => s + (c.roas || 0), 0) / campaigns.length).toFixed(1) : '0'
  const confirmedInfluencers = influencers.filter(i => i.stage === 'Confirmed ✅' || i.stage === 'Posted ✅').length
  const totalReach = influencers.filter(i => i.stage === 'Posted ✅').reduce((s, i) => {
    const f = parseInt((i.followers || '0').replace(/[^0-9]/g, ''))
    return s + (i.followers?.includes('K') ? f * 1000 : i.followers?.includes('M') ? f * 1000000 : f)
  }, 0)

  const platformCounts: Record<string, number> = {}
  campaigns.forEach(c => { platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1 })
  const nicheCounts: Record<string, number> = {}
  influencers.forEach(i => { nicheCounts[i.niche] = (nicheCounts[i.niche] || 0) + 1 })

  const upcomingLaunches = launches.filter(l => new Date(l.date) >= new Date()).slice(0, 8)
  const overdueLaunches = launches.filter(l => new Date(l.date) < new Date())

  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }
  const COLORS = ['var(--gold)', 'var(--blue)', 'var(--teal)', 'var(--purple)', 'var(--orange)', 'var(--green)', 'var(--red)']

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Marketing <span style={{ color: 'var(--gold)' }}>Center</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{liveCampaigns} live campaigns · {confirmedInfluencers} confirmed influencers · {upcomingLaunches.length} upcoming</p>
        </div>
        <button onClick={loadAll} style={{ padding: '8px 14px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[{id:'overview',l:'📊 Overview'},{id:'campaigns',l:'🎯 Campaigns'},{id:'influencers',l:'👥 Influencers'},{id:'calendar',l:'📅 Launch Calendar'},{id:'analytics',l:'📈 Analytics'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: tab === t.id ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: tab === t.id ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (tab === t.id ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total Spend', value: '₹' + totalSpend.toLocaleString('en-IN'), color: 'var(--red)' },
              { label: 'Total Leads', value: totalLeads.toLocaleString(), color: 'var(--blue)' },
              { label: 'Live Campaigns', value: liveCampaigns, color: 'var(--green)' },
              { label: 'Avg ROAS', value: avgROAS + 'x', color: 'var(--gold)' },
              { label: 'Influencers', value: influencers.length, color: 'var(--purple)' },
              { label: 'Influencer Reach', value: totalReach >= 1000000 ? (totalReach/1000000).toFixed(1)+'M' : totalReach >= 1000 ? (totalReach/1000).toFixed(0)+'K' : totalReach.toString(), color: 'var(--teal)' },
            ].map((s, i) => (
              <div key={i} className="card">
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {/* Live Campaigns */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Active Campaigns</div>
                <button onClick={() => setTab('campaigns')} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
              </div>
              {campaigns.filter(c => c.status === 'Live').slice(0, 5).map((c, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--b1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{c.name}</div>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: 'var(--grL)', color: 'var(--green)' }}>Live</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--mu)' }}>
                    <span>{c.platform}</span>
                    <span>₹{c.spend || 0} spent</span>
                    <span style={{ color: 'var(--green)' }}>ROAS: {c.roas || 0}x</span>
                  </div>
                </div>
              ))}
              {campaigns.filter(c => c.status === 'Live').length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20, fontSize: 12 }}>No live campaigns</div>}
            </div>

            {/* Influencer Pipeline */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Influencer Pipeline</div>
                <button onClick={() => setTab('influencers')} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
              </div>
              {influencers.slice(0, 5).map((inf, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,var(--purple),var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {(inf.name || 'I').charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inf.handle || inf.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--mu)' }}>{inf.followers} · {inf.niche}</div>
                  </div>
                  <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: inf.stage === 'Confirmed ✅' || inf.stage === 'Posted ✅' ? 'var(--grL)' : inf.stage === 'Negotiating' ? 'var(--orL)' : 'var(--blL)', color: inf.stage === 'Confirmed ✅' || inf.stage === 'Posted ✅' ? 'var(--green)' : inf.stage === 'Negotiating' ? 'var(--orange)' : 'var(--blue)', flexShrink: 0 }}>{inf.stage}</span>
                </div>
              ))}
              {influencers.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20, fontSize: 12 }}>No influencers added</div>}
            </div>

            {/* Launch Calendar */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Upcoming Launches</div>
                <button onClick={() => setTab('calendar')} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
              </div>
              {upcomingLaunches.slice(0, 6).map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color || 'var(--gold)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12.5 }}>{l.label}</span>
                  <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--mu)' }}>{new Date(l.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
              {upcomingLaunches.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20, fontSize: 12 }}>No upcoming launches</div>}
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGNS */}
      {tab === 'campaigns' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>Campaigns <span style={{ color: 'var(--mu)', fontSize: 13, fontWeight: 500 }}>({campaigns.length})</span></div>
            <button onClick={() => setShowAddCampaign(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>+ Add Campaign</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedCampaign ? '1fr 380px' : '1fr', gap: 16, alignItems: 'start' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Campaign','Platform','Status','Budget','Spend','Leads','ROAS','Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={i} onClick={() => setSelectedCampaign(selectedCampaign?.id === c.id ? null : c)} style={{ cursor: 'pointer', background: selectedCampaign?.id === c.id ? 'var(--gL)' : 'transparent' }} onMouseOver={e => { if (selectedCampaign?.id !== c.id) e.currentTarget.style.background = 'rgba(255,255,255,0.018)' }} onMouseOut={e => { if (selectedCampaign?.id !== c.id) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12.5 }}>{c.name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--mu)' }}>{c.platform}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <select value={c.status} onClick={e => e.stopPropagation()} onChange={e => updateCampaign(c.id, { status: e.target.value })} style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit', color: c.status === 'Live' ? 'var(--green)' : c.status === 'Paused' ? 'var(--orange)' : 'var(--mu)' }}>
                          {CAMPAIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--mu)' }}>{c.budget || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>₹{c.spend || 0}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--blue)' }}>{c.leads || 0}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: (c.roas || 0) >= 3 ? 'var(--green)' : (c.roas || 0) >= 1 ? 'var(--gold)' : 'var(--red)' }}>{c.roas || 0}x</td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={e => { e.stopPropagation(); deleteCampaign(c.id) }} style={{ padding: '3px 8px', background: 'var(--rdL)', border: 'none', borderRadius: 5, color: 'var(--red)', fontSize: 10.5, cursor: 'pointer' }}>Del</button>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No campaigns yet — add one!</td></tr>}
                </tbody>
              </table>
            </div>

            {selectedCampaign && (
              <div style={{ position: 'sticky', top: 20, background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>{selectedCampaign.name}</div>
                  <button onClick={() => setSelectedCampaign(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    { l: 'Platform', v: selectedCampaign.platform },
                    { l: 'Status', v: selectedCampaign.status },
                    { l: 'Budget', v: selectedCampaign.budget || '—' },
                    { l: 'Spend', v: '₹' + (selectedCampaign.spend || 0) },
                    { l: 'Leads', v: selectedCampaign.leads || 0 },
                    { l: 'ROAS', v: (selectedCampaign.roas || 0) + 'x' },
                    { l: 'Start', v: selectedCampaign.start_date ? new Date(selectedCampaign.start_date).toLocaleDateString('en-IN') : '—' },
                    { l: 'End', v: selectedCampaign.end_date ? new Date(selectedCampaign.end_date).toLocaleDateString('en-IN') : '—' },
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 11px' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>{item.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.v}</div>
                    </div>
                  ))}
                </div>
                {selectedCampaign.objective && (
                  <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 4 }}>Objective</div>
                    <div style={{ fontSize: 12.5, color: 'var(--mu2)' }}>{selectedCampaign.objective}</div>
                  </div>
                )}
                {selectedCampaign.notes && (
                  <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
                    <div style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{selectedCampaign.notes}</div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Update Spend</label>
                    <input type="number" defaultValue={selectedCampaign.spend || 0} onBlur={e => updateCampaign(selectedCampaign.id, { spend: Number(e.target.value) })} style={{ ...inp, marginBottom: 0 }} placeholder="₹0" />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Update Leads</label>
                    <input type="number" defaultValue={selectedCampaign.leads || 0} onBlur={e => updateCampaign(selectedCampaign.id, { leads: Number(e.target.value) })} style={{ ...inp, marginBottom: 0 }} placeholder="0" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INFLUENCERS */}
      {tab === 'influencers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>Influencer Pipeline <span style={{ color: 'var(--mu)', fontSize: 13, fontWeight: 500 }}>({influencers.length})</span></div>
            <button onClick={() => setShowAddInfluencer(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>+ Add Influencer</button>
          </div>

          {/* Stage Kanban */}
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {INFLUENCER_STAGES.map(stage => {
              const stageInfs = influencers.filter(i => i.stage === stage)
              return (
                <div key={stage} style={{ minWidth: 220, flexShrink: 0 }}>
                  <div style={{ padding: '8px 12px', borderRadius: '10px 10px 0 0', background: stage === 'Confirmed ✅' || stage === 'Posted ✅' ? 'var(--grL)' : stage === 'Negotiating' ? 'var(--orL)' : stage === 'Cancelled' ? 'var(--rdL)' : 'var(--blL)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: stage === 'Confirmed ✅' || stage === 'Posted ✅' ? 'var(--green)' : stage === 'Negotiating' ? 'var(--orange)' : stage === 'Cancelled' ? 'var(--red)' : 'var(--blue)' }}>{stage}</span>
                    <span style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--mu)' }}>{stageInfs.length}</span>
                  </div>
                  <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderTop: 'none', borderRadius: '0 0 10px 10px', minHeight: 200, padding: 8 }}>
                    {stageInfs.map((inf, i) => (
                      <div key={i} onClick={() => setSelectedInfluencer(selectedInfluencer?.id === inf.id ? null : inf)} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 10, padding: '11px 12px', marginBottom: 8, cursor: 'pointer' }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 3 }}>{inf.handle || inf.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 6 }}>{inf.followers} · {inf.niche}</div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <select value={inf.stage} onClick={e => e.stopPropagation()} onChange={e => updateInfluencer(inf.id, { stage: e.target.value })} style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 5, padding: '3px 6px', fontSize: 10, cursor: 'pointer', outline: 'none', color: 'var(--tx)', fontFamily: 'Outfit' }}>
                            {INFLUENCER_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          {inf.phone && <a href={'https://wa.me/' + inf.phone.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent('Hi ' + inf.name + '! Rabt Naturals ki taraf se collaboration ke baare mein baat karni thi 🌿')} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ padding: '3px 7px', background: 'var(--grL)', border: 'none', borderRadius: 5, color: 'var(--green)', fontSize: 10, cursor: 'pointer', textDecoration: 'none', fontWeight: 700 }}>WA</a>}
                        </div>
                      </div>
                    ))}
                    {stageInfs.length === 0 && <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--mu)', fontSize: 11 }}>Empty</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail Panel */}
          {selectedInfluencer && (
            <div style={{ marginTop: 16, background: 'var(--s1)', border: '1px solid var(--gold)', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>{selectedInfluencer.handle || selectedInfluencer.name}</div>
                <button onClick={() => setSelectedInfluencer(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { l: 'Followers', v: selectedInfluencer.followers || '—' },
                  { l: 'Niche', v: selectedInfluencer.niche },
                  { l: 'Platform', v: selectedInfluencer.platform || '—' },
                  { l: 'Rate', v: selectedInfluencer.rate ? '₹' + selectedInfluencer.rate : '—' },
                  { l: 'Email', v: selectedInfluencer.email || '—' },
                  { l: 'Phone', v: selectedInfluencer.phone || '—' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 11px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>{item.l}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{item.v}</div>
                  </div>
                ))}
              </div>
              {selectedInfluencer.notes && <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{selectedInfluencer.notes}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedInfluencer.phone && <a href={'https://wa.me/' + selectedInfluencer.phone.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent('Hi ' + selectedInfluencer.name + '! Rabt Naturals collaboration 🌿')} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: 9, background: 'linear-gradient(135deg,#25D366,#128C7E)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>💬 WhatsApp</a>}
                {selectedInfluencer.email && <a href={'mailto:' + selectedInfluencer.email + '?subject=Collaboration with Rabt Naturals&body=Hi ' + selectedInfluencer.name + '!'} style={{ flex: 1, padding: 9, background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: 'var(--blue)', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>📧 Email</a>}
                <button onClick={() => deleteInfluencer(selectedInfluencer.id)} style={{ padding: '9px 14px', background: 'var(--rdL)', border: 'none', borderRadius: 8, color: 'var(--red)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>Delete</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LAUNCH CALENDAR */}
      {tab === 'calendar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800 }}>Launch Calendar</div>
            <button onClick={() => setShowAddLaunch(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>+ Add Launch</button>
          </div>

          {overdueLaunches.length > 0 && (
            <div style={{ background: 'var(--orL)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 12.5, color: 'var(--orange)' }}>
              ⚠️ {overdueLaunches.length} overdue launches
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {launches.map((l, i) => {
              const isOverdue = new Date(l.date) < new Date()
              return (
                <div key={i} style={{ background: 'var(--s1)', border: '1px solid ' + (isOverdue ? 'rgba(239,68,68,0.2)' : 'var(--b1)'), borderLeft: '3px solid ' + (l.color || 'var(--gold)'), borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>{l.label}</div>
                    {l.notes && <div style={{ fontSize: 11.5, color: 'var(--mu2)', marginBottom: 6 }}>{l.notes}</div>}
                    <div style={{ fontSize: 11.5, color: isOverdue ? 'var(--red)' : 'var(--mu)', fontFamily: 'DM Mono' }}>
                      {isOverdue ? '⚠️ Overdue · ' : '📅 '}{new Date(l.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                  <button onClick={() => deleteLaunch(l.id)} style={{ padding: '5px 9px', background: 'var(--rdL)', border: 'none', borderRadius: 6, color: 'var(--red)', fontSize: 10.5, cursor: 'pointer' }}>✕</button>
                </div>
              )
            })}
            {launches.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--mu)', background: 'var(--s1)', borderRadius: 12, border: '1px solid var(--b1)' }}>No launches planned yet</div>}
          </div>
        </div>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Campaign ROAS */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Campaign ROAS</div>
              {campaigns.filter(c => c.roas > 0).sort((a,b) => b.roas - a.roas).map((c, i) => {
                const maxRoas = Math.max(...campaigns.map(x => x.roas || 0), 1)
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{c.name}</span>
                      <span style={{ fontFamily: 'DM Mono', color: c.roas >= 3 ? 'var(--green)' : c.roas >= 1 ? 'var(--gold)' : 'var(--red)' }}>{c.roas}x</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(c.roas/maxRoas*100)+'%', background: c.roas >= 3 ? 'var(--green)' : c.roas >= 1 ? 'var(--gold)' : 'var(--red)', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
              {campaigns.filter(c => c.roas > 0).length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No ROAS data yet</div>}
            </div>

            {/* Spend by Platform */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Spend by Platform</div>
              {(() => {
                const spendByPlatform: Record<string, number> = {}
                campaigns.forEach(c => { spendByPlatform[c.platform] = (spendByPlatform[c.platform] || 0) + (c.spend || 0) })
                const maxSpend = Math.max(...Object.values(spendByPlatform), 1)
                return Object.entries(spendByPlatform).sort((a,b) => b[1]-a[1]).map(([platform, spend], i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{platform}</span>
                      <span style={{ fontFamily: 'DM Mono', color: 'var(--red)' }}>₹{spend.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(spend/maxSpend*100)+'%', background: COLORS[i % COLORS.length], borderRadius: 4 }} />
                    </div>
                  </div>
                ))
              })()}
              {campaigns.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No data yet</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Influencer Stage Breakdown */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Influencer Funnel</div>
              {INFLUENCER_STAGES.filter(s => influencers.some(i => i.stage === s)).map((stage, idx) => {
                const count = influencers.filter(i => i.stage === stage).length
                const maxCount = Math.max(...INFLUENCER_STAGES.map(s => influencers.filter(i => i.stage === s).length), 1)
                return (
                  <div key={stage} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{stage}</span>
                      <span style={{ fontFamily: 'DM Mono', color: 'var(--teal)' }}>{count}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(count/maxCount*100)+'%', background: COLORS[idx % COLORS.length], borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
              {influencers.length === 0 && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>No influencers yet</div>}
            </div>

            {/* Summary Stats */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Marketing Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Total Campaigns', value: campaigns.length, color: 'var(--blue)' },
                  { label: 'Live Now', value: liveCampaigns, color: 'var(--green)' },
                  { label: 'Total Spend', value: '₹' + totalSpend.toLocaleString('en-IN'), color: 'var(--red)' },
                  { label: 'Total Leads', value: totalLeads, color: 'var(--teal)' },
                  { label: 'Avg ROAS', value: avgROAS + 'x', color: 'var(--gold)' },
                  { label: 'Influencers', value: influencers.length, color: 'var(--purple)' },
                  { label: 'Confirmed', value: confirmedInfluencers, color: 'var(--green)' },
                  { label: 'Launches Planned', value: upcomingLaunches.length, color: 'var(--orange)' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD CAMPAIGN MODAL */}
      {showAddCampaign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Campaign</div>
            {[{k:'name',l:'Campaign Name*',p:'Spring Glow Sale'},{k:'budget',l:'Daily Budget',p:'₹500/day'},{k:'objective',l:'Objective',p:'Lead Generation, Sales...'},{k:'notes',l:'Notes',p:'Campaign details...'}].map(f => (
              <div key={f.k}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label><input value={(campaignForm as any)[f.k]} onChange={e => setCampaignForm(p => ({...p, [f.k]: e.target.value}))} placeholder={f.p} style={inp} /></div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{k:'platform',l:'Platform',opts:CAMPAIGN_PLATFORMS},{k:'status',l:'Status',opts:CAMPAIGN_STATUSES}].map(f => (
                <div key={f.k}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label><select value={(campaignForm as any)[f.k]} onChange={e => setCampaignForm(p => ({...p, [f.k]: e.target.value}))} style={inp}>{f.opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              ))}
              {[{k:'spend',l:'Spend (₹)',p:'0'},{k:'leads',l:'Leads',p:'0'},{k:'roas',l:'ROAS',p:'0'},{k:'start_date',l:'Start Date',p:''},{k:'end_date',l:'End Date',p:''}].map(f => (
                <div key={f.k}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label><input type={f.k.includes('date') ? 'date' : 'number'} value={(campaignForm as any)[f.k]} onChange={e => setCampaignForm(p => ({...p, [f.k]: e.target.value}))} placeholder={f.p} style={inp} /></div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
              <button onClick={() => setShowAddCampaign(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addCampaign} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Campaign</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD INFLUENCER MODAL */}
      {showAddInfluencer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 500, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Influencer</div>
            {[{k:'name',l:'Full Name*',p:'Priya Sharma'},{k:'handle',l:'Handle',p:'@skincarewithpriya'},{k:'followers',l:'Followers',p:'48K'},{k:'email',l:'Email',p:'priya@gmail.com'},{k:'phone',l:'Phone',p:'+91 9876543210'},{k:'rate',l:'Rate (₹)',p:'5000'},{k:'notes',l:'Notes',p:'Previously worked with xyz brand...'}].map(f => (
              <div key={f.k}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label><input value={(influencerForm as any)[f.k]} onChange={e => setInfluencerForm(p => ({...p, [f.k]: e.target.value}))} placeholder={f.p} style={inp} /></div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[{k:'niche',l:'Niche',opts:NICHES},{k:'stage',l:'Stage',opts:INFLUENCER_STAGES},{k:'platform',l:'Platform',opts:['Instagram','YouTube','TikTok','Twitter','Facebook']}].map(f => (
                <div key={f.k}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label><select value={(influencerForm as any)[f.k]} onChange={e => setInfluencerForm(p => ({...p, [f.k]: e.target.value}))} style={inp}>{f.opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAddInfluencer(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addInfluencer} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Influencer</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LAUNCH MODAL */}
      {showAddLaunch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 440, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Launch</div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Label*</label>
            <input value={launchForm.label} onChange={e => setLaunchForm(p => ({...p, label: e.target.value}))} placeholder="Reel #1 Go Live" style={inp} />
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Date*</label>
            <input type="date" value={launchForm.date} onChange={e => setLaunchForm(p => ({...p, date: e.target.value}))} style={inp} />
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Color</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {COLORS.map((c, i) => (
                <div key={i} onClick={() => setLaunchForm(p => ({...p, color: c}))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: launchForm.color === c ? '3px solid var(--tx)' : '2px solid transparent' }} />
              ))}
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Notes</label>
            <input value={launchForm.notes} onChange={e => setLaunchForm(p => ({...p, notes: e.target.value}))} placeholder="Details..." style={inp} />
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAddLaunch(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addLaunch} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Launch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
