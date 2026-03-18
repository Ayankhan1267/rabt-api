'use client'
import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'

const DATE_RANGES = [
  { label: 'Today', value: 'today', start: 'today' },
  { label: '7 Days', value: '7d', start: '7daysAgo' },
  { label: '30 Days', value: '30d', start: '30daysAgo' },
  { label: '90 Days', value: '90d', start: '90daysAgo' },
]
const SOURCE_COLORS: Record<string, string> = {
  google: 'var(--blue)', instagram: 'var(--orange)', facebook: 'var(--blue)',
  direct: 'var(--teal)', whatsapp: 'var(--green)', youtube: 'var(--red)',
  '(direct)': 'var(--teal)', organic: 'var(--green)',
}
const ACTION_META: Record<string, { label: string; color: string; emoji: string }> = {
  browsing:        { label: 'Browsing',        color: 'var(--mu)',    emoji: '👁️' },
  viewing_product: { label: 'Viewing Product', color: 'var(--blue)',  emoji: '🧴' },
  added_to_cart:   { label: 'Added to Cart',   color: 'var(--teal)',  emoji: '🛒' },
  skin_analysis:   { label: 'Skin Analysis',   color: 'var(--gold)',  emoji: '🔬' },
  know_your_skin:  { label: 'Know Your Skin',  color: 'var(--purple)','emoji': '🧬' },
  checkout:        { label: 'Checking Out',    color: 'var(--green)', emoji: '💳' },
  consultation:    { label: 'Consultation',    color: 'var(--orange)','emoji': '👩‍⚕️' },
}
function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60)
  return `${m}m ${s}s`
}

