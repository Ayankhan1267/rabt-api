// Support Page
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function SupportPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: 'Hi! I am Rabt Support AI. Describe a customer issue and I will draft a perfect reply for WhatsApp/Email/Instagram.' }
  ])
  const [loading, setLoading] = useState(false)
  const [tickets] = useState([
    { ch: '💬', channel: 'WhatsApp', msg: 'Ordered 5 days ago, no delivery update received.', priority: 'Urgent', color: 'var(--red)' },
    { ch: '📸', channel: 'Instagram DM', msg: 'Is Moong Magic Serum okay for oily skin with blackheads?', priority: 'Normal', color: 'var(--blue)' },
    { ch: '📧', channel: 'Email', msg: 'Received wrong product. Want replacement or refund.', priority: 'High', color: 'var(--orange)' },
    { ch: '💬', channel: 'WhatsApp', msg: 'When will Eye Pulse Cream come back in stock?', priority: 'Low', color: 'var(--mu)' },
    { ch: '📸', channel: 'Instagram', msg: 'Is Oats Care fragrance-free? I have sensitive skin.', priority: 'Low', color: 'var(--mu)' },
  ])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)
    const newMsgs = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMsgs)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 600,
          system: 'You are Customer Support AI for Rabt Naturals. Draft warm, empathetic, solution-focused replies for WhatsApp/Email/Instagram. Keep WhatsApp replies short (under 100 words). Always end with a positive closing.',
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setMessages([...newMsgs, { role: 'assistant', content: data.content?.[0]?.text || 'Error' }])
    } catch { toast.error('AI error') }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Customer <span style={{ color: 'var(--gold)' }}>Support</span></h1>
        <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>All channels · AI-powered replies</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Tickets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Open Tickets ({tickets.length})</div>
          {tickets.map((t, i) => (
            <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '13px 15px', cursor: 'pointer', transition: 'border-color 0.13s' }}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--b2)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--b1)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                <span style={{ fontSize: 18 }}>{t.ch}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t.channel}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: t.color + '22', color: t.color }}>{t.priority}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.45, marginBottom: 9 }}>{t.msg}</div>
              <button onClick={() => setInput('Draft reply for: ' + t.msg)} style={{ padding: '5px 12px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 7, color: '#08090C', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                AI Reply
              </button>
            </div>
          ))}
        </div>

        {/* AI Chat */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, display: 'flex', flexDirection: 'column', height: 600 }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--blL)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎧</div>
            <div>
              <div style={{ fontFamily: 'Syne', fontSize: 13.5, fontWeight: 800 }}>Support AI</div>
              <div style={{ fontSize: 10.5, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} /> Ready
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: m.role === 'user' ? 'rgba(255,255,255,0.07)' : 'var(--blL)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                  {m.role === 'user' ? '👤' : '🎧'}
                </div>
                <div style={{ maxWidth: '78%', padding: '9px 12px', borderRadius: 11, fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', background: m.role === 'user' ? 'linear-gradient(135deg,#D4A853,#B87C30)' : 'var(--s2)', color: m.role === 'user' ? '#08090C' : 'var(--tx)', fontWeight: m.role === 'user' ? 500 : 400 }}>{m.content}</div>
              </div>
            ))}
            {loading && <div style={{ display: 'flex', gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--blL)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎧</div><div style={{ padding: '10px 14px', background: 'var(--s2)', borderRadius: '11px 11px 11px 3px', display: 'flex', gap: 5 }}>{[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--mu)', animation: `pulse 1.2s ${i*0.2}s infinite` }} />)}</div></div>}
          </div>
          <div style={{ padding: '10px 13px', borderTop: '1px solid var(--b1)', display: 'flex', gap: 8 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} placeholder="Describe customer issue..." rows={2} style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 9, padding: '8px 11px', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'Outfit', outline: 'none', resize: 'none' }} />
            <button onClick={sendMessage} style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', cursor: 'pointer', fontSize: 14, alignSelf: 'flex-end' }}>➤</button>
          </div>
        </div>
      </div>
    </div>
  )
}
