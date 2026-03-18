'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [summary, setSummary] = useState({ total: 0, pending: 0, paid: 0, consultationTotal: 0, commissionTotal: 0 })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [mongoStats, setMongoStats] = useState<any>(null)
  const mongoUrl = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
    setProfile(prof)

    if (prof) {
      const { data: earningsData } = await supabase
        .from('specialist_earnings')
        .select('*')
        .eq('specialist_id', prof.id)
        .order('created_at', { ascending: false })

      const data = earningsData || []
      setEarnings(data)
      setSummary({
        total: data.reduce((s: number, e: any) => s + (e.amount || 0), 0),
        pending: data.filter((e: any) => e.status === 'pending').reduce((s: number, e: any) => s + (e.amount || 0), 0),
        paid: data.filter((e: any) => e.status === 'paid').reduce((s: number, e: any) => s + (e.amount || 0), 0),
        consultationTotal: data.filter((e: any) => e.type === 'consultation').reduce((s: number, e: any) => s + (e.amount || 0), 0),
        commissionTotal: data.filter((e: any) => e.type === 'order_commission').reduce((s: number, e: any) => s + (e.amount || 0), 0),
      })

      // Load MongoDB live stats
      if (mongoUrl && prof.specialist_id) {
        try {
          const consRes = await fetch(mongoUrl + '/api/consultations').then(r => r.ok ? r.json() : [])
          const myCons = Array.isArray(consRes) ? consRes.filter((c: any) => c.assignedSpecialist === prof.specialist_id) : []
          const completedCons = myCons.filter((c: any) => c.status === 'completed')
          setMongoStats({
            totalConsultations: myCons.length,
            completedConsultations: completedCons.length,
            pendingConsultations: myCons.filter((c: any) => c.status === 'pending').length,
            expectedEarnings: completedCons.length * 30,
          })
        } catch {}
      }
    }
    setLoading(false)
  }

  async function syncEarnings() {
    if (!mongoUrl) { toast.error('MongoDB connect nahi hai!'); return }
    setSyncing(true)
    toast.loading('Sync ho raha hai...', { id: 'sync' })
    try {
      // Manual sync — fetch MongoDB data and add earnings
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      if (!prof?.specialist_id) { toast.error('Specialist ID nahi mili', { id: 'sync' }); setSyncing(false); return }

      const [consRes, ordersRes] = await Promise.all([
        fetch(mongoUrl + '/api/consultations').then(r => r.ok ? r.json() : []),
        fetch(mongoUrl + '/api/orders').then(r => r.ok ? r.json() : []),
      ])

      const myCons = Array.isArray(consRes)
        ? consRes.filter((c: any) => c.assignedSpecialist === prof.specialist_id && c.status === 'completed')
        : []

      // Get existing entries
      const { data: existing } = await supabase.from('specialist_earnings').select('consultation_id, order_id').eq('specialist_id', prof.id)
      const existingConsIds = new Set(existing?.map((e: any) => e.consultation_id).filter(Boolean))
      const existingOrderIds = new Set(existing?.map((e: any) => e.order_id).filter(Boolean))

      let added = 0

      // Add consultation earnings
      for (const c of myCons) {
        const cId = c._id?.toString()
        if (existingConsIds.has(cId)) continue
        await supabase.from('specialist_earnings').insert({
          specialist_id: prof.id,
          type: 'consultation',
          amount: 30,
          description: 'Consultation completed - ' + (c.name || c.fullName || 'Patient'),
          consultation_id: cId,
          status: 'pending',
        })
        added++
      }

      // Add order commissions
      const myPatientUserIds = myCons.map((c: any) => c.user?.toString()).filter(Boolean)
      const myOrders = Array.isArray(ordersRes)
        ? ordersRes.filter((o: any) => myPatientUserIds.includes(o.userId?.toString() || o.user?.toString()))
        : []

      for (const o of myOrders) {
        const oId = o._id?.toString()
        if (existingOrderIds.has(oId)) continue
        const orderAmount = o.amount || o.pricing?.total || 0
        const commission = Math.round(orderAmount * 0.12)
        if (commission <= 0) continue
        await supabase.from('specialist_earnings').insert({
          specialist_id: prof.id,
          type: 'order_commission',
          amount: commission,
          description: '12% commission on order by ' + (o.customerName || 'Patient'),
          order_id: oId,
          status: 'pending',
        })
        added++
      }

      toast.success(added > 0 ? added + ' naye entries add hue! 🎉' : 'Sab already synced hai ✅', { id: 'sync', duration: 4000 })
      loadAll()
    } catch (err: any) {
      toast.error('Sync error: ' + err.message, { id: 'sync' })
    }
    setSyncing(false)
  }

  async function requestPayout() {
    if (summary.pending < 100) { toast.error('Minimum payout ₹100 hai'); return }
    const { data: managers } = await supabase.from('profiles').select('id').in('role', ['founder', 'specialist_manager'])
    for (const m of managers || []) {
      await supabase.from('notifications').insert({
        user_id: m.id,
        title: 'Payout Request',
        message: (profile?.name || 'Specialist') + ' ne ₹' + summary.pending + ' ka payout request kiya!',
        type: 'earning',
      })
    }
    toast.success('Payout request bhej diya! Manager ko notify kar diya. 💰')
  }

  const TYPE_CONFIG: Record<string, any> = {
    consultation: { label: 'Consultation', color: 'var(--green)', bg: 'var(--grL)', icon: '🌿' },
    order_commission: { label: 'Order Commission', color: 'var(--blue)', bg: 'var(--blL)', icon: '🛒' },
    bonus: { label: 'Bonus', color: 'var(--gold)', bg: 'var(--gL)', icon: '⭐' },
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>My <span style={{ color: 'var(--gold)' }}>Earnings</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>₹30/consultation + 12% order commission</p>
        </div>
        <button onClick={syncEarnings} disabled={syncing} style={{
          padding: '8px 18px',
          background: syncing ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#D4A853,#B87C30)',
          border: 'none', borderRadius: 8, color: syncing ? 'var(--mu)' : '#08090C',
          fontWeight: 700, fontSize: 12.5, cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'Outfit'
        }}>
          {syncing ? '⏳ Syncing...' : '🔄 Sync from MongoDB'}
        </button>
      </div>

      {/* MongoDB Live Stats */}
      {mongoStats && (
        <div style={{ background: 'var(--s1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>🍃 Live MongoDB:</div>
          {[
            { label: 'Meri Consultations', value: mongoStats.totalConsultations },
            { label: 'Completed', value: mongoStats.completedConsultations },
            { label: 'Expected Earnings', value: '₹' + mongoStats.expectedEarnings },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--mu)' }}>{s.label}</div>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mu)', fontStyle: 'italic' }}>
            Sync button dabao wallet update karne ke liye →
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Earned', value: '₹' + summary.total.toLocaleString('en-IN'), color: 'var(--green)' },
          { label: 'Pending', value: '₹' + summary.pending.toLocaleString('en-IN'), color: 'var(--gold)' },
          { label: 'Paid Out', value: '₹' + summary.paid.toLocaleString('en-IN'), color: 'var(--teal)' },
          { label: 'Consultation Fees', value: '₹' + summary.consultationTotal.toLocaleString('en-IN'), color: 'var(--green)' },
          { label: 'Commissions', value: '₹' + summary.commissionTotal.toLocaleString('en-IN'), color: 'var(--blue)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Earnings Table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>Earnings Log</span>
            <span style={{ fontSize: 12, color: 'var(--mu)' }}>{earnings.length} entries</span>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>Loading...</div>
          ) : earnings.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--mu)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
              <div style={{ fontSize: 14, marginBottom: 6 }}>Abhi koi earnings nahi</div>
              <div style={{ fontSize: 12, marginBottom: 16 }}>MongoDB sync karo</div>
              <button onClick={syncEarnings} style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
                🔄 Sync Now
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Type', 'Description', 'Amount', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {earnings.map((e, i) => {
                  const tc = TYPE_CONFIG[e.type] || TYPE_CONFIG.bonus
                  return (
                    <tr key={i} onMouseOver={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.018)')} onMouseOut={ev => (ev.currentTarget.style.background = '')}>
                      <td style={{ padding: '11px 14px', fontSize: 11.5, color: 'var(--mu)', fontFamily: 'DM Mono', whiteSpace: 'nowrap' }}>
                        {new Date(e.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: tc.bg, color: tc.color }}>
                          {tc.icon} {tc.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--mu2)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description || '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontFamily: 'DM Mono', fontWeight: 800, fontSize: 14, color: 'var(--green)' }}>
                        +₹{e.amount}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: e.status === 'paid' ? 'var(--grL)' : 'var(--gL)', color: e.status === 'paid' ? 'var(--green)' : 'var(--gold)' }}>
                          {e.status === 'paid' ? '✓ Paid' : '⏳ Pending'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Payout + How it works */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>💰 Payout</div>
            <div style={{ background: 'var(--gL)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 12, padding: '16px', marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 6 }}>Available for Payout</div>
              <div style={{ fontFamily: 'Syne', fontSize: 30, fontWeight: 800, color: 'var(--gold)' }}>₹{summary.pending.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--mu2)', lineHeight: 1.6 }}>
              💡 UPI se har week · Minimum ₹100
            </div>
            <button onClick={requestPayout} style={{
              width: '100%', padding: 11,
              background: summary.pending >= 100 ? 'linear-gradient(135deg,#D4A853,#B87C30)' : 'rgba(255,255,255,0.05)',
              border: 'none', borderRadius: 10,
              color: summary.pending >= 100 ? '#08090C' : 'var(--mu)',
              fontSize: 13, fontWeight: 700,
              cursor: summary.pending >= 100 ? 'pointer' : 'not-allowed', fontFamily: 'Outfit'
            }}>
              {summary.pending >= 100 ? '💸 Request Payout' : '₹' + (100 - summary.pending) + ' aur chahiye'}
            </button>
          </div>

          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Earning System</div>
            <div style={{ background: 'var(--grL)', borderRadius: 10, padding: '12px', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 24 }}>🌿</div>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>₹30</div>
                <div style={{ fontSize: 11.5, color: 'var(--mu2)' }}>Har completed consultation</div>
              </div>
            </div>
            <div style={{ background: 'var(--blL)', borderRadius: 10, padding: '12px', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 24 }}>🛒</div>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: 'var(--blue)' }}>12%</div>
                <div style={{ fontSize: 11.5, color: 'var(--mu2)' }}>Patient ke har order pe</div>
              </div>
            </div>
            <div style={{ background: 'var(--gL)', borderRadius: 10, padding: '10px 12px', fontSize: 11.5, color: 'var(--mu2)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--gold)' }}>Example:</strong><br />
              10 consultations = ₹300<br />
              3 patients ne ₹500 order kiya = ₹180<br />
              <strong style={{ color: 'var(--gold)' }}>Total = ₹480 🎉</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