export default function WebsiteAnalyticsPage() {
  const [overview, setOverview]     = useState<any>(null)
  const [sources, setSources]       = useState<any[]>([])
  const [states, setStates]         = useState<any[]>([])
  const [pages, setPages]           = useState<any[]>([])
  const [daily, setDaily]           = useState<any[]>([])
  const [carts, setCarts]           = useState<any[]>([])
  const [orders, setOrders]         = useState<any[]>([])
  const [live, setLive]             = useState<any>({ count: 0, visitors: [], byAction: {} })
  const [trackStats, setTrackStats] = useState<any>(null)
  const [gaConfigured, setGaConfigured] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [liveLoading, setLiveLoading] = useState(false)
  const [tab, setTab]               = useState<'live'|'overview'|'traffic'|'geo'|'pages'|'carts'>('live')
  const [dateRange, setDateRange]   = useState('30d')
  const [mounted, setMounted]       = useState(false)
  const liveInterval = useRef<any>(null)

  useEffect(() => {
    setMounted(true)
    loadAll()
    fetchLive()
    liveInterval.current = setInterval(fetchLive, 15000) // refresh every 15s
    return () => clearInterval(liveInterval.current)
  }, [])

  async function fetchLive() {
    const url = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null
    if (!url) return
    try {
      setLiveLoading(true)
      const [lvRes, trRes] = await Promise.allSettled([
        fetch(`${url}/api/live/visitors`).then(r => r.json()),
        fetch(`${url}/api/tracking/stats`).then(r => r.json()),
      ])
      if (lvRes.status === 'fulfilled' && lvRes.value?.count !== undefined) setLive(lvRes.value)
      if (trRes.status === 'fulfilled' && !trRes.value?.error) setTrackStats(trRes.value)
    } catch {}
    setLiveLoading(false)
  }

  async function loadAll(range = dateRange) {
    setLoading(true)
    const url = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null
    const startDate = DATE_RANGES.find(d => d.value === range)?.start || '30daysAgo'
    try {
      if (url) {
        const [ovRes, srcRes, stRes, pgRes, dyRes, cartRes, ordRes] = await Promise.allSettled([
          fetch(`${url}/api/ga/overview?startDate=${startDate}&endDate=today`).then(r => r.json()),
          fetch(`${url}/api/ga/sources?startDate=${startDate}&endDate=today`).then(r => r.json()),
          fetch(`${url}/api/ga/states?startDate=${startDate}&endDate=today`).then(r => r.json()),
          fetch(`${url}/api/ga/pages?startDate=${startDate}&endDate=today`).then(r => r.json()),
          fetch(`${url}/api/ga/daily?startDate=${startDate}&endDate=today`).then(r => r.json()),
          fetch(`${url}/api/carts`).then(r => r.ok ? r.json() : []),
          fetch(`${url}/api/orders`).then(r => r.ok ? r.json() : []),
        ])
        if (ovRes.status === 'fulfilled' && !ovRes.value?.error) { setOverview(ovRes.value); setGaConfigured(true) }
        if (srcRes.status === 'fulfilled' && Array.isArray(srcRes.value)) setSources(srcRes.value)
        if (stRes.status === 'fulfilled' && Array.isArray(stRes.value))   setStates(stRes.value)
        if (pgRes.status === 'fulfilled' && Array.isArray(pgRes.value))   setPages(pgRes.value)
        if (dyRes.status === 'fulfilled' && Array.isArray(dyRes.value))   setDaily(dyRes.value)
        if (cartRes.status === 'fulfilled' && Array.isArray(cartRes.value)) setCarts(cartRes.value)
        if (ordRes.status === 'fulfilled' && Array.isArray(ordRes.value)) setOrders(ordRes.value)
      }
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  // Cart analytics
  const activeCarts   = carts.filter(c => { const h = (Date.now() - new Date(c.updatedAt||c.createdAt||0).getTime())/(1000*3600); return h < 24 && !c.orderId })
  const abandonedCarts= carts.filter(c => { const h = (Date.now() - new Date(c.updatedAt||c.createdAt||0).getTime())/(1000*3600); return h >= 24 && !c.orderId })
  const abandonedValue= abandonedCarts.reduce((s,c) => s+(c.total||0), 0)
  const activeValue   = activeCarts.reduce((s,c) => s+(c.total||0), 0)

  const stateSales: Record<string, {orders:number,revenue:number}> = {}
  orders.forEach(o => { const st = o.shippingAddress?.state||o.state||'Unknown'; if(!stateSales[st]) stateSales[st]={orders:0,revenue:0}; stateSales[st].orders++; stateSales[st].revenue+=o.amount||0 })
  const topSalesStates = Object.entries(stateSales).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,10)
  const maxSessions = Math.max(...daily.map(d=>d.sessions),1)

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 style={{fontFamily:'Syne',fontSize:22,fontWeight:800}}>🌐 Website <span style={{color:'var(--gold)'}}>Analytics</span></h1>
          <p style={{color:'var(--mu)',fontSize:12.5,marginTop:4}}>rabtnaturals.com · Live tracking + GA4</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {/* Live dot */}
          <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--grL)',border:'1px solid rgba(34,197,94,.3)',borderRadius:50,padding:'5px 12px'}}>
            <span style={{width:7,height:7,borderRadius:'50%',background:'#22C55E',display:'inline-block',animation:'pulse 1.5s infinite'}}/>
            <span style={{fontSize:11.5,fontWeight:700,color:'var(--green)'}}>{live.count} Live</span>
          </div>
          <div style={{display:'flex',background:'var(--s2)',borderRadius:8,padding:3,gap:2}}>
            {DATE_RANGES.map(dr=>(
              <button key={dr.value} onClick={()=>{setDateRange(dr.value);loadAll(dr.value)}} style={{padding:'5px 12px',borderRadius:6,background:dateRange===dr.value?'var(--s1)':'transparent',border:'none',color:dateRange===dr.value?'var(--gold)':'var(--mu)',fontWeight:dateRange===dr.value?700:500,fontSize:11.5,cursor:'pointer',fontFamily:'Outfit'}}>
                {dr.label}
              </button>
            ))}
          </div>
          <button onClick={()=>{loadAll();fetchLive()}} style={{padding:'8px 14px',background:'var(--blL)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:8,color:'var(--blue)',fontWeight:700,fontSize:12.5,cursor:'pointer',fontFamily:'Outfit'}}>↺ Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {[{id:'live',l:'🔴 Live'},{id:'overview',l:'📊 Overview'},{id:'traffic',l:'🔗 Sources'},{id:'geo',l:'📍 Location'},{id:'pages',l:'📄 Pages'},{id:'carts',l:'🛒 Carts'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)} style={{padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Outfit',background:tab===t.id?'var(--gL)':'rgba(255,255,255,0.05)',color:tab===t.id?'var(--gold)':'var(--mu2)',border:'1px solid '+(tab===t.id?'rgba(212,168,83,0.3)':'var(--b1)')}}>
            {t.l}{t.id==='carts'&&abandonedCarts.length>0&&<span style={{marginLeft:5,fontSize:9,background:'var(--red)',color:'#fff',borderRadius:50,padding:'1px 5px',fontWeight:800}}>{abandonedCarts.length}</span>}
          </button>
        ))}
      </div>

      {/* ═══ LIVE TAB ═══ */}
      {tab==='live'&&(
        <div>
          {/* Live KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:20}}>
            {[
              {l:'Live Visitors',v:live.count,c:'var(--green)',pulse:true,sub:'Right now'},
              {l:'In Cart',v:live.byAction?.added_to_cart||0,c:'var(--teal)',sub:'Active carts'},
              {l:'Skin Analysis',v:live.byAction?.skin_analysis||0,c:'var(--gold)',sub:'Taking quiz'},
              {l:'Know Your Skin',v:live.byAction?.know_your_skin||0,c:'var(--purple)',sub:'On quiz page'},
              {l:'Checkout',v:live.byAction?.checkout||0,c:'var(--orange)',sub:'About to buy'},
              {l:'Consultation',v:live.byAction?.consultation||0,c:'var(--blue)',sub:'Booking consult'},
            ].map((s,i)=>(
              <div key={i} className="card">
                <div style={{fontSize:9.5,fontWeight:700,color:'var(--mu)',textTransform:'uppercase',marginBottom:8,display:'flex',alignItems:'center',gap:5}}>
                  {s.pulse&&<span style={{width:6,height:6,borderRadius:'50%',background:'var(--green)',display:'inline-block',animation:'pulse 1.5s infinite'}}/>}
                  {s.l}
                </div>
                <div style={{fontFamily:'Syne',fontSize:22,fontWeight:800,color:s.c,marginBottom:3}}>{s.v}</div>
                <div style={{fontSize:10,color:'var(--mu)'}}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Today stats from tracking */}
          {trackStats&&(
            <div className="card" style={{marginBottom:16}}>
              <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800,marginBottom:14}}>📅 Today's Activity</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
                {[
                  {k:'page_view',l:'Page Views',e:'👁️'},
                  {k:'product_view',l:'Product Views',e:'🧴'},
                  {k:'add_to_cart',l:'Add to Cart',e:'🛒'},
                  {k:'skin_analysis_start',l:'Analysis Started',e:'🔬'},
                  {k:'skin_analysis_complete',l:'Analysis Done',e:'✅'},
                  {k:'consultation_start',l:'Consultation Started',e:'👩‍⚕️'},
                  {k:'checkout_start',l:'Checkout Started',e:'💳'},
                  {k:'order_placed',l:'Orders Placed',e:'📦'},
                ].map((ev,i)=>{
                  const todayVal = trackStats.todayByEvent?.[ev.k]||0
                  const totalVal = trackStats.byEvent?.[ev.k]||0
                  return(
                    <div key={i} style={{background:'var(--s2)',borderRadius:12,padding:'12px 14px'}}>
                      <div style={{fontSize:18,marginBottom:5}}>{ev.e}</div>
                      <div style={{fontFamily:'Syne',fontSize:18,fontWeight:800,color:todayVal>0?'var(--gold)':'var(--mu)'}}>{todayVal}</div>
                      <div style={{fontSize:10.5,fontWeight:600,color:'var(--mu2)',marginBottom:2}}>{ev.l}</div>
                      <div style={{fontSize:10,color:'var(--mu)'}}>30d: {totalVal.toLocaleString()}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Live visitor list */}
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800}}>Live Visitors</div>
              <span style={{fontSize:11,color:'var(--mu)'}}>Auto-refreshes every 15s</span>
            </div>
            {live.visitors.length===0?(
              <div style={{textAlign:'center',padding:40,color:'var(--mu)'}}>
                <div style={{fontSize:32,marginBottom:12}}>👥</div>
                <div style={{fontSize:13,fontWeight:600}}>No live visitors right now</div>
                <div style={{fontSize:11.5,marginTop:4,color:'var(--mu)',lineHeight:1.6}}>Add tracking script to rabtnaturals.com to see live data</div>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {live.visitors.slice(0,20).map((v:any,i:number)=>{
                  const meta = ACTION_META[v.action]||ACTION_META.browsing
                  const secsAgo = Math.round((Date.now()-v.lastSeen)/1000)
                  return(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 13px',background:'var(--s2)',borderRadius:11,border:'1px solid var(--b1)'}}>
                      <span style={{fontSize:18,flexShrink:0}}>{meta.emoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                          <span style={{fontSize:11,fontWeight:700,color:meta.color,background:meta.color+'18',padding:'1px 8px',borderRadius:50}}>{meta.label}</span>
                          {v.phone&&<span style={{fontSize:10.5,color:'var(--green)',fontWeight:600}}>{v.phone}</span>}
                        </div>
                        <div style={{fontSize:11,color:'var(--mu)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.page}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:10,color:'var(--mu)'}}>{secsAgo}s ago</div>
                        <div style={{fontSize:9.5,color:'var(--mu)',marginTop:1}}>{v.source}</div>
                      </div>
                      {v.phone&&(v.action==='added_to_cart'||v.action==='checkout')&&(
                        <a href={`https://wa.me/${v.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hi! Kya main aapki Rabt Naturals order mein help kar sakti hoon? 🌿')}`} target="_blank" rel="noopener noreferrer" style={{fontSize:10,padding:'3px 9px',background:'var(--grL)',color:'var(--green)',borderRadius:50,fontWeight:700,textDecoration:'none',flexShrink:0}}>
                          💬
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Setup instructions if no data */}
          {live.count===0&&!liveLoading&&(
            <div style={{marginTop:16,background:'var(--blL)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:12,padding:'16px 18px',fontSize:12.5,color:'var(--blue)',lineHeight:1.9}}>
              <strong>🔧 Setup Live Tracking on rabtnaturals.com</strong><br/>
              Paste this in your website's <code style={{background:'rgba(59,130,246,0.1)',padding:'1px 5px',borderRadius:3}}>layout.tsx</code> or <code style={{background:'rgba(59,130,246,0.1)',padding:'1px 5px',borderRadius:3}}>_app.tsx</code>:<br/>
              <div style={{background:'var(--s1)',border:'1px solid var(--b2)',borderRadius:8,padding:'10px 12px',marginTop:8,fontFamily:'DM Mono',fontSize:11,lineHeight:1.8,whiteSpace:'pre-wrap',color:'var(--tx)'}}>
{`// Add to your website — tracks live visitors
const RABT_API = 'https://rabt-api.onrender.com'
const vid = localStorage.getItem('rabt_vid') || Math.random().toString(36).slice(2)
localStorage.setItem('rabt_vid', vid)

function pingServer(action = 'browsing') {
  fetch(RABT_API + '/api/live/ping', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ visitorId: vid, page: location.pathname, action, source: document.referrer || 'direct' })
  }).catch(()=>{})
}

pingServer()  // on load
setInterval(() => pingServer(), 30000)  // every 30s`}
              </div>
              Then call <code style={{background:'rgba(59,130,246,0.1)',padding:'1px 5px',borderRadius:3}}>pingServer('added_to_cart')</code> when cart changes, <code style={{background:'rgba(59,130,246,0.1)',padding:'1px 5px',borderRadius:3}}>pingServer('skin_analysis')</code> when quiz starts.
            </div>
          )}
        </div>
      )}

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab==='overview'&&(
        <div>
          {!gaConfigured&&(
            <div style={{background:'var(--orL)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:12,padding:'12px 16px',marginBottom:16,fontSize:12.5,color:'var(--orange)',lineHeight:1.7}}>
              ⚠️ GA4 not configured — add <strong>GA_PROPERTY_ID</strong> + <strong>GA_SERVICE_ACCOUNT_JSON</strong> to Render env vars
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:20}}>
            {[
              {l:'Sessions',v:overview?.sessions?.toLocaleString('en-IN')||'—',c:'var(--blue)',sub:'Total visits'},
              {l:'Users',v:overview?.users?.toLocaleString('en-IN')||'—',c:'var(--teal)',sub:'Unique'},
              {l:'New Users',v:overview?.newUsers?.toLocaleString('en-IN')||'—',c:'var(--green)',sub:'First time'},
              {l:'Page Views',v:overview?.pageViews?.toLocaleString('en-IN')||'—',c:'var(--purple)',sub:'Total views'},
              {l:'Avg Duration',v:overview?.avgDuration?fmt(overview.avgDuration):'—',c:'var(--gold)',sub:'Time on site'},
              {l:'Bounce Rate',v:overview?.bounceRate?Math.round(overview.bounceRate*100)+'%':'—',c:overview?.bounceRate>0.6?'var(--red)':'var(--green)',sub:'Single page'},
            ].map((s,i)=>(
              <div key={i} className="card">
                <div style={{fontSize:9.5,fontWeight:700,color:'var(--mu)',textTransform:'uppercase',marginBottom:8}}>{s.l}</div>
                <div style={{fontFamily:'Syne',fontSize:18,fontWeight:800,color:s.c,marginBottom:3}}>{loading?'...':s.v}</div>
                <div style={{fontSize:10,color:'var(--mu)'}}>{s.sub}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:16}}>
            <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800,marginBottom:16}}>Daily Traffic</div>
            {daily.length>0?(
              <div>
                <div style={{display:'flex',gap:2,alignItems:'flex-end',height:120,overflowX:'auto'}}>
                  {daily.slice(-30).map((d,i)=>(
                    <div key={i} style={{flex:'0 0 auto',minWidth:8,display:'flex',flexDirection:'column',alignItems:'center'}}>
                      <div title={d.date+': '+d.sessions+' sessions'} style={{width:8,background:'var(--blue)',borderRadius:'2px 2px 0 0',height:Math.round(d.sessions/maxSessions*110)+'px',minHeight:d.sessions>0?2:0}} />
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--mu)',marginTop:6}}>
                  <span>{daily[0]?.date?.replace(/(\d{4})(\d{2})(\d{2})/,'$2/$3')}</span>
                  <span>Last 30 days</span>
                  <span>{daily[daily.length-1]?.date?.replace(/(\d{4})(\d{2})(\d{2})/,'$2/$3')}</span>
                </div>
              </div>
            ):(
              <div style={{textAlign:'center',padding:30,color:'var(--mu)',fontSize:12}}>Configure GA4 to see traffic data</div>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div className="card">
              <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800,marginBottom:12}}>Top Sources</div>
              {sources.slice(0,5).map((s,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--b1)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:SOURCE_COLORS[s.source.toLowerCase()]||'var(--mu)',display:'inline-block'}}/>
                    <span style={{fontSize:12,fontWeight:600,textTransform:'capitalize'}}>{s.source}/{s.medium}</span>
                  </div>
                  <span style={{fontFamily:'DM Mono',fontSize:12,fontWeight:700,color:'var(--blue)'}}>{s.sessions.toLocaleString()}</span>
                </div>
              ))}
              {sources.length===0&&<div style={{textAlign:'center',color:'var(--mu)',padding:16,fontSize:12}}>No source data</div>}
            </div>
            <div className="card">
              <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800,marginBottom:12}}>Top States</div>
              {states.slice(0,5).map((s,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--b1)'}}>
                  <span style={{fontSize:12,fontWeight:600}}>{s.state}</span>
                  <span style={{fontFamily:'DM Mono',fontSize:12,fontWeight:700,color:'var(--teal)'}}>{s.sessions.toLocaleString()}</span>
                </div>
              ))}
              {states.length===0&&<div style={{textAlign:'center',color:'var(--mu)',padding:16,fontSize:12}}>No location data</div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TRAFFIC TAB ═══ */}
      {tab==='traffic'&&(
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800,marginBottom:16}}>Traffic by Source</div>
            {sources.length>0?sources.map((s,i)=>{
              const maxS=Math.max(...sources.map(x=>x.sessions),1)
              return(
                <div key={i} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,marginBottom:5}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:10,height:10,borderRadius:'50%',background:SOURCE_COLORS[s.source.toLowerCase()]||'var(--mu)',display:'inline-block'}}/>
                      <span style={{fontWeight:600,textTransform:'capitalize'}}>{s.source}</span>
                      <span style={{color:'var(--mu)',fontSize:11}}>/ {s.medium}</span>
                    </div>
                    <div style={{display:'flex',gap:14,fontFamily:'DM Mono'}}>
                      <span style={{color:'var(--blue)'}}>{s.sessions.toLocaleString()}</span>
                      <span style={{color:'var(--teal)'}}>{s.users.toLocaleString()} users</span>
                    </div>
                  </div>
                  <div style={{height:8,background:'var(--s2)',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:Math.round(s.sessions/maxS*100)+'%',background:SOURCE_COLORS[s.source.toLowerCase()]||'var(--mu)',borderRadius:4}}/>
                  </div>
                </div>
              )
            }):(
              <div style={{textAlign:'center',padding:40,color:'var(--mu)'}}>Configure GA4 to see traffic sources</div>
            )}
          </div>
          {sources.length>0&&(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10}}>
              {[
                {l:'Organic',v:sources.filter(s=>s.medium==='organic').reduce((a,s)=>a+s.sessions,0),c:'var(--green)'},
                {l:'Social',v:sources.filter(s=>['instagram','facebook','youtube'].includes(s.source.toLowerCase())).reduce((a,s)=>a+s.sessions,0),c:'var(--orange)'},
                {l:'Direct',v:sources.filter(s=>s.source==='(direct)'||s.medium==='(none)').reduce((a,s)=>a+s.sessions,0),c:'var(--teal)'},
                {l:'Paid',v:sources.filter(s=>s.medium==='cpc'||s.medium==='paid').reduce((a,s)=>a+s.sessions,0),c:'var(--red)'},
                {l:'Referral',v:sources.filter(s=>s.medium==='referral').reduce((a,s)=>a+s.sessions,0),c:'var(--purple)'},
              ].map((s,i)=>(
                <div key={i} className="card">
                  <div style={{fontSize:9.5,fontWeight:700,color:'var(--mu)',textTransform:'uppercase',marginBottom:8}}>{s.l}</div>
                  <div style={{fontFamily:'Syne',fontSize:20,fontWeight:800,color:s.c}}>{s.v.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ GEO TAB ═══ */}
      {tab==='geo'&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div className="card">
              <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800,marginBottom:14}}>📍 Traffic by State</div>
              {states.length>0?states.slice(0,12).map((s,i)=>{
                const maxS=Math.max(...states.map(x=>x.sessions),1)
                return(
                  <div key={i} style={{marginBottom:9}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                      <span style={{fontWeight:600}}>{s.state}</span>
                      <span style={{fontFamily:'DM Mono',color:'var(--blue)',fontSize:11}}>{s.sessions.toLocaleString()}</span>
                    </div>
                    <div style={{height:6,background:'var(--s2)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:Math.round(s.sessions/maxS*100)+'%',background:'var(--blue)',borderRadius:3}}/>
                    </div>
                  </div>
                )
              }):(
                <div style={{textAlign:'center',color:'var(--mu)',padding:24,fontSize:12}}>Configure GA4</div>
              )}
            </div>
            <div className="card">
              <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800,marginBottom:14}}>💰 Sales by State</div>
              {topSalesStates.length>0?topSalesStates.map(([state,data],i)=>{
                const maxR=Math.max(...topSalesStates.map(([,d])=>d.revenue),1)
                return(
                  <div key={i} style={{marginBottom:9}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                      <div><span style={{fontWeight:600}}>{state}</span><span style={{fontSize:10,color:'var(--mu)',marginLeft:5}}>{data.orders} orders</span></div>
                      <span style={{fontFamily:'DM Mono',color:'var(--green)',fontWeight:700,fontSize:11}}>₹{data.revenue.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{height:6,background:'var(--s2)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:Math.round(data.revenue/maxR*100)+'%',background:'var(--green)',borderRadius:3}}/>
                    </div>
                  </div>
                )
              }):(
                <div style={{textAlign:'center',color:'var(--mu)',padding:24,fontSize:12}}>No order location data</div>
              )}
            </div>
          </div>
          {states.length>0&&(
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:'1px solid var(--b1)',fontFamily:'Syne',fontSize:13,fontWeight:800}}>City Breakdown</div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:500}}>
                  <thead><tr>{['State','City','Sessions','Users','Conversions'].map(h=>(
                    <th key={h} style={{textAlign:'left',padding:'8px 14px',fontSize:10,fontWeight:700,color:'var(--mu)',textTransform:'uppercase',borderBottom:'1px solid var(--b1)'}}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{states.map((s,i)=>(
                    <tr key={i} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                      <td style={{padding:'8px 14px',fontSize:12.5,fontWeight:600}}>{s.state}</td>
                      <td style={{padding:'8px 14px',fontSize:12,color:'var(--mu)'}}>{s.city}</td>
                      <td style={{padding:'8px 14px',fontFamily:'DM Mono',fontSize:12,color:'var(--blue)'}}>{s.sessions.toLocaleString()}</td>
                      <td style={{padding:'8px 14px',fontFamily:'DM Mono',fontSize:12,color:'var(--teal)'}}>{s.users.toLocaleString()}</td>
                      <td style={{padding:'8px 14px',fontFamily:'DM Mono',fontSize:12,color:'var(--green)',fontWeight:700}}>{s.conversions}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PAGES TAB ═══ */}
      {tab==='pages'&&(
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--b1)',fontFamily:'Syne',fontSize:13,fontWeight:800}}>Top Pages</div>
          {pages.length>0?(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:500}}>
                <thead><tr>{['Page','Title','Views','Avg Time'].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'8px 14px',fontSize:10,fontWeight:700,color:'var(--mu)',textTransform:'uppercase',borderBottom:'1px solid var(--b1)'}}>{h}</th>
                ))}</tr></thead>
                <tbody>{pages.map((p,i)=>{
                  const maxV=Math.max(...pages.map(x=>x.views),1)
                  return(
                    <tr key={i} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.018)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                      <td style={{padding:'10px 14px'}}>
                        <div style={{fontSize:12,fontFamily:'DM Mono',color:'var(--blue)',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:200}}>{p.path}</div>
                        <div style={{height:4,background:'var(--s2)',borderRadius:2,overflow:'hidden',width:100}}>
                          <div style={{height:'100%',width:Math.round(p.views/maxV*100)+'%',background:'var(--blue)',borderRadius:2}}/>
                        </div>
                      </td>
                      <td style={{padding:'10px 14px',fontSize:12,color:'var(--mu2)',maxWidth:180}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title}</div></td>
                      <td style={{padding:'10px 14px',fontFamily:'DM Mono',fontSize:13,fontWeight:700,color:'var(--purple)'}}>{p.views.toLocaleString()}</td>
                      <td style={{padding:'10px 14px',fontFamily:'DM Mono',fontSize:12,color:'var(--gold)'}}>{fmt(p.avgTime)}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          ):(
            <div style={{textAlign:'center',padding:50,color:'var(--mu)'}}>Configure GA4 to see page analytics</div>
          )}
        </div>
      )}

      {/* ═══ CARTS TAB ═══ */}
      {tab==='carts'&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,marginBottom:16}}>
            {[
              {l:'Active Carts',v:activeCarts.length,c:'var(--green)',sub:'Last 24h'},
              {l:'Active Value',v:'₹'+activeValue.toLocaleString('en-IN'),c:'var(--teal)',sub:'Potential'},
              {l:'Abandoned',v:abandonedCarts.length,c:'var(--orange)',sub:'>24h no checkout'},
              {l:'Lost Revenue',v:'₹'+abandonedValue.toLocaleString('en-IN'),c:'var(--red)',sub:'Abandoned value'},
              {l:'Abandon Rate',v:carts.length>0?Math.round(abandonedCarts.length/carts.length*100)+'%':'—',c:'var(--orange)',sub:'Rate'},
            ].map((s,i)=>(
              <div key={i} className="card">
                <div style={{fontSize:9.5,fontWeight:700,color:'var(--mu)',textTransform:'uppercase',marginBottom:8}}>{s.l}</div>
                <div style={{fontFamily:'Syne',fontSize:20,fontWeight:800,color:s.c,marginBottom:3}}>{s.v}</div>
                <div style={{fontSize:10,color:'var(--mu)'}}>{s.sub}</div>
              </div>
            ))}
          </div>

          {abandonedCarts.length>0&&(
            <div style={{background:'var(--orL)',border:'1px solid rgba(249,115,22,.3)',borderRadius:12,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:20}}>⚠️</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--orange)'}}>{abandonedCarts.length} Abandoned Carts — ₹{abandonedValue.toLocaleString('en-IN')} recoverable</div>
                <div style={{fontSize:11.5,color:'var(--orange)',opacity:.8,marginTop:2}}>Send WhatsApp recovery messages below</div>
              </div>
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div className="card">
              <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800,marginBottom:14,color:'var(--green)'}}>🟢 Active ({activeCarts.length})</div>
              {activeCarts.length===0?(
                <div style={{textAlign:'center',color:'var(--mu)',padding:20,fontSize:12}}>No active carts</div>
              ):activeCarts.slice(0,8).map((c,i)=>{
                const itemCount=c.items?.length||0
                return(
                  <div key={i} style={{background:'var(--s2)',borderRadius:10,padding:'11px 13px',marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:12.5,fontWeight:600}}>{c.name||c.phone||'Guest'}</span>
                      <span style={{fontFamily:'DM Mono',fontSize:12,fontWeight:700,color:'var(--green)'}}>₹{(c.total||0).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{fontSize:10.5,color:'var(--mu)',marginBottom:4}}>{itemCount} items · {c.phone||'No phone'}</div>
                    {c.items?.slice(0,2).map((it:any,j:number)=>(
                      <div key={j} style={{fontSize:10,color:'var(--mu2)'}}>• {it.name} × {it.qty||it.quantity||1}</div>
                    ))}
                    {c.phone&&(
                      <a href={`https://wa.me/${c.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hi! Maine dekha aapne Rabt Naturals pe products cart mein add kiye hain. Kya main help kar sakti hoon? 🌿')}`} target="_blank" rel="noopener noreferrer" style={{marginTop:7,display:'inline-flex',alignItems:'center',gap:4,fontSize:10.5,padding:'3px 10px',borderRadius:50,background:'var(--grL)',color:'var(--green)',fontWeight:700,textDecoration:'none'}}>
                        💬 WhatsApp
                      </a>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="card">
              <div style={{fontFamily:'Syne',fontSize:13,fontWeight:800,marginBottom:14,color:'var(--orange)'}}>🔴 Abandoned ({abandonedCarts.length})</div>
              {abandonedCarts.length===0?(
                <div style={{textAlign:'center',color:'var(--mu)',padding:20,fontSize:12}}>No abandoned carts 🎉</div>
              ):abandonedCarts.slice(0,8).map((c,i)=>{
                const hrs=Math.round((Date.now()-new Date(c.updatedAt||c.createdAt||0).getTime())/(1000*3600))
                return(
                  <div key={i} style={{background:'var(--rdL)',border:'1px solid rgba(239,68,68,.15)',borderRadius:10,padding:'11px 13px',marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:12.5,fontWeight:600}}>{c.name||c.phone||'Guest'}</span>
                      <span style={{fontFamily:'DM Mono',fontSize:12,fontWeight:700,color:'var(--red)'}}>₹{(c.total||0).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{fontSize:10.5,color:'var(--mu)',marginBottom:4}}>{hrs}h ago · {c.phone||'No phone'}</div>
                    {c.items?.slice(0,2).map((it:any,j:number)=>(
                      <div key={j} style={{fontSize:10,color:'var(--mu2)'}}>• {it.name} × {it.qty||it.quantity||1}</div>
                    ))}
                    {c.phone&&(
                      <a href={`https://wa.me/${c.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hi! Aapne Rabt Naturals pe kuch items cart mein chhod diye hain. Sirf aapke liye 10% extra discount — code: CART10 🌿 rabtnaturals.com')}`} target="_blank" rel="noopener noreferrer" style={{marginTop:7,display:'inline-flex',alignItems:'center',gap:4,fontSize:10.5,padding:'3px 10px',borderRadius:50,background:'var(--orL)',color:'var(--orange)',fontWeight:700,textDecoration:'none'}}>
                        💬 Recover WhatsApp
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cart tracking setup */}
          {carts.length===0&&(
            <div style={{marginTop:16,background:'var(--blL)',border:'1px solid rgba(59,130,246,.2)',borderRadius:12,padding:'16px 18px',fontSize:12.5,color:'var(--blue)',lineHeight:1.8}}>
              <strong>🔧 Cart Tracking Setup for rabtnaturals.com</strong><br/>
              Call this whenever cart changes (add/remove item):
              <div style={{background:'var(--s1)',border:'1px solid var(--b2)',borderRadius:8,padding:'10px 12px',marginTop:8,fontFamily:'DM Mono',fontSize:11,lineHeight:1.8,whiteSpace:'pre-wrap',color:'var(--tx)'}}>
{`// In your cart context / cart update function:
const cartId = localStorage.getItem('rabt_cart_id') || Math.random().toString(36).slice(2)
localStorage.setItem('rabt_cart_id', cartId)

async function syncCart(items, total) {
  await fetch('https://rabt-api.onrender.com/api/carts', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      cartId,
      phone: user?.phone || null,
      name: user?.name || null,
      items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      total,
      page: '/cart',
      source: document.referrer || 'direct'
    })
  })
}`}
              </div>
              Also call <code style={{background:'rgba(59,130,246,.1)',padding:'1px 5px',borderRadius:3}}>PATCH /api/carts/{'{cartId}'}/convert</code> when order is placed.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
