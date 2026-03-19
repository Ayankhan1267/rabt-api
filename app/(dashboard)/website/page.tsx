'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'hero',         l: '🏠 Hero',          desc: 'Main banner content' },
  { id: 'testimonials', l: '⭐ Testimonials',   desc: 'Customer reviews' },
  { id: 'trust',        l: '🏆 Trust Badges',  desc: 'Stats & trust signals' },
  { id: 'seo',          l: '🔍 SEO',           desc: 'Meta tags & AI SEO' },
  { id: 'analytics',    l: '📊 Analytics',     desc: 'Traffic & performance' },
  { id: 'settings',     l: '⚙️ Settings',      desc: 'Links & general' },
]

const DEFAULT_CONTENT = {
  hero_badge: "India's First Pulses & Grains Skincare",
  hero_title: "Where Nature Bonds With Skin.",
  hero_subtitle: '"Rabt" — the timeless bond between skin and nature.',
  hero_desc: 'Discover your real skin type with our AI Skin Analysis and receive a personalised routine designed by our Skin Stylists.',
  hero_cta_primary: 'Know Your Skin →',
  hero_cta_secondary: 'Explore Products',
  hero_note: 'Free · 2 Minutes · 32 Skin Parameters',
  nav_cta: 'Know Your Skin',
  skin_analysis_url: 'https://rabtnaturals.com/skin-analysis',
  products_url: 'https://rabtnaturals.com/products',
  meta_title: 'Rabt Naturals – Know Your Skin | AI Skin Analysis',
  meta_desc: 'India\'s first pulses & grains skincare. Discover your real skin type with AI Skin Analysis and get a personalised routine by Skin Stylists.',
  meta_keywords: 'natural skincare, AI skin analysis, Indian skincare, pulses skincare, personalized skincare routine',
  trust_stat1_num: '10,000+',
  trust_stat1_label: 'Skin Profiles Created',
  trust_stat2_num: '98%',
  trust_stat2_label: 'Customer Satisfaction',
  trust_stat3_num: '50+',
  trust_stat3_label: 'Natural Ingredients',
  trust_stat4_num: '4.9★',
  trust_stat4_label: 'Average Rating',
}

const DEFAULT_TESTIMONIALS = [
  { name: 'Komal Singh', skin: 'Acne-Prone · Verified Buyer', quote: 'My skin is smoother and clearer than ever. I finally feel confident going makeup-free!', product: '🧴 Niacinamide Serum', image: 'https://rabtnaturals.com/testi2.jpg', stars: 5 },
  { name: 'Mukul Parmar', skin: 'Dry Hair · Verified Buyer', quote: 'Soft, shiny, and smells amazing! Highly recommend for anyone with damaged hair.', product: '💧 Hydrating Serum', image: 'https://rabtnaturals.com/testi1.jpg', stars: 5 },
  { name: 'Somya Jain', skin: 'Combination · Verified Buyer', quote: 'Perfect coverage without feeling heavy. Lasts all day even in humid weather!', product: '✨ Vitamin C Cream', image: 'https://rabtnaturals.com/testi3.jpg', stars: 5 },
  { name: 'Priya Sharma', skin: 'Oily Skin · Verified Buyer', quote: 'Oil control is incredible. My T-zone stays matte all day without drying out.', product: '🌿 Oats Moisturizer', image: 'https://rabtnaturals.com/testi2.jpg', stars: 5 },
  { name: 'Rahul Verma', skin: 'Sensitive · Verified Buyer', quote: 'Zero irritation. My skin barrier feels stronger than it has in years.', product: '☀️ SPF 50+ Sunscreen', image: 'https://rabtnaturals.com/testi1.jpg', stars: 5 },
  { name: 'Anjali Mehta', skin: 'Dark Spots · Verified Buyer', quote: 'My dark spots faded within a month. The AI quiz recommended exactly what I needed.', product: '🔬 Alpha Arbutin Serum', image: 'https://rabtnaturals.com/testi3.jpg', stars: 5 },
]

