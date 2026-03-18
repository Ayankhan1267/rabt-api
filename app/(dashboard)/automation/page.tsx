'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function AutomationPage() {
  const [automations, setAutomations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data } = await supabase.from('automations').select('*').order('created_at', { ascending: false })
    setAutomations(data || [])
    setLoading(false)
  }

  async function toggle(id: string, current: boolean) {
    await supabase.from('automations').update({ is_active: !current }).eq('id', id)
    toast.success(!current ? '✅ Automation enabled' : '⏸ Automation paused')
    loadAll()
  }

  const ICONS: Record<string, string> = {
    new_lead: '👥', new_order: '📦', consultation_booked: '🌿', low_stock: '⚠️',
    payment_received: '💰', task_due: '✓', lead_stage_change: '🔄', manual: '▶️'
  }
  const ACTION_ICONS: Record<string, string> = {
    send_whatsapp: '💬', send_email: '📧', send_sms: '📱', create_task: '✓',
    update_lead: '🔄', notify_user: '🔔', webhook: '🔗'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Automation <span style={{ color: 'var(--gold)' }}>Hub</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {automations.filter(a => a.is_active).length} active · {automations.length} total flows
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>Loading automations...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {automations.map(auto => (
            <div key={auto.id} style={{
              background: 'var(--s1)', border: `1px solid ${auto.is_active ? 'rgba(34,197,94,0.2)' : 'var(--b1)'}`,
              borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s'
            }}>
              <div style={{ fontSize: 22 }}>{ICONS[auto.trigger_type] || '⚙️'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Syne', fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{auto.name}</div>
                <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.4 }}>{auto.description}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--blL)', color: 'var(--blue)', fontWeight: 600 }}>
                    Trigger: {auto.trigger_type?.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--puL)', color: 'var(--purple)', fontWeight: 600 }}>
                    {ACTION_ICONS[auto.action_type]} {auto.action_type?.replace(/_/g, ' ')}
                  </span>
                  {auto.run_count > 0 && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: 'var(--mu)', fontWeight: 600 }}>
                      Ran {auto.run_count}×
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: auto.is_active ? 'var(--grL)' : 'rgba(255,255,255,0.06)', color: auto.is_active ? 'var(--green)' : 'var(--mu)' }}>
                  {auto.is_active ? '● Active' : '○ Paused'}
                </span>
                <div onClick={() => toggle(auto.id, auto.is_active)} style={{
                  width: 40, height: 22, borderRadius: 20, cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                  background: auto.is_active ? 'linear-gradient(90deg,#22C55E,#16A34A)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${auto.is_active ? 'transparent' : 'var(--b2)'}`,
                }}>
                  <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff', top: 2, left: auto.is_active ? 20 : 2, transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </div>
              </div>
            </div>
          ))}
          {automations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
              <div>No automations yet. Run the Supabase schema to add defaults.</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
