'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─── TYPES ────────────────────────────────────────────────
interface MetaCredentials { appId: string; appSecret: string; adAccountId: string; accessToken: string }
interface GoogleCredentials { customerId: string; developerToken: string; clientId: string; clientSecret: string; refreshToken: string }
interface AdCampaign { id: string; name: string; status: string; spend: number; impressions: number; clicks: number; conversions: number; ctr: number; cpc: number; roas: number; platform: 'meta' | 'google' }

export default function AdsManagerPage() {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'overview'|'meta'|'google'|'settings'>('overview')
  const [metaCreds, setMetaCreds] = useState<MetaCredentials>({ appId: '', appSecret: '', adAccountId: '', accessToken: '' })
  const [googleCreds, setGoogleCreds] = useState<GoogleCredentials>({ customerId: '', developerToken: '', clientId: '', clientSecret: '', refreshToken: '' })
  const [metaConnected, setMetaConnected] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [metaData, setMetaData] = useState<any>(null)
  const [googleData, setGoogleData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [dateRange, setDateRange] = useState('last_7d')
  const [savingCreds, setSavingCreds] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadSavedCreds()
  }, [])

  async function loadSavedCreds() {
    try {
      const { data } = await supabase.from('app_settings').select('*').eq('key', 'ads_credentials').single()
      if (data?.value) {
        const creds = JSON.parse(data.value)
        if (creds.meta) { setMetaCreds(creds.meta); if (creds.meta.accessToken) setMetaConnected(true) }
        if (creds.google) { setGoogleCreds(creds.google); if (creds.google.refreshToken) setGoogleConnected(true) }
      }
    } catch {}
  }

  async function saveCreds() {
    setSavingCreds(true)
    try {
      const val = JSON.stringify({ meta: metaCreds, google: googleCreds })
      await supabase.from('app_settings').upsert({ key: 'ads_credentials', value: val })
      if (metaCreds.accessToken) setMetaConnected(true)
      if (googleCreds.refreshToken) setGoogleConnected(true)
      toast.success('Credentials saved!')
    } catch { toast.error('Failed to save') }
    setSavingCreds(false)
  }

  // Meta Ads API
  async function fetchMetaData() {
    if (!metaCreds.accessToken || !metaCreds.adAccountId) { toast.error('Meta credentials missing'); setTab('settings'); return }
    setMetaLoading(true)
    try {
      const since = getDateSince(dateRange)
      const until = new Date().toISOString().split('T')[0]
      const accId = metaCreds.adAccountId.startsWith('act_') ? metaCreds.adAccountId : 'act_' + metaCreds.adAccountId
      
      // Fetch account insights
      const insightsUrl = `https://graph.facebook.com/v19.0/${accId}/insights?fields=spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type&time_range={"since":"${since}","until":"${until}"}&access_token=${metaCreds.accessToken}`
      const insRes = await fetch(insightsUrl)
      const insData = await insRes.json()

      // Fetch campaigns
      const campUrl = `https://graph.facebook.com/v19.0/${accId}/campaigns?fields=id,name,status,objective,insights{spend,impressions,clicks,ctr,cpc,actions}&access_token=${metaCreds.accessToken}&limit=20`
      const campRes = await fetch(campUrl)
      const campData = await campRes.json()

      if (insData.error) { toast.error('Meta API: ' + insData.error.message); setMetaLoading(false); return }
      setMetaData({ insights: insData.data?.[0] || {}, campaigns: campData.data || [] })
      setMetaConnected(true)
      toast.success('Meta data fetched!')
    } catch (e: any) { toast.error('Meta fetch error: ' + e.message) }
    setMetaLoading(false)
  }

  // Google Ads API
  async function fetchGoogleData() {
    if (!googleCreds.customerId || !googleCreds.developerToken) { toast.error('Google credentials missing'); setTab('settings'); return }
    setGoogleLoading(true)
    try {
      // Google Ads uses gRPC/REST API — proxy through server-side if needed
      // For now we show instructions + sample structure
      toast.error('Google Ads needs server-side proxy — see setup guide in Settings')
    } catch (e: any) { toast.error('Google error: ' + e.message) }
    setGoogleLoading(false)
  }

  function getDateSince(range: string) {
    const d = new Date()
    if (range === 'today') return d.toISOString().split('T')[0]
    if (range === 'last_7d') { d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0] }
    if (range === 'last_14d') { d.setDate(d.getDate() - 14); return d.toISOString().split('T')[0] }
    if (range === 'last_30d') { d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] }
    if (range === 'last_90d') { d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0] }
    return d.toISOString().split('T')[0]
  }

  function getMetaConversions(insights: any) {
    const actions = insights?.actions || []
    const conv = actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
    return conv ? Number(conv.value) : 0
  }

  function getMetaRevenue(insights: any) {
    const actions = insights?.action_values || []
    const rev = actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
    return rev ? Number(rev.value) : 0
  }

  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  if (!mounted) return null

  const metaIns = metaData?.insights || {}
  const metaSpend = Number(metaIns.spend || 0)
  const metaImpressions = Number(metaIns.impressions || 0)
  const metaClicks = Number(metaIns.clicks || 0)
  const metaCTR = Number(metaIns.ctr || 0)
  const metaCPC = Number(metaIns.cpc || 0)
  const metaConversions = getMetaConversions(metaIns)
  const metaRevenue = getMetaRevenue(metaIns)
  const metaROAS = metaSpend > 0 ? (metaRevenue / metaSpend).toFixed(2) : '—'
  const metaCampaigns: any[] = metaData?.campaigns || []

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Ads <span style={{ color: 'var(--gold)' }}>Manager</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {metaConnected ? <span style={{ color: 'var(--blue)' }}>📘 Meta Connected</span> : <span style={{ color: 'var(--mu)' }}>📘 Meta Not Connected</span>}
            {' · '}
            {googleConnected ? <span style={{ color: 'var(--green)' }}>🎯 Google Connected</span> : <span style={{ color: 'var(--mu)' }}>🎯 Google Not Connected</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ ...inp, marginBottom: 0, width: 'auto' }}>
            {[{v:'today',l:'Today'},{v:'last_7d',l:'Last 7 Days'},{v:'last_14d',l:'Last 14 Days'},{v:'last_30d',l:'Last 30 Days'},{v:'last_90d',l:'Last 90 Days'}].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <button onClick={() => { fetchMetaData(); if (googleConnected) fetchGoogleData() }} disabled={metaLoading || googleLoading} style={{ padding: '8px 16px', background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: 'var(--blue)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
            {metaLoading || googleLoading ? 'Loading...' : 'Refresh Data'}
          </button>
          <button onClick={() => setTab('settings')} style={{ padding: '8px 14px', background: tab === 'settings' ? 'var(--gL)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (tab === 'settings' ? 'rgba(212,168,83,0.3)' : 'var(--b1)'), borderRadius: 8, color: tab === 'settings' ? 'var(--gold)' : 'var(--mu)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>⚙️ Settings</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[{id:'overview',l:'📊 Overview'},{id:'meta',l:'📘 Meta Ads'},{id:'google',l:'🎯 Google Ads'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: tab === t.id ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: tab === t.id ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (tab === t.id ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* SETTINGS TAB */}
      {tab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Meta Ads */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, background: '#1877F2', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>f</div>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Meta Ads</div>
                <div style={{ fontSize: 11, color: metaConnected ? 'var(--green)' : 'var(--mu)' }}>{metaConnected ? '✓ Connected' : 'Not connected'}</div>
              </div>
            </div>
            {[
              { k: 'appId', l: 'App ID', p: '1234567890' },
              { k: 'appSecret', l: 'App Secret', p: 'abc123...' },
              { k: 'adAccountId', l: 'Ad Account ID', p: 'act_1234567890' },
              { k: 'accessToken', l: 'Access Token', p: 'EAABxxxxxx...' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                <input value={(metaCreds as any)[f.k]} onChange={e => setMetaCreds(p => ({...p, [f.k]: e.target.value}))} placeholder={f.p} type={f.k.includes('Secret') || f.k.includes('Token') ? 'password' : 'text'} style={inp} />
              </div>
            ))}
            <div style={{ background: 'var(--blL)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11.5, color: 'var(--blue)', lineHeight: 1.6 }}>
              📋 <strong>Setup steps:</strong><br/>
              1. Go to developers.facebook.com<br/>
              2. Create App → Business type<br/>
              3. Add Marketing API product<br/>
              4. Generate long-lived Access Token<br/>
              5. Add your Ad Account ID from Meta Ads Manager
            </div>
            <button onClick={() => { saveCreds(); fetchMetaData() }} style={{ width: '100%', padding: 10, background: 'linear-gradient(135deg,#1877F2,#0d5cbf)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
              Save & Connect Meta
            </button>
          </div>

          {/* Google Ads */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#4285F4,#EA4335)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>G</div>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Google Ads</div>
                <div style={{ fontSize: 11, color: googleConnected ? 'var(--green)' : 'var(--mu)' }}>{googleConnected ? '✓ Connected' : 'Not connected'}</div>
              </div>
            </div>
            {[
              { k: 'customerId', l: 'Customer ID', p: '123-456-7890' },
              { k: 'developerToken', l: 'Developer Token', p: 'ABcd_EF...' },
              { k: 'clientId', l: 'OAuth Client ID', p: 'xxxxx.apps.googleusercontent.com' },
              { k: 'clientSecret', l: 'OAuth Client Secret', p: 'GOCSPX-...' },
              { k: 'refreshToken', l: 'Refresh Token', p: '1//0...' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                <input value={(googleCreds as any)[f.k]} onChange={e => setGoogleCreds(p => ({...p, [f.k]: e.target.value}))} placeholder={f.p} type={f.k.includes('Secret') || f.k.includes('Token') ? 'password' : 'text'} style={inp} />
              </div>
            ))}
            <div style={{ background: 'rgba(66,133,244,0.1)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11.5, color: '#4285F4', lineHeight: 1.6 }}>
              📋 <strong>Setup steps:</strong><br/>
              1. Go to Google Cloud Console<br/>
              2. Enable Google Ads API<br/>
              3. Create OAuth 2.0 credentials<br/>
              4. Get Developer Token from Google Ads<br/>
              5. Generate Refresh Token via OAuth flow<br/>
              ⚠️ Google Ads API needs server-side proxy (add to server.js)
            </div>
            <button onClick={saveCreds} disabled={savingCreds} style={{ width: '100%', padding: 10, background: 'linear-gradient(135deg,#4285F4,#EA4335)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
              {savingCreds ? 'Saving...' : 'Save Google Credentials'}
            </button>
          </div>

          {/* Server.js Google Ads code */}
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 12, color: 'var(--gold)' }}>📦 Add to server.js — Google Ads Proxy</div>
            <div style={{ background: '#0d1117', borderRadius: 10, padding: '16px', fontSize: 12, fontFamily: 'DM Mono', color: '#e6edf3', lineHeight: 1.8, overflowX: 'auto' }}>
              <span style={{ color: '#8b949e' }}>// Add this route to your server.js</span><br/>
              <span style={{ color: '#ff7b72' }}>app</span><span style={{ color: '#e6edf3' }}>.get(</span><span style={{ color: '#a5d6ff' }}>'/api/google-ads'</span><span style={{ color: '#e6edf3' }}>, async (req, res) {`=>`} {`{`}</span><br/>
              &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>const</span> {`{ customerId, devToken, clientId, clientSecret, refreshToken } = req.query`}<br/>
              &nbsp;&nbsp;<span style={{ color: '#8b949e' }}>// Get access token</span><br/>
              &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>const</span> tokenRes = await fetch(<span style={{ color: '#a5d6ff' }}>'https://oauth2.googleapis.com/token'</span>, {`{`}<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;method: <span style={{ color: '#a5d6ff' }}>'POST'</span>, headers: {`{ 'Content-Type': 'application/json' }`},<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;body: JSON.stringify({`{ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }`})<br/>
              &nbsp;&nbsp;{`}`})<br/>
              &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>const</span> {`{ access_token }`} = await tokenRes.json()<br/>
              &nbsp;&nbsp;<span style={{ color: '#8b949e' }}>// Query Google Ads API</span><br/>
              &nbsp;&nbsp;<span style={{ color: '#ff7b72' }}>const</span> adsRes = await fetch(`https://googleads.googleapis.com/v16/customers/<span style={{ color: '#a5d6ff' }}>${`{customerId}`}</span>/googleAds:search`, {`{`}<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;method: <span style={{ color: '#a5d6ff' }}>'POST'</span>,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;headers: {`{ Authorization: 'Bearer ' + access_token, 'developer-token': devToken }`},<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;body: JSON.stringify({`{ query: "SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign ORDER BY metrics.impressions DESC LIMIT 20" }`})<br/>
              &nbsp;&nbsp;{`}`})<br/>
              &nbsp;&nbsp;res.json(await adsRes.json())<br/>
              {`})`}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(`app.get('/api/google-ads', async (req, res) => {\n  const { customerId, devToken, clientId, clientSecret, refreshToken } = req.query\n  const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) })\n  const { access_token } = await tokenRes.json()\n  const adsRes = await fetch(\`https://googleads.googleapis.com/v16/customers/\${customerId}/googleAds:search\`, { method: 'POST', headers: { Authorization: 'Bearer ' + access_token, 'developer-token': devToken }, body: JSON.stringify({ query: "SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign ORDER BY metrics.impressions DESC LIMIT 20" }) })\n  res.json(await adsRes.json())\n})`); toast.success('Code copied!') }} style={{ marginTop: 10, padding: '7px 14px', background: 'var(--gL)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 7, color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
              📋 Copy Code
            </button>
          </div>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div>
          {!metaConnected && !googleConnected ? (
            <div style={{ background: 'var(--s1)', border: '1px dashed var(--b2)', borderRadius: 14, padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>No Ads Connected</div>
              <div style={{ color: 'var(--mu)', fontSize: 13, marginBottom: 20 }}>Settings mein Meta ya Google Ads credentials add karo</div>
              <button onClick={() => setTab('settings')} style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 9, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>⚙️ Setup Credentials</button>
            </div>
          ) : (
            <>
              {/* Combined Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Total Spend', value: '₹' + (metaSpend).toLocaleString('en-IN', {maximumFractionDigits:0}), color: 'var(--red)', sub: 'Meta + Google' },
                  { label: 'Impressions', value: metaImpressions >= 1000 ? (metaImpressions/1000).toFixed(1) + 'K' : metaImpressions.toString(), color: 'var(--blue)', sub: 'Total views' },
                  { label: 'Clicks', value: metaClicks.toLocaleString(), color: 'var(--teal)', sub: 'Total clicks' },
                  { label: 'CTR', value: metaCTR.toFixed(2) + '%', color: 'var(--gold)', sub: 'Click rate' },
                  { label: 'Conversions', value: metaConversions.toString(), color: 'var(--green)', sub: 'Purchases' },
                  { label: 'ROAS', value: metaROAS + 'x', color: 'var(--purple)', sub: 'Return on ad spend' },
                ].map((s, i) => (
                  <div key={i} className="card">
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color, marginBottom: 3 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--mu)' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Platform breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div className="card" style={{ cursor: 'pointer', border: '1px solid ' + (metaConnected ? 'rgba(24,119,242,0.3)' : 'var(--b1)') }} onClick={() => setTab('meta')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, background: '#1877F2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>f</div>
                    <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Meta Ads</div>
                    <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: metaConnected ? 'var(--blL)' : 'var(--s2)', color: metaConnected ? '#1877F2' : 'var(--mu)' }}>{metaConnected ? 'Connected' : 'Not connected'}</span>
                  </div>
                  {metaConnected && metaData ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      {[
                        { l: 'Spend', v: '₹' + metaSpend.toFixed(0), c: 'var(--red)' },
                        { l: 'Clicks', v: metaClicks.toLocaleString(), c: 'var(--teal)' },
                        { l: 'CTR', v: metaCTR.toFixed(2) + '%', c: 'var(--gold)' },
                      ].map((s, i) => (
                        <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                          <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                          <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); fetchMetaData() }} disabled={metaLoading} style={{ width: '100%', padding: 10, background: '#1877F2', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                      {metaLoading ? 'Loading...' : metaConnected ? 'Fetch Meta Data' : 'Connect Meta Ads →'}
                    </button>
                  )}
                </div>

                <div className="card" style={{ cursor: 'pointer', border: '1px solid ' + (googleConnected ? 'rgba(66,133,244,0.3)' : 'var(--b1)') }} onClick={() => setTab('google')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#4285F4,#EA4335)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>G</div>
                    <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Google Ads</div>
                    <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: googleConnected ? 'rgba(66,133,244,0.15)' : 'var(--s2)', color: googleConnected ? '#4285F4' : 'var(--mu)' }}>{googleConnected ? 'Connected' : 'Not connected'}</span>
                  </div>
                  {googleConnected && googleData ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      <div style={{ background: 'var(--s2)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: 'var(--red)' }}>—</div>
                        <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>Spend</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: 'var(--mu)', lineHeight: 1.6 }}>
                      {googleConnected ? 'Add proxy route to server.js to fetch Google Ads data. See Settings → setup guide.' : 'Connect Google Ads in Settings →'}
                    </div>
                  )}
                </div>
              </div>

              {/* Meta Campaigns preview */}
              {metaCampaigns.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Top Campaigns</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Campaign','Platform','Status','Spend','Impressions','Clicks','CTR'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {metaCampaigns.slice(0, 8).map((c: any, i: number) => {
                        const ins = c.insights?.data?.[0] || {}
                        return (
                          <tr key={i} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.018)'} onMouseOut={e => e.currentTarget.style.background=''}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12.5 }}>{c.name}</td>
                            <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(24,119,242,0.15)', color: '#1877F2', fontWeight: 700 }}>Meta</span></td>
                            <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: c.status === 'ACTIVE' ? 'var(--grL)' : 'var(--s2)', color: c.status === 'ACTIVE' ? 'var(--green)' : 'var(--mu)', textTransform: 'capitalize' }}>{c.status?.toLowerCase()}</span></td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--red)' }}>₹{Number(ins.spend || 0).toFixed(0)}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12 }}>{Number(ins.impressions || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--teal)' }}>{Number(ins.clicks || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--gold)' }}>{Number(ins.ctr || 0).toFixed(2)}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* META ADS TAB */}
      {tab === 'meta' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={fetchMetaData} disabled={metaLoading} style={{ padding: '9px 18px', background: '#1877F2', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
              {metaLoading ? 'Loading...' : '📘 Fetch Meta Data'}
            </button>
            {!metaConnected && <span style={{ fontSize: 12.5, color: 'var(--orange)', alignSelf: 'center' }}>⚠️ Add credentials in Settings first</span>}
          </div>

          {!metaData ? (
            <div style={{ background: 'var(--s1)', border: '1px dashed var(--b2)', borderRadius: 14, padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>📘</div>
              <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Meta Ads Data</div>
              <div style={{ color: 'var(--mu)', fontSize: 13 }}>"Fetch Meta Data" button click karo ya Settings mein credentials add karo</div>
            </div>
          ) : (
            <>
              {/* Meta Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Spend', value: '₹' + metaSpend.toFixed(0), color: 'var(--red)' },
                  { label: 'Impressions', value: metaImpressions >= 1000 ? (metaImpressions/1000).toFixed(1)+'K' : metaImpressions.toString(), color: 'var(--blue)' },
                  { label: 'Clicks', value: metaClicks.toLocaleString(), color: 'var(--teal)' },
                  { label: 'CTR', value: metaCTR.toFixed(2) + '%', color: 'var(--gold)' },
                  { label: 'CPC', value: '₹' + metaCPC.toFixed(2), color: 'var(--orange)' },
                  { label: 'Conversions', value: metaConversions.toString(), color: 'var(--green)' },
                ].map((s, i) => (
                  <div key={i} className="card">
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Campaigns Table */}
              {metaCampaigns.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--b1)', fontFamily: 'Syne', fontSize: 13, fontWeight: 800 }}>Campaigns ({metaCampaigns.length})</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Campaign','Objective','Status','Spend','Impressions','Clicks','CTR','CPC'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {metaCampaigns.map((c: any, i: number) => {
                        const ins = c.insights?.data?.[0] || {}
                        return (
                          <tr key={i} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.018)'} onMouseOut={e => e.currentTarget.style.background=''}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12.5, maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div></td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--mu)' }}>{c.objective?.replace(/_/g,' ').toLowerCase()}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: c.status === 'ACTIVE' ? 'var(--grL)' : c.status === 'PAUSED' ? 'var(--orL)' : 'var(--s2)', color: c.status === 'ACTIVE' ? 'var(--green)' : c.status === 'PAUSED' ? 'var(--orange)' : 'var(--mu)', textTransform: 'capitalize' }}>
                                {c.status?.toLowerCase()}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>₹{Number(ins.spend || 0).toFixed(0)}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12 }}>{Number(ins.impressions || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--teal)' }}>{Number(ins.clicks || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--gold)' }}>{Number(ins.ctr || 0).toFixed(2)}%</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--orange)' }}>₹{Number(ins.cpc || 0).toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Analytics bars */}
              {metaCampaigns.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                  <div className="card">
                    <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Spend by Campaign</div>
                    {metaCampaigns.slice(0,6).map((c: any, i: number) => {
                      const ins = c.insights?.data?.[0] || {}
                      const spend = Number(ins.spend || 0)
                      const maxSpend = Math.max(...metaCampaigns.map((x: any) => Number(x.insights?.data?.[0]?.spend || 0)), 1)
                      return (
                        <div key={i} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%', fontWeight: 600 }}>{c.name}</span>
                            <span style={{ fontFamily: 'DM Mono', color: 'var(--red)' }}>₹{spend.toFixed(0)}</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: Math.round(spend/maxSpend*100)+'%', background: '#1877F2', borderRadius: 4 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="card">
                    <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>CTR by Campaign</div>
                    {metaCampaigns.slice(0,6).map((c: any, i: number) => {
                      const ins = c.insights?.data?.[0] || {}
                      const ctr = Number(ins.ctr || 0)
                      const maxCtr = Math.max(...metaCampaigns.map((x: any) => Number(x.insights?.data?.[0]?.ctr || 0)), 1)
                      return (
                        <div key={i} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%', fontWeight: 600 }}>{c.name}</span>
                            <span style={{ fontFamily: 'DM Mono', color: 'var(--gold)' }}>{ctr.toFixed(2)}%</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: Math.round(ctr/maxCtr*100)+'%', background: 'var(--gold)', borderRadius: 4 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* GOOGLE ADS TAB */}
      {tab === 'google' && (
        <div>
          <div style={{ background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.25)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, color: '#4285F4', marginBottom: 10 }}>🎯 Google Ads Setup</div>
            <div style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.8 }}>
              Google Ads API requires server-side authentication due to OAuth2 security restrictions.
              <br/><strong style={{ color: 'var(--tx)' }}>Steps:</strong>
              <br/>1. Add credentials in Settings tab
              <br/>2. Copy the proxy code → add to your <strong>server.js</strong>
              <br/>3. Deploy to Render (auto-deploy from GitHub)
              <br/>4. Click "Fetch Google Data" below
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setTab('settings')} style={{ padding: '9px 18px', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--tx)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>⚙️ Settings → Copy Code</button>
            <button onClick={fetchGoogleData} disabled={googleLoading} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#4285F4,#EA4335)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
              {googleLoading ? 'Loading...' : '🎯 Fetch Google Data'}
            </button>
          </div>

          <div style={{ background: 'var(--s1)', border: '1px dashed var(--b2)', borderRadius: 14, padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🎯</div>
            <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Google Ads Data</div>
            <div style={{ color: 'var(--mu)', fontSize: 13, maxWidth: 400, margin: '0 auto' }}>
              Server-side proxy setup karke "Fetch Google Data" click karo. Data yahan dikhega — same format Meta Ads jaise.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
