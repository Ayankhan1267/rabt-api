'use client'
import { useEffect, useState } from 'react'
import { supabase, ROLE_CONFIG, UserRole } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ROLES: UserRole[] = ['founder', 'manager', 'specialist_manager', 'specialist', 'support', 'ops', 'partner']

export default function AdminPage() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [tab, setTab] = useState<'users' | 'leads' | 'tasks' | 'perms'>('users')
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newCredentials, setNewCredentials] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'support' as UserRole, phone: '' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [profRes, leadsRes, tasksRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('leads').select('*, assigned_to(id,name)').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*, assigned_to(id,name)').order('created_at', { ascending: false }),
    ])
    setProfiles(profRes.data || [])
    setLeads(leadsRes.data || [])
    setTasks(tasksRes.data || [])
  }

  async function addMember() {
    if (!form.name || !form.email) { toast.error('Name aur email required hai'); return }
    setAdding(true)
    toast.loading('Member add ho raha hai...', { id: 'add' })
    try {
      const res = await fetch('/api/create-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Error aayi', { id: 'add' }); setAdding(false); return }
      toast.success(form.name + ' add ho gaya!', { id: 'add' })
      setNewCredentials(data.credentials)
      setShowAdd(false)
      setForm({ name: '', email: '', role: 'support', phone: '' })
      loadAll()
    } catch (err: any) {
      toast.error('Error: ' + err.message, { id: 'add' })
    }
    setAdding(false)
  }

  async function updateRole(id: string, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    toast.success('Role updated!')
    loadAll()
  }

  async function deleteMember(id: string, name: string) {
    if (!confirm(name + ' ko delete karna chahte ho?')) return
    toast.loading('Deleting...', { id: 'del' })
    try {
      const res = await fetch('/api/create-member', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      })
      if (res.ok) { toast.success(name + ' deleted!', { id: 'del' }); loadAll() }
      else { const data = await res.json(); toast.error(data.error || 'Error', { id: 'del' }) }
    } catch { toast.error('Delete failed', { id: 'del' }) }
  }

  async function assignLead(lid: string, uid: string) {
    await supabase.from('leads').update({ assigned_to: uid || null }).eq('id', lid)
    toast.success(uid ? 'Lead assigned!' : 'Unassigned')
    loadAll()
  }

  async function assignTask(tid: string, uid: string) {
    await supabase.from('tasks').update({ assigned_to: uid || null }).eq('id', tid)
    toast.success(uid ? 'Task assigned!' : 'Unassigned')
    loadAll()
  }

  const PERMS: Record<string, Record<UserRole, boolean>> = {
    'Dashboard':       { founder: true,  manager: true,  specialist_manager: false, specialist: false, support: false, ops: false, partner: false },
    'Admin Panel':     { founder: true,  manager: false, specialist_manager: false, specialist: false, support: false, ops: false, partner: false },
    'CRM / Leads':     { founder: true,  manager: true,  specialist_manager: true,  specialist: true,  support: true,  ops: false, partner: false },
    'Orders':          { founder: true,  manager: true,  specialist_manager: false, specialist: false, support: true,  ops: true,  partner: false },
    'Finance':         { founder: true,  manager: true,  specialist_manager: false, specialist: false, support: false, ops: false, partner: false },
    'Marketing':       { founder: true,  manager: true,  specialist_manager: false, specialist: false, support: false, ops: false, partner: false },
    'Consultations':   { founder: true,  manager: false, specialist_manager: true,  specialist: true,  support: false, ops: false, partner: false },
    'AI Agents':       { founder: true,  manager: true,  specialist_manager: true,  specialist: true,  support: true,  ops: false, partner: false },
    'Knowledge Base':  { founder: true,  manager: true,  specialist_manager: true,  specialist: true,  support: true,  ops: true,  partner: false },
    'Team':            { founder: true,  manager: true,  specialist_manager: false, specialist: false, support: false, ops: false, partner: false },
    'Goals':           { founder: true,  manager: true,  specialist_manager: false, specialist: false, support: false, ops: false, partner: false },
    'Partner Portal':  { founder: true,  manager: true,  specialist_manager: false, specialist: false, support: false, ops: false, partner: true  },
    'Partner Manager': { founder: true,  manager: true,  specialist_manager: false, specialist: false, support: false, ops: false, partner: false },
  }

  const inputStyle: any = {
    width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8,
    padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Admin <span style={{ color: 'var(--gold)' }}>Panel</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{profiles.length} team members</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
          + Add Member
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--b1)', paddingBottom: 12 }}>
        {[
          { id: 'users', label: '👥 Users & Roles' },
          { id: 'leads', label: '🎯 Assign Leads' },
          { id: 'tasks', label: '✓ Assign Tasks' },
          { id: 'perms', label: '🔒 Permissions' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit',
            background: tab === t.id ? 'var(--gL)' : 'transparent',
            color: tab === t.id ? 'var(--gold)' : 'var(--mu2)',
            border: '1px solid ' + (tab === t.id ? 'rgba(212,168,83,0.3)' : 'var(--b1)'),
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {profiles.map(p => {
            const role = ROLE_CONFIG[p.role as UserRole] || ROLE_CONFIG.support
            return (
              <div key={p.id} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: role.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                  {(p.name || 'U').charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: 'DM Mono' }}>{p.email}</div>
                  {p.phone && <div style={{ fontSize: 11, color: 'var(--mu)' }}>{p.phone}</div>}
                </div>
                <select value={p.role} onChange={e => updateRole(p.id, e.target.value as UserRole)} style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '6px 10px', color: role.color, fontSize: 12, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
                </select>
                <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700, background: role.color + '22', color: role.color }}>
                  {role.label}
                </span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.is_active !== false ? 'var(--green)' : 'var(--mu)' }} />
                {p.role !== 'founder' && (
                  <button onClick={() => deleteMember(p.id, p.name)} style={{ padding: '5px 10px', background: 'var(--rdL)', border: 'none', borderRadius: 7, color: 'var(--red)', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit' }}>
                    Delete
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'leads' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {leads.slice(0, 20).map(l => (
            <div key={l.id} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: l.stage === 'converted' ? 'var(--grL)' : 'var(--gL)', color: l.stage === 'converted' ? 'var(--green)' : 'var(--gold)' }}>{l.stage}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 10 }}>{l.concern || l.source}</div>
              <select value={l.assigned_to?.id || ''} onChange={e => assignLead(l.id, e.target.value)} style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 10px', color: 'var(--tx)', fontSize: 12, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Unassigned —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
              </select>
              {l.assigned_to?.name && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6 }}>✅ {l.assigned_to.name}</div>}
            </div>
          ))}
          {leads.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--mu)' }}>No leads yet</div>}
        </div>
      )}

      {tab === 'tasks' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {tasks.slice(0, 20).map(t => {
            const pc: Record<string, string> = { Urgent: 'var(--red)', High: 'var(--orange)', Medium: 'var(--gold)', Low: 'var(--mu)' }
            return (
              <div key={t.id} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: pc[t.priority] || 'var(--mu)', flexShrink: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 10 }}>{t.priority} · {t.due_date || '—'}</div>
                <select value={t.assigned_to?.id || ''} onChange={e => assignTask(t.id, e.target.value)} style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '7px 10px', color: 'var(--tx)', fontSize: 12, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer' }}>
                  <option value="">— Unassigned —</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
                </select>
                {t.assigned_to?.name && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6 }}>✅ {t.assigned_to.name}</div>}
              </div>
            )
          })}
          {tasks.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--mu)' }}>No tasks yet</div>}
        </div>
      )}

      {tab === 'perms' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '9px 14px', fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)' }}>Section</th>
                {ROLES.map(r => (
                  <th key={r} style={{ textAlign: 'center', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: ROLE_CONFIG[r].color, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>
                    {ROLE_CONFIG[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMS).map(([section, rolePerms]) => (
                <tr key={section} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.018)')} onMouseOut={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, borderBottom: '1px solid var(--b1)' }}>{section}</td>
                  {ROLES.map(r => (
                    <td key={r} style={{ padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid var(--b1)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: rolePerms[r] ? 'var(--grL)' : 'rgba(255,255,255,0.04)', color: rolePerms[r] ? 'var(--green)' : 'var(--mu)' }}>
                        {rolePerms[r] ? '✓' : '✗'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 440, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 6 }}>➕ Add Team Member</div>
            <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 20 }}>
              Password automatically generate hoga: <strong style={{ color: 'var(--gold)' }}>FirstName@1234</strong>
            </div>
            {[
              { key: 'name', label: 'Full Name*', placeholder: 'Priya Sharma' },
              { key: 'email', label: 'Email*', placeholder: 'priya@rabtnaturals.com' },
              { key: 'phone', label: 'Phone', placeholder: '+91 9876543210' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={inputStyle} />
              </div>
            ))}
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))} style={inputStyle}>
              {ROLES.filter(r => r !== 'founder').map(r => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
            </select>
            <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: 'var(--mu2)' }}>
              🔑 Login: <strong>{form.email || 'email@...'}</strong> / <strong>{form.name ? form.name.split(' ')[0] + '@1234' : 'FirstName@1234'}</strong>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addMember} disabled={adding} style={{ flex: 2, padding: 10, background: adding ? 'rgba(212,168,83,0.4)' : 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: adding ? 'not-allowed' : 'pointer', fontFamily: 'Outfit' }}>
                {adding ? '⏳ Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {newCredentials && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '2px solid var(--gold)', borderRadius: 16, padding: '26px 30px', width: 420, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, color: 'var(--gold)', marginBottom: 20 }}>✅ Member Added!</div>
            <div style={{ background: 'var(--s2)', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
              {[{ label: 'Email', value: newCredentials.email }, { label: 'Password', value: newCredentials.password }].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 1 ? '1px solid var(--b1)' : 'none' }}>
                  <span style={{ fontSize: 12, color: 'var(--mu)' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontFamily: 'DM Mono', fontWeight: 700 }}>{item.value}</span>
                    <button onClick={() => { navigator.clipboard.writeText(item.value); toast.success('Copied!') }} style={{ padding: '2px 8px', background: 'var(--gL)', border: 'none', borderRadius: 5, color: 'var(--gold)', fontSize: 10, cursor: 'pointer', fontFamily: 'Outfit' }}>Copy</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--orL)', borderRadius: 8, fontSize: 12, color: 'var(--orange)', marginBottom: 14 }}>
              ⚠️ Pehli baar login karke password change karne bolna!
            </div>
            <button onClick={() => setNewCredentials(null)} style={{ width: '100%', padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
              Done ✓
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
