'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const CATEGORIES = ['SOP', 'Script', 'Skin Science', 'Brand', 'Ingredient', 'Supplier', 'Content', 'Finance', 'Other']
const CAT_ICONS: Record<string, string> = {
  SOP: '⚙️', Script: '💬', 'Skin Science': '🧬', Brand: '📢', Ingredient: '🧪',
  Supplier: '📦', Content: '🎬', Finance: '💰', Other: '📄'
}

export default function KnowledgePage() {
  const [docs, setDocs] = useState<any[]>([])
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [form, setForm] = useState({ title: '', content: '', category: 'SOP', tags: '' })

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    const { data } = await supabase.from('knowledge_docs').select('*, created_by(name)').order('created_at', { ascending: false })
    setDocs(data || [])
  }

  async function saveDoc() {
    if (!form.title || !form.content) { toast.error('Fill required fields'); return }
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('knowledge_docs').insert({
      title: form.title, content: form.content, category: form.category,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
      created_by: user?.id, updated_by: user?.id,
    })
    toast.success('Document added!')
    setShowAdd(false)
    setForm({ title: '', content: '', category: 'SOP', tags: '' })
    loadDocs()
  }

  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return
    await supabase.from('knowledge_docs').delete().eq('id', id)
    toast.success('Deleted')
    if (selectedDoc?.id === id) setSelectedDoc(null)
    loadDocs()
  }

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.content?.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'All' || d.category === catFilter
    return matchSearch && matchCat
  })

  const inputStyle: any = {
    width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8,
    padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Knowledge <span style={{ color: 'var(--gold)' }}>Base</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{docs.length} documents · SOPs, Scripts, Guides</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
          + New Doc
        </button>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search documents..." style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer' }}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedDoc ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 14 }}>
        {/* Docs List */}
        <div style={{ gridColumn: selectedDoc ? '1' : '1/-1', display: 'grid', gridTemplateColumns: selectedDoc ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
          {filtered.map(doc => (
            <div key={doc.id} onClick={() => setSelectedDoc(doc === selectedDoc ? null : doc)} style={{
              background: 'var(--s1)', border: `1px solid ${selectedDoc?.id === doc.id ? 'var(--gold)' : 'var(--b1)'}`,
              borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.13s',
            }}
              onMouseOver={e => { if (selectedDoc?.id !== doc.id) e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'var(--gL)' }}
              onMouseOut={e => { if (selectedDoc?.id !== doc.id) e.currentTarget.style.borderColor = 'var(--b1)'; e.currentTarget.style.background = 'var(--s1)' }}
            >
              <div style={{ fontSize: 24, marginBottom: 10 }}>{CAT_ICONS[doc.category] || '📄'}</div>
              <div style={{ fontFamily: 'Syne', fontSize: 13.5, fontWeight: 800, marginBottom: 5 }}>{doc.title}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{doc.category}</div>
              <div style={{ fontSize: 12, color: 'var(--mu2)', lineHeight: 1.45, marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {doc.content}
              </div>
              {doc.tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {doc.tags.map((tag: string, i: number) => (
                    <span key={i} style={{ fontSize: 9.5, padding: '1px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', color: 'var(--mu2)', fontWeight: 600 }}>{tag}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--mu)' }}>{doc.created_by?.name || 'Team'}</span>
                <button onClick={e => { e.stopPropagation(); deleteDoc(doc.id) }} style={{ padding: '2px 8px', background: 'var(--rdL)', border: 'none', borderRadius: 5, color: 'var(--red)', fontSize: 10, cursor: 'pointer', fontFamily: 'Outfit' }}>Delete</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <div>{search ? 'No results found' : 'No documents yet'}</div>
            </div>
          )}
        </div>

        {/* Doc Detail */}
        {selectedDoc && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: '20px', height: 'fit-content', position: 'sticky', top: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>{selectedDoc.title}</div>
              <button onClick={() => setSelectedDoc(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--gL)', color: 'var(--gold)', fontWeight: 700 }}>{selectedDoc.category}</span>
              {selectedDoc.tags?.map((t: string, i: number) => <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', color: 'var(--mu2)', fontWeight: 600 }}>{t}</span>)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mu2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: 400 }}>
              {selectedDoc.content}
            </div>
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--mu)' }}>
              By {selectedDoc.created_by?.name || 'Team'} · {new Date(selectedDoc.created_at).toLocaleDateString('en-IN')}
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 560, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>📄 New Document</div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Title*</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Document title" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Tags (comma separated)</label>
                <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="SOP, WhatsApp, Support" style={inputStyle} />
              </div>
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Content*</label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Write your document content here..." rows={8} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={saveDoc} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Save Document</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
