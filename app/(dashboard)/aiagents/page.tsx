'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

const AGENTS = [
  {
    id: 'marketing',
    name: 'Marketing AI',
    icon: '📢',
    color: 'var(--blue)',
    description: 'Ad copies, campaigns, ROAS optimization',
    system: `You are Marketing AI for Rabt Naturals, a premium Indian D2C skincare brand in Indore. 
Products: Moong Magic (brightening/acne), Masoor Glow (anti-pigmentation), Oats Care (hydrating/sensitive), Eye Pulse Cream, Ratiol Facewash & Serum.
Target: Indian women 18-40. Platforms: Meta, Google, Instagram.
Help with: ad copies, campaign strategy, audience targeting, ROAS optimization, A/B testing. Be specific, data-driven, actionable.`,
    suggestions: ['Write Meta ad copy for Moong Magic', 'Best audience targeting for skincare', 'How to improve ROAS from 2x to 4x', 'Create WhatsApp broadcast message'],
  },
  {
    id: 'content',
    name: 'Content AI',
    icon: '🎬',
    color: 'var(--purple)',
    description: 'Reels scripts, hooks, captions, UGC',
    system: `You are Content AI for Rabt Naturals, Indian D2C skincare brand.
Create viral Instagram Reels scripts, hooks, captions, UGC ideas. 
Products: Moong Magic, Masoor Glow, Oats Care, Eye Pulse, Ratiol.
Tone: Educational but like a desi best friend. Hindi/English mix is fine.
Focus: Hook first 3 seconds, storytelling, CTA at end. Include trending audio suggestions.`,
    suggestions: ['Write Reel script for Moong Magic Serum', 'Hook for acne transformation video', 'Instagram caption for skin routine', '5 viral content ideas for March'],
  },
  {
    id: 'sales',
    name: 'Sales AI',
    icon: '💬',
    color: 'var(--green)',
    description: 'WhatsApp replies, lead conversion, product recommendation',
    system: `You are Sales AI for Rabt Naturals. Handle customer inquiries on WhatsApp/Instagram.
Products: Moong Magic (oily/acne, ₹349-599), Masoor Glow (pigmentation, ₹299-599), Oats Care (dry/sensitive, ₹299-649), Eye Pulse Cream, Ratiol Facewash/Serum.
Tone: Warm, consultative, like a knowledgeable friend. Keep responses SHORT for WhatsApp.
Always: Understand skin concern → Recommend specific product → Share price → Ask if they want to order.`,
    suggestions: ['Customer says skin is oily with acne', 'Customer asking about pigmentation', 'Follow up message for cold lead', 'Handle price objection'],
  },
  {
    id: 'specialist',
    name: 'Specialist AI',
    icon: '🌿',
    color: 'var(--pink)',
    description: 'Skin analysis, routines, ingredient science',
    system: `You are Skin Specialist AI for Rabt Naturals. Expert in Indian skin types and Ayurvedic ingredients.
Products: Moong Magic (Moong Dal/Green Gram extract - brightening, anti-acne), Masoor Glow (Masoor/Red Lentil - anti-pigmentation), Oats Care (Oats - soothing, hydrating).
Key ingredients: Niacinamide, Alpha Arbutin, Salicylic Acid, Centella Asiatica, Sodium Hyaluronate.
Create personalized routines (AM/PM), explain ingredients, analyze skin concerns scientifically.`,
    suggestions: ['AM/PM routine for oily acne-prone skin', 'Explain Niacinamide + Vitamin C', 'Routine for hyperpigmentation', 'Ingredients for sensitive skin'],
  },
  {
    id: 'support',
    name: 'Support AI',
    icon: '🎧',
    color: 'var(--teal)',
    description: 'Customer complaints, returns, tracking queries',
    system: `You are Customer Support AI for Rabt Naturals. Handle complaints, returns, tracking queries.
Always be empathetic and solution-focused. Draft ready-to-send WhatsApp/Email messages.
Common issues: Delivery delays, wrong product, allergic reaction, return requests.
Format: Short, warm, professional. Include next steps clearly.`,
    suggestions: ['Customer says order not delivered in 7 days', 'Customer wants to return product', 'Customer had allergic reaction', 'Tracking number not working'],
  },
  {
    id: 'finance',
    name: 'Finance AI',
    icon: '💰',
    color: 'var(--gold)',
    description: 'P&L analysis, cost optimization, pricing strategy',
    system: `You are Finance AI for Rabt Naturals. Help with financial decisions.
Business: D2C skincare, India. Current: ~₹50K/month revenue, 3.7x ROAS.
Products priced ₹299-649. Main costs: Ad spend, shipping (₹60-80), raw materials.
Help with: Pricing strategy, margin analysis, cost cutting, P&L interpretation, break-even analysis.`,
    suggestions: ['Analyze my ₹50K revenue with ₹30K expenses', 'Optimal pricing for new product at ₹200 cost', 'How to improve profit margin', 'Break-even analysis for ₹5K ad spend'],
  },
]