export default function WebsiteManagerPage() {
  const [tab, setTab]               = useState('hero')
  const [mounted, setMounted]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [aiLoading, setAiLoading]   = useState(false)
  const [content, setContent]       = useState<Record<string, string>>(DEFAULT_CONTENT)
  const [testimonials, setTestimonials] = useState<any[]>(DEFAULT_TESTIMONIALS)
  const [editingTesti, setEditingTesti] = useState<any>(null)
  const [analytics, setAnalytics]   = useState<any>(null)

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    const { data: contentData } = await supabase.from('app_settings').select('value').eq('key', 'landing_content').single()
    const { data: testiData }   = await supabase.from('app_settings').select('value').eq('key', 'landing_testimonials').single()
    const { data: analyticsData } = await supabase.from('app_settings').select('value').eq('key', 'landing_analytics').single()
    if (contentData?.value) setContent({ ...DEFAULT_CONTENT, ...JSON.parse(contentData.value) })
    if (testiData?.value) setTestimonials(JSON.parse(testiData.value))
    if (analyticsData?.value) setAnalytics(JSON.parse(analyticsData.value))
  }

  async function saveContent() {
    setSaving(true)
    await supabase.from('app_settings').upsert({ key: 'landing_content', value: JSON.stringify(content) })
    toast.success('Content saved! ✅ Landing page update ho jayega.')
    setSaving(false)
  }

  async function saveTestimonials() {
    setSaving(true)
    await supabase.from('app_settings').upsert({ key: 'landing_testimonials', value: JSON.stringify(testimonials) })
    toast.success('Testimonials saved! ✅')
    setSaving(false)
  }

  async function deleteTestimonial(idx: number) {
    const updated = testimonials.filter((_, i) => i !== idx)
    setTestimonials(updated)
    await supabase.from('app_settings').upsert({ key: 'landing_testimonials', value: JSON.stringify(updated) })
    toast.success('Testimonial deleted!')
  }

  async function addTestimonial() {
    const newT = { name: 'New Customer', skin: 'Skin Type · Verified Buyer', quote: 'Amazing product!', product: '🌿 Product Name', image: '', stars: 5 }
    const updated = [...testimonials, newT]
    setTestimonials(updated)
    setEditingTesti(updated.length - 1)
  }

  async function uploadVideo(idx: number, file: File) {
    toast.loading('Video upload ho raha hai...', { id: 'upload' })
    try {
      const ext = file.name.split('.').pop()
      const path = `testimonials/video-${idx}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('landing-assets').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('landing-assets').getPublicUrl(path)
      const updated = testimonials.map((t, i) => i === idx ? { ...t, video_url: urlData.publicUrl } : t)
      setTestimonials(updated)
      await supabase.from('app_settings').upsert({ key: 'landing_testimonials', value: JSON.stringify(updated) })
      toast.success('Video uploaded! ✅', { id: 'upload' })
    } catch (e: any) {
      toast.error('Upload failed: ' + e.message, { id: 'upload' })
    }
  }

  async function uploadImage(idx: number, file: File) {
    toast.loading('Image upload ho rahi hai...', { id: 'img-upload' })
    try {
      const ext = file.name.split('.').pop()
      const path = `testimonials/img-${idx}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('landing-assets').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('landing-assets').getPublicUrl(path)
      const updated = testimonials.map((t, i) => i === idx ? { ...t, image: urlData.publicUrl } : t)
      setTestimonials(updated)
      await supabase.from('app_settings').upsert({ key: 'landing_testimonials', value: JSON.stringify(updated) })
      toast.success('Image uploaded! ✅', { id: 'img-upload' })
    } catch (e: any) {
      toast.error('Upload failed: ' + e.message, { id: 'img-upload' })
    }
  }

  async function generateAISEO() {
    setAiLoading(true)
    toast.loading('AI SEO generate kar raha hai...', { id: 'ai-seo' })
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Generate optimized SEO meta tags for a skincare brand landing page.
Brand: Rabt Naturals
Tagline: ${content.hero_title}
Description: ${content.hero_desc}
Keywords focus: natural skincare India, AI skin analysis, personalized skincare

Return ONLY a JSON object with these keys:
- meta_title (max 60 chars)
- meta_desc (max 160 chars)  
- meta_keywords (comma separated, 10 keywords)
- og_title
- og_desc
- schema_desc

No markdown, no explanation, just JSON.`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const seo = JSON.parse(clean)
      setContent(prev => ({ ...prev, ...seo }))
      toast.success('AI SEO generated! ✅', { id: 'ai-seo' })
    } catch {
      toast.error('AI error — manually fill karo', { id: 'ai-seo' })
    }
    setAiLoading(false)
  }

  async function generateAIContent(field: string) {
    setAiLoading(true)
    toast.loading('AI content generate kar raha hai...', { id: 'ai-content' })
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Write a compelling ${field} for Rabt Naturals skincare brand landing page.
Brand: India's first pulses & grains skincare
Target: Indian women 18-35
Tone: Premium, natural, trustworthy

Return ONLY the text, no explanation, no quotes.`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text?.trim() || ''
      setContent(prev => ({ ...prev, [field]: text }))
      toast.success('Content generated! ✅', { id: 'ai-content' })
    } catch {
      toast.error('AI error', { id: 'ai-content' })
    }
    setAiLoading(false)
  }

  const inp: any = {
    background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8,
    padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit',
    outline: 'none', width: '100%', marginBottom: 12,
  }

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Website <span style={{ color: 'var(--teal)' }}>Manager</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>care.rabtnaturals.com ka content manage karo</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="https://care.rabtnaturals.com" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', fontFamily: 'Outfit' }}>
            🔗 View Live
          </a>
          <button onClick={saveContent} disabled={saving} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#0097A7,#005F6A)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
            {saving ? '⏳ Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12.5,
            border: '1px solid ' + (tab === t.id ? 'rgba(0,151,167,0.3)' : 'var(--b1)'),
            background: tab === t.id ? 'rgba(0,151,167,0.1)' : 'var(--s2)',
            color: tab === t.id ? 'var(--teal)' : 'var(--mu2)',
            fontWeight: tab === t.id ? 700 : 500,
          }}>{t.l}</button>
        ))}
      </div>

      {/* HERO */}
      {tab === 'hero' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>🏠 Hero Section</div>

            {[
              { key: 'hero_badge',        l: 'Badge Text',      ph: "India's First..." },
              { key: 'hero_title',        l: 'Main Heading',    ph: 'Where Nature...' },
              { key: 'hero_subtitle',     l: 'Italic Subtitle', ph: '"Rabt" — ...' },
              { key: 'hero_cta_primary',  l: 'Primary Button',  ph: 'Know Your Skin →' },
              { key: 'hero_cta_secondary',l: 'Secondary Button',ph: 'Explore Products' },
              { key: 'hero_note',         l: 'Small Note',      ph: 'Free · 2 Minutes...' },
              { key: 'nav_cta',           l: 'Nav Button Text', ph: 'Know Your Skin' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase' }}>{f.l}</label>
                  <button onClick={() => generateAIContent(f.key)} disabled={aiLoading} style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(0,151,167,0.1)', border: 'none', borderRadius: 4, color: 'var(--teal)', cursor: 'pointer', fontWeight: 600 }}>✨ AI</button>
                </div>
                <input value={content[f.key] || ''} onChange={e => setContent(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={inp} />
              </div>
            ))}

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Hero Description</label>
              <textarea value={content.hero_desc || ''} onChange={e => setContent(p => ({ ...p, hero_desc: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Skin Analysis URL</label>
                <input value={content.skin_analysis_url || ''} onChange={e => setContent(p => ({ ...p, skin_analysis_url: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Products URL</label>
                <input value={content.products_url || ''} onChange={e => setContent(p => ({ ...p, products_url: e.target.value }))} style={inp} />
              </div>
            </div>

            <button onClick={saveContent} disabled={saving} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg,#0097A7,#005F6A)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Syne' }}>
              💾 Save Hero Content
            </button>
          </div>

          {/* Preview */}
          <div className="card" style={{ background: 'linear-gradient(135deg,#0A1414,#1A2828)', color: '#fff' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 12, fontWeight: 800, marginBottom: 16, color: '#8AACAC' }}>PREVIEW</div>
            <div style={{ fontSize: 10, padding: '4px 12px', borderRadius: 20, background: 'rgba(26,155,160,0.2)', color: '#A8DADC', display: 'inline-block', marginBottom: 14 }}>
              • {content.hero_badge}
            </div>
            <div style={{ fontFamily: 'Georgia', fontSize: 22, fontWeight: 500, lineHeight: 1.2, marginBottom: 8, color: '#fff' }}>
              {content.hero_title}
            </div>
            <div style={{ fontSize: 13, color: '#8AACAC', fontStyle: 'italic', marginBottom: 10 }}>{content.hero_subtitle}</div>
            <div style={{ fontSize: 11, color: '#4A6464', marginBottom: 16, lineHeight: 1.6 }}>{content.hero_desc}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '8px 14px', background: '#1A9BA0', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{content.hero_cta_primary}</span>
              <span style={{ padding: '8px 14px', border: '1px solid #1A9BA0', borderRadius: 20, fontSize: 11, color: '#A8DADC' }}>{content.hero_cta_secondary}</span>
            </div>
            <div style={{ fontSize: 10, color: '#4A6464', marginTop: 10 }}>✦ {content.hero_note}</div>
          </div>
        </div>
      )}

      {/* TESTIMONIALS */}
      {tab === 'testimonials' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>⭐ Customer Testimonials ({testimonials.length})</div>
            <button onClick={addTestimonial} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#0097A7,#005F6A)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Add Testimonial</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {testimonials.map((t, i) => (
              <div key={i} className="card" style={{ border: editingTesti === i ? '2px solid var(--teal)' : '1px solid var(--b1)' }}>
                {editingTesti === i ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: 'var(--teal)' }}>Editing...</div>
                    {[
                      { k: 'name',    l: 'Name',    ph: 'Customer Name' },
                      { k: 'skin',    l: 'Skin Type',ph: 'Oily · Verified Buyer' },
                      { k: 'quote',   l: 'Quote',   ph: 'Amazing product...' },
                      { k: 'product', l: 'Product', ph: '🌿 Product Name' },
                    ].map(f => (
                      <div key={f.k}>
                        <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3, display: 'block' }}>{f.l}</label>
                        <input value={t[f.k] || ''} onChange={e => {
                          const updated = testimonials.map((x, xi) => xi === i ? { ...x, [f.k]: e.target.value } : x)
                          setTestimonials(updated)
                        }} placeholder={f.ph} style={{ ...inp, marginBottom: 8 }} />
                      </div>
                    ))}

                    {/* Image Upload */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase' as const, marginBottom: 5 }}>Thumbnail Image</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {t.image && <img src={t.image} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' as const }} />}
                        <label style={{ flex: 1, padding: '8px 12px', background: 'var(--blL)', border: '1px dashed var(--blue)', borderRadius: 8, cursor: 'pointer', fontSize: 11, color: 'var(--blue)', fontWeight: 600, textAlign: 'center' as const }}>
                          📸 Upload Image
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if(e.target.files?.[0]) uploadImage(i, e.target.files[0]) }} />
                        </label>
                      </div>
                    </div>

                    {/* Video Upload */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase' as const, marginBottom: 5 }}>Video</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {t.video_url && <video src={t.video_url} style={{ width: 48, height: 64, borderRadius: 8, objectFit: 'cover' as const }} />}
                        <label style={{ flex: 1, padding: '8px 12px', background: 'rgba(139,92,246,0.1)', border: '1px dashed var(--purple)', borderRadius: 8, cursor: 'pointer', fontSize: 11, color: 'var(--purple)', fontWeight: 600, textAlign: 'center' as const }}>
                          🎥 Upload Video
                          <input type="file" accept="video/*" style={{ display: 'none' }} onChange={e => { if(e.target.files?.[0]) uploadVideo(i, e.target.files[0]) }} />
                        </label>
                      </div>
                      {t.video_url && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4 }}>✓ Video uploaded</div>}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingTesti(null); saveTestimonials() }} style={{ flex: 1, padding: '8px', background: 'var(--grL)', border: 'none', borderRadius: 7, color: 'var(--green)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingTesti(null)} style={{ padding: '8px 12px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 7, color: 'var(--mu)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{t.skin}</div>
                      </div>
                      <div style={{ color: 'var(--gold)', fontSize: 12 }}>{'★'.repeat(t.stars || 5)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--mu2)', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.5 }}>"{t.quote}"</div>
                    <div style={{ fontSize: 11, color: 'var(--teal)', marginBottom: 12 }}>{t.product}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingTesti(i)} style={{ flex: 1, padding: '6px', background: 'var(--blL)', border: 'none', borderRadius: 6, color: 'var(--blue)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>✏️ Edit</button>
                      <button onClick={() => deleteTestimonial(i)} style={{ padding: '6px 10px', background: 'var(--rdL)', border: 'none', borderRadius: 6, color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRUST */}
      {tab === 'trust' && (
        <div className="card">
          <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>🏆 Trust Badges & Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} style={{ background: 'var(--s2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', marginBottom: 10 }}>Stat {n}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Number</label>
                    <input value={content[`trust_stat${n}_num`] || ''} onChange={e => setContent(p => ({ ...p, [`trust_stat${n}_num`]: e.target.value }))} placeholder="10,000+" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Label</label>
                    <input value={content[`trust_stat${n}_label`] || ''} onChange={e => setContent(p => ({ ...p, [`trust_stat${n}_label`]: e.target.value }))} placeholder="Customers" style={inp} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={saveContent} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg,#0097A7,#005F6A)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Syne', marginTop: 16 }}>
            💾 Save Trust Section
          </button>
        </div>
      )}

      {/* SEO */}
      {tab === 'seo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>🔍 SEO Settings</div>
              <button onClick={generateAISEO} disabled={aiLoading} style={{ padding: '7px 14px', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {aiLoading ? '⏳ Generating...' : '✨ AI Generate SEO'}
              </button>
            </div>

            {[
              { key: 'meta_title',    l: 'Page Title',         ph: 'Rabt Naturals – ...', max: 60 },
              { key: 'meta_keywords', l: 'Keywords',            ph: 'natural skincare, ...' },
              { key: 'og_title',      l: 'OG Title',            ph: 'Social share title' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>
                  {f.l} {f.max && <span style={{ color: content[f.key]?.length > f.max ? 'var(--red)' : 'var(--mu)' }}>({content[f.key]?.length || 0}/{f.max})</span>}
                </label>
                <input value={content[f.key] || ''} onChange={e => setContent(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={inp} />
              </div>
            ))}

            {[
              { key: 'meta_desc', l: 'Meta Description', ph: 'Max 160 chars...', max: 160 },
              { key: 'og_desc',   l: 'OG Description',   ph: 'Social share desc...' },
              { key: 'schema_desc', l: 'Schema Description', ph: 'Structured data...' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>
                  {f.l} {f.max && <span style={{ color: content[f.key]?.length > f.max ? 'var(--red)' : 'var(--mu)' }}>({content[f.key]?.length || 0}/{f.max})</span>}
                </label>
                <textarea value={content[f.key] || ''} onChange={e => setContent(p => ({ ...p, [f.key]: e.target.value }))} rows={3} placeholder={f.ph} style={{ ...inp, resize: 'vertical' }} />
              </div>
            ))}

            <button onClick={saveContent} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Syne' }}>
              💾 Save SEO Settings
            </button>
          </div>

          {/* SEO Preview */}
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 10 }}>Google Preview</div>
              <div style={{ padding: '12px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
                <div style={{ fontSize: 11, color: '#006621', marginBottom: 2 }}>care.rabtnaturals.com</div>
                <div style={{ fontSize: 15, color: '#1a0dab', fontWeight: 400, marginBottom: 4, lineHeight: 1.3 }}>{content.meta_title || 'Page Title'}</div>
                <div style={{ fontSize: 12, color: '#545454', lineHeight: 1.5 }}>{(content.meta_desc || 'Meta description...').slice(0, 160)}</div>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 10 }}>SEO Score</div>
              {[
                { l: 'Title Length',   ok: content.meta_title?.length >= 30 && content.meta_title?.length <= 60 },
                { l: 'Meta Desc',      ok: content.meta_desc?.length >= 120 && content.meta_desc?.length <= 160 },
                { l: 'Keywords Set',   ok: !!content.meta_keywords },
                { l: 'OG Tags',        ok: !!content.og_title && !!content.og_desc },
                { l: 'Schema Markup',  ok: !!content.schema_desc },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--b1)' }}>
                  <span style={{ fontSize: 12 }}>{item.l}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: item.ok ? 'var(--green)' : 'var(--red)' }}>{item.ok ? '✓ Good' : '✗ Fix'}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: 'var(--teal)' }}>
                  {[content.meta_title?.length >= 30 && content.meta_title?.length <= 60, content.meta_desc?.length >= 120, !!content.meta_keywords, !!content.og_title, !!content.schema_desc].filter(Boolean).length * 20}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>SEO Score</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS */}
      {tab === 'analytics' && (
        <div>
          <div style={{ background: 'rgba(0,151,167,0.06)', border: '1px solid rgba(0,151,167,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>📊 Analytics Setup</div>
            <div style={{ fontSize: 12, color: 'var(--mu2)', lineHeight: 1.7 }}>
              Real-time analytics ke liye Google Analytics ya Plausible add karo landing page mein.<br />
              Ya Vercel Analytics use karo — automatically traffic track karta hai.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { l: 'Total Visits',    v: analytics?.total_visits || '—',    icon: '👁️', color: 'var(--teal)' },
              { l: 'Today',          v: analytics?.today_visits || '—',    icon: '📅', color: 'var(--blue)' },
              { l: 'Bounce Rate',    v: analytics?.bounce_rate || '—',     icon: '↩️', color: 'var(--orange)' },
              { l: 'Avg Load Time',  v: analytics?.load_time || '—',       icon: '⚡', color: 'var(--green)' },
              { l: 'Conversions',    v: analytics?.conversions || '—',     icon: '🎯', color: 'var(--gold)' },
              { l: 'Mobile Users',   v: analytics?.mobile_pct || '—',      icon: '📱', color: 'var(--purple)' },
            ].map((s, i) => (
              <div key={i} className="card">
                <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>{s.l}</div>
                <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.v}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Google Analytics / Plausible Setup</div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Google Analytics ID</label>
              <input value={content.ga_id || ''} onChange={e => setContent(p => ({ ...p, ga_id: e.target.value }))} placeholder="G-XXXXXXXXXX" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Plausible Domain</label>
              <input value={content.plausible_domain || ''} onChange={e => setContent(p => ({ ...p, plausible_domain: e.target.value }))} placeholder="care.rabtnaturals.com" style={inp} />
            </div>
            <button onClick={saveContent} style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#0097A7,#005F6A)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              💾 Save Analytics Settings
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && (
        <div className="card">
          <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>⚙️ General Settings</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'skin_analysis_url', l: 'Skin Analysis URL' },
              { key: 'products_url',      l: 'Products URL' },
              { key: 'consultation_url',  l: 'Consultation URL' },
              { key: 'whatsapp_number',   l: 'WhatsApp Number' },
              { key: 'instagram_url',     l: 'Instagram URL' },
              { key: 'ga_id',             l: 'Google Analytics ID' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>
                <input value={content[f.key] || ''} onChange={e => setContent(p => ({ ...p, [f.key]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          <button onClick={saveContent} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 10, color: '#08090C', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Syne', marginTop: 8 }}>
            💾 Save Settings
          </button>
        </div>
      )}
    </div>
  )
}
