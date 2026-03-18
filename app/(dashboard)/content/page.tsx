'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const CONTENT_TYPES = ['reel', 'post', 'story', 'blog', 'email', 'whatsapp']
const PLATFORMS = ['Instagram', 'YouTube', 'Facebook', 'WhatsApp', 'Email', 'Website']
const STATUSES = ['idea', 'scripted', 'filming', 'editing', 'review', 'scheduled', 'published']
const STATUS_COLORS: Record<string, string> = {
  idea: 'var(--mu)', scripted: 'var(--blue)', filming: 'var(--orange)', editing: 'var(--purple)',
  review: 'var(--teal)', scheduled: 'var(--gold)', published: 'var(--green)'
}

export default function ContentPage() {
  const [content, setContent] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiOutput, setAiOutput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'reel', platform: 'Instagram', status: 'idea', hook: '', script: '', notes: '', scheduled_at: '' })

  useEffect(() => { loadContent() }, [])

  async function loadContent() {
    const { data } = await supabase.from('content').select('*, assigned_to(name)').order('created_at', { ascending: false })
    setContent(data || [])
  }

  async function saveContent() {
    if (!form.title) { toast.error('Enter title'); return }
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('content').insert({
      ...form, created_by: user?.id,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    })
    toast.success('Content added!')
    setShowAdd(false)
    setForm({ title: '', type: 'reel', platform: 'Instagram', status: 'idea', hook: '', script: '', notes: '', scheduled_at: '' })
    loadContent()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('content').update({ status }).eq('id', id)
    toast.success('Status updated!')
    loadContent()
  }

  async function generateScript() {
    if (!aiInput.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 800,
          system: 'You are Content AI for Rabt Naturals, Indian D2C skincare brand. Create viral Instagram Reels scripts, hooks, captions. Products: Moong Magic (oily/acne), Masoor Glow (pigmentation), Oats Care (dry/sensitive). Tone: Educational desi friend. Include: Hook (3 sec), Body, CTA. Format clearly.',
          messages: [{ role: 'user', content: aiInput }],
        }),
      })
      const data = await res.json()
      setAiOutput(data.content?.[0]?.text || 'Error generating script')
    } catch { toast.error('AI error') }
    setAiLoading(false)
  }

  const hooks = [
    { text: 'POV: You stopped using chemical toners and this happened in 7 days...', ctr: '94%' },
    { text: 'I tested 5 Indian skincare brands. Only 1 actually worked for my acne.', ctr: '88%' },
    { text: 'This ₹349 cleanser replaced my ₹1500 one and my skin has never been better', ctr: '91%' },
    { text: 'Moong dal in your dal tadka also clears your skin? Here\'s the science 🧬', ctr: '86%' },
    { text: 'My skin specialist gave me this exact routine and it cleared my acne in 14 days', ctr: '92%' },
  ]

  const inputStyle: any = {
    width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8,
    padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Content <span style={{ color: 'var(--gold)' }}>Studio</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{content.length} content pieces · AI script generation</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
          + New Content
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Content Calendar */}
        <div className="card">
          <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Content Pipeline</div>
          {content.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--mu)', fontSize: 13 }}>
              No content yet. <span style={{ color: 'var(--gold)', cursor: 'pointer' }} onClick={() => setShowAdd(true)}>Add first piece →</span>
            </div>
          ) : content.map(c => (
            <div key={c.id} style={{ background: 'var(--s2)', borderRadius: 9, padding: '11px 13px', marginBottom: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)} style={{ background: 'transparent', border: 'none', color: STATUS_COLORS[c.status] || 'var(--mu)', fontSize: 10, fontWeight: 700, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit' }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {c.hook && <div style={{ fontSize: 11.5, color: 'var(--mu2)', fontStyle: 'italic', marginBottom: 6 }}>"{c.hook}"</div>}
              <div style={{ display: 'flex', gap: 7 }}>
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', color: 'var(--mu2)', fontWeight: 600 }}>{c.type}</span>
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', color: 'var(--mu2)', fontWeight: 600 }}>{c.platform}</span>
                {c.scheduled_at && <span style={{ fontSize: 10, color: 'var(--mu)', fontFamily: 'DM Mono' }}>{new Date(c.scheduled_at).toLocaleDateString('en-IN')}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Hook Library */}
        <div className="card">
          <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>🎣 Hook Library</div>
          {hooks.map((h, i) => (
            <div key={i} style={{ background: 'var(--s2)', borderRadius: 9, padding: '11px 13px', marginBottom: 9, cursor: 'pointer', transition: 'border-color 0.13s', border: '1px solid var(--b1)' }}
              onClick={() => { navigator.clipboard.writeText(h.text); toast.success('Hook copied!') }}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--purple)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--b1)')}
            >
              <div style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 8 }}>"{h.text}"</div>
              <div style={{ display: 'flex', gap: 7 }}>
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'var(--puL)', color: 'var(--purple)', fontWeight: 600 }}>Hook</span>
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'var(--grL)', color: 'var(--green)', fontWeight: 600 }}>{h.ctr} CTR</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--mu)' }}>Click to copy</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Script Generator */}
      <div className="card">
        <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>🤖 AI Script Generator</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="Describe your content: 'Write a Reel script for Moong Magic Serum targeting oily skin with acne. Include before/after hook.'" rows={5} style={{ ...inputStyle, resize: 'none', height: 120 }} />
            <button onClick={generateScript} disabled={aiLoading || !aiInput.trim()} style={{ width: '100%', padding: 10, background: 'linear-gradient(135deg,var(--purple),#7C3AED)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit', opacity: aiLoading ? 0.7 : 1 }}>
              {aiLoading ? '⏳ Generating...' : '✨ Generate Script'}
            </button>
          </div>
          <div style={{ background: 'var(--s2)', borderRadius: 9, padding: 14, minHeight: 150 }}>
            {aiOutput ? (
              <div>
                <div style={{ fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--tx)', marginBottom: 10 }}>{aiOutput}</div>
                <button onClick={() => { navigator.clipboard.writeText(aiOutput); toast.success('Script copied!') }} style={{ padding: '5px 12px', background: 'var(--gL)', border: 'none', borderRadius: 7, color: 'var(--gold)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600 }}>
                  Copy Script
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--mu)', fontSize: 13 }}>
                Generated script will appear here...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 540, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>🎬 New Content</div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Title*</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Moong Magic Serum — Acne Transformation Reel" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { key: 'type', label: 'Type', options: CONTENT_TYPES },
                { key: 'platform', label: 'Platform', options: PLATFORMS },
                { key: 'status', label: 'Status', options: STATUSES },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>{f.label}</label>
                  <select value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle}>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Hook</label>
            <input value={form.hook} onChange={e => setForm(p => ({ ...p, hook: e.target.value }))} placeholder="Opening hook for first 3 seconds..." style={inputStyle} />
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Script</label>
            <textarea value={form.script} onChange={e => setForm(p => ({ ...p, script: e.target.value }))} placeholder="Full script..." rows={4} style={{ ...inputStyle, resize: 'none' }} />
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Scheduled Date</label>
            <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={saveContent} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Save Content</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