interface Message { role: 'user' | 'assistant'; content: string }

export default function AIAgentsPage() {
  const [activeAgent, setActiveAgent] = useState(AGENTS[0])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const currentMessages = messages[activeAgent.id] || [
    { role: 'assistant', content: `Hi! I'm ${activeAgent.name} for Rabt Naturals. ${activeAgent.description}. How can I help you today?` }
  ]

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)

    const newMessages: Message[] = [...currentMessages, { role: 'user', content: userMsg }]
    setMessages(prev => ({ ...prev, [activeAgent.id]: newMessages }))

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          system: activeAgent.system,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'Could not process. Try again.'
      setMessages(prev => ({
        ...prev,
        [activeAgent.id]: [...newMessages, { role: 'assistant', content: reply }]
      }))
    } catch {
      toast.error('AI error. Check API key.')
      setMessages(prev => ({
        ...prev,
        [activeAgent.id]: [...newMessages, { role: 'assistant', content: '❌ Connection error. Check ANTHROPIC_API_KEY in .env.local' }]
      }))
    }
    setLoading(false)
  }

  function clearChat() {
    setMessages(prev => ({ ...prev, [activeAgent.id]: [] }))
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 16 }}>
      {/* Agent Selector */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 4 }}>AI <span style={{ color: 'var(--gold)' }}>Agents</span></div>
        {AGENTS.map(agent => (
          <div key={agent.id} onClick={() => setActiveAgent(agent)} style={{
            background: activeAgent.id === agent.id ? agent.color + '18' : 'var(--s1)',
            border: `1px solid ${activeAgent.id === agent.id ? agent.color + '44' : 'var(--b1)'}`,
            borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.13s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{agent.icon}</span>
              <span style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, color: activeAgent.id === agent.id ? agent.color : 'var(--tx)' }}>{agent.name}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.4 }}>{agent.description}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'var(--grL)', color: 'var(--green)', fontWeight: 700 }}>● Live</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: activeAgent.color + '18', border: `1px solid ${activeAgent.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {activeAgent.icon}
          </div>
          <div>
            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, color: activeAgent.color }}>{activeAgent.name}</div>
            <div style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} /> Live · Claude Sonnet
            </div>
          </div>
          <button onClick={clearChat} style={{ marginLeft: 'auto', padding: '5px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 7, color: 'var(--mu2)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
            Clear
          </button>
        </div>

        {/* Suggestions */}
        {currentMessages.length <= 1 && (
          <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {activeAgent.suggestions.map((s, i) => (
              <button key={i} onClick={() => { setInput(s); }} style={{
                padding: '5px 12px', background: activeAgent.color + '11', border: `1px solid ${activeAgent.color}33`,
                borderRadius: 20, color: activeAgent.color, fontSize: 11.5, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 500
              }}>{s}</button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {currentMessages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 2,
                background: msg.role === 'user' ? 'rgba(255,255,255,0.07)' : activeAgent.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13
              }}>
                {msg.role === 'user' ? '👤' : activeAgent.icon}
              </div>
              <div style={{
                maxWidth: '76%', padding: '10px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.55,
                background: msg.role === 'user' ? 'linear-gradient(135deg,#D4A853,#B87C30)' : 'var(--s2)',
                color: msg.role === 'user' ? '#08090C' : 'var(--tx)',
                fontWeight: msg.role === 'user' ? 500 : 400,
                borderBottomRightRadius: msg.role === 'user' ? 3 : 12,
                borderBottomLeftRadius: msg.role === 'assistant' ? 3 : 12,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: activeAgent.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{activeAgent.icon}</div>
              <div style={{ padding: '12px 15px', background: 'var(--s2)', borderRadius: '12px 12px 12px 3px', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mu)', animation: `pulse 1.2s ${delay}s infinite` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--b1)', display: 'flex', gap: 9 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={`Ask ${activeAgent.name}... (Enter to send)`}
            rows={2}
            style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 10, padding: '9px 13px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', resize: 'none' }}
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()} style={{
            width: 44, height: 44, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: loading || !input.trim() ? 'rgba(212,168,83,0.3)' : `linear-gradient(135deg,${activeAgent.color},${activeAgent.color}aa)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.13s',
            alignSelf: 'flex-end',
          }}>➤</button>
        </div>
      </div>
    </div>
  )
}
