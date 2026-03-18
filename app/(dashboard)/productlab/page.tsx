'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const RANGES = ['Moong Magic', 'Masoor Glow', 'Oats Care', 'Standalone']
const PRODUCT_TYPES = ['Cleanser', 'Toner', 'Serum', 'Moisturizer', 'Sunscreen', 'Under-Eye Cream', 'Facewash']
const STATUSES = ['Active', 'Development', 'Testing', 'Discontinued', 'Planned']

// Rabt Naturals — All 18 Products
const DEFAULT_PRODUCTS = [
  // Moong Magic Range
  { name: 'Moong Magic Cleanser', range: 'Moong Magic', type: 'Cleanser', price: 0, cost: 0, status: 'Active', sku: 'MM-CL-01', description: 'Gentle foaming cleanser with Moong Dal extract', keyIngredients: 'Moong Dal Extract, Niacinamide, Glycerin, Salicylic Acid', benefits: 'Deep cleansing, pore minimizing, oil control', targetConcern: 'Acne, Oily Skin' },
  { name: 'Moong Magic Toner', range: 'Moong Magic', type: 'Toner', price: 0, cost: 0, status: 'Active', sku: 'MM-TO-01', description: 'Balancing toner with Alpha Arbutin & Green Tea', keyIngredients: 'Alpha Arbutin, Green Tea Extract, Niacinamide, Centella Asiatica', benefits: 'Pore tightening, brightening, hydrating', targetConcern: 'Uneven tone, Large pores' },
  { name: 'Moong Magic Serum', range: 'Moong Magic', type: 'Serum', price: 0, cost: 0, status: 'Active', sku: 'MM-SR-01', description: 'Brightening & anti-acne serum', keyIngredients: 'Water, Niacinamide, Glycerin, Butylene Glycol, Alpha Arbutin, Beta Arbutin, Carbomer, Caprylyl Glycol, Pentylene Glycol, Moong Dal (Vigna radiata) Extract, Green Tea (Camellia sinensis) Extract, Salicylic Acid, Disodium EDTA, Panthenol (Vitamin B5), Centella Asiatica (CICA) Extract, Vaccinium Angustifolium (Blueberry) Fruit Extract, Rubus Fruticosus (Blackberry) Fruit Extract, Coconut Acid, 1,2-Hexanediol, Proline, Sodium Hyaluronate, Citrullus Lanatus (Watermelon) Fruit Extract', benefits: 'Brightening, acne reduction, hydration', targetConcern: 'Acne, Pigmentation, Dull skin' },
  { name: 'Moong Magic Moisturizer', range: 'Moong Magic', type: 'Moisturizer', price: 0, cost: 0, status: 'Active', sku: 'MM-MO-01', description: 'Lightweight gel moisturizer for oily skin', keyIngredients: 'Moong Dal Extract, Hyaluronic Acid, Niacinamide, Aloe Vera', benefits: 'Lightweight hydration, oil control, mattifying', targetConcern: 'Oily skin, Acne' },
  { name: 'Moong Magic Sunscreen', range: 'Moong Magic', type: 'Sunscreen', price: 0, cost: 0, status: 'Active', sku: 'MM-SS-01', description: 'SPF 50 PA++++ broad spectrum sunscreen', keyIngredients: 'Zinc Oxide, Titanium Dioxide, Moong Dal Extract, Niacinamide', benefits: 'UV protection, no white cast, lightweight', targetConcern: 'Sun damage, Tanning' },
  // Masoor Glow Range
  { name: 'Masoor Glow Cleanser', range: 'Masoor Glow', type: 'Cleanser', price: 0, cost: 0, status: 'Active', sku: 'MG-CL-01', description: 'Brightening cleanser with Red Lentil extract', keyIngredients: 'Masoor Dal Extract, Vitamin C, Kojic Acid, Glycerin', benefits: 'Brightening, anti-oxidant, gentle cleanse', targetConcern: 'Dull skin, Pigmentation' },
  { name: 'Masoor Glow Toner', range: 'Masoor Glow', type: 'Toner', price: 0, cost: 0, status: 'Active', sku: 'MG-TO-01', description: 'Glow-enhancing toner', keyIngredients: 'Masoor Dal Extract, Vitamin C, Rose Water, Hyaluronic Acid', benefits: 'Instant glow, hydration, brightening', targetConcern: 'Dull skin, Hyperpigmentation' },
  { name: 'Masoor Glow Serum', range: 'Masoor Glow', type: 'Serum', price: 0, cost: 0, status: 'Active', sku: 'MG-SR-01', description: 'Vitamin C brightening serum', keyIngredients: 'Masoor Dal Extract, Vitamin C, Alpha Arbutin, Ferulic Acid', benefits: 'Brightening, anti-aging, even tone', targetConcern: 'Dark spots, Pigmentation, Dull skin' },
  { name: 'Masoor Glow Moisturizer', range: 'Masoor Glow', type: 'Moisturizer', price: 0, cost: 0, status: 'Active', sku: 'MG-MO-01', description: 'Glow-boosting moisturizer', keyIngredients: 'Masoor Dal Extract, Squalane, Vitamin E, Ceramides', benefits: 'Deep hydration, natural glow, softening', targetConcern: 'Dry skin, Dull complexion' },
  { name: 'Masoor Glow Sunscreen', range: 'Masoor Glow', type: 'Sunscreen', price: 0, cost: 0, status: 'Active', sku: 'MG-SS-01', description: 'Glow-finish SPF 50 sunscreen', keyIngredients: 'Zinc Oxide, Masoor Dal Extract, Vitamin C, Hyaluronic Acid', benefits: 'UV protection, glow finish, brightening', targetConcern: 'Sun damage, Dull skin' },
  // Oats Care Range
  { name: 'Oats Care Cleanser', range: 'Oats Care', type: 'Cleanser', price: 0, cost: 0, status: 'Active', sku: 'OC-CL-01', description: 'Ultra-gentle oat milk cleanser for sensitive skin', keyIngredients: 'Colloidal Oatmeal, Oat Milk, Ceramides, Panthenol', benefits: 'Gentle cleanse, barrier repair, soothing', targetConcern: 'Sensitive skin, Dryness, Redness' },
  { name: 'Oats Care Toner', range: 'Oats Care', type: 'Toner', price: 0, cost: 0, status: 'Active', sku: 'OC-TO-01', description: 'Calming hydrating toner', keyIngredients: 'Colloidal Oatmeal, Aloe Vera, Calendula, Hyaluronic Acid', benefits: 'Calming, deep hydration, barrier support', targetConcern: 'Sensitive skin, Dehydration' },
  { name: 'Oats Care Serum', range: 'Oats Care', type: 'Serum', price: 0, cost: 0, status: 'Active', sku: 'OC-SR-01', description: 'Barrier repair serum for sensitive skin', keyIngredients: 'Colloidal Oatmeal, Ceramides, Hyaluronic Acid, Centella Asiatica', benefits: 'Barrier repair, anti-inflammatory, deep hydration', targetConcern: 'Sensitive skin, Compromised barrier' },
  { name: 'Oats Care Moisturizer', range: 'Oats Care', type: 'Moisturizer', price: 0, cost: 0, status: 'Active', sku: 'OC-MO-01', description: 'Rich barrier-repair cream', keyIngredients: 'Colloidal Oatmeal, Shea Butter, Ceramides, Squalane', benefits: 'Intense hydration, barrier repair, non-irritating', targetConcern: 'Dry skin, Eczema, Sensitive skin' },
  { name: 'Oats Care Sunscreen', range: 'Oats Care', type: 'Sunscreen', price: 0, cost: 0, status: 'Active', sku: 'OC-SS-01', description: 'Mineral SPF 50 for sensitive skin', keyIngredients: 'Zinc Oxide, Colloidal Oatmeal, Ceramides, Aloe Vera', benefits: 'Gentle UV protection, soothing, barrier support', targetConcern: 'Sensitive skin, Sun sensitivity' },
  // Standalone
  { name: 'Eye Pulse', range: 'Standalone', type: 'Under-Eye Cream', price: 0, cost: 0, status: 'Active', sku: 'SA-EP-01', description: 'Advanced under-eye cream for dark circles & puffiness', keyIngredients: 'Caffeine, Peptides, Vitamin K, Hyaluronic Acid, Retinol', benefits: 'Dark circle reduction, depuffing, anti-aging', targetConcern: 'Dark circles, Puffiness, Fine lines' },
  { name: 'Ratiol Facewash', range: 'Standalone', type: 'Facewash', price: 0, cost: 0, status: 'Active', sku: 'SA-RF-01', description: 'Retinol-powered anti-aging facewash', keyIngredients: 'Retinol, Glycolic Acid, Hyaluronic Acid, Ceramides', benefits: 'Anti-aging, cell renewal, brightening', targetConcern: 'Aging, Fine lines, Dullness' },
  { name: 'Ratiol Serum', range: 'Standalone', type: 'Serum', price: 0, cost: 0, status: 'Active', sku: 'SA-RS-01', description: 'Retinol anti-aging serum', keyIngredients: 'Retinol, Peptides, Niacinamide, Hyaluronic Acid, Vitamin E', benefits: 'Anti-aging, wrinkle reduction, skin renewal', targetConcern: 'Fine lines, Wrinkles, Aging' },
]

const RANGE_COLORS: Record<string, string> = {
  'Moong Magic': 'var(--green)',
  'Masoor Glow': 'var(--orange)',
  'Oats Care': 'var(--teal)',
  'Standalone': 'var(--purple)',
}
const RANGE_BG: Record<string, string> = {
  'Moong Magic': 'var(--grL)',
  'Masoor Glow': 'var(--orL)',
  'Oats Care': 'rgba(20,184,166,0.15)',
  'Standalone': 'rgba(139,92,246,0.15)',
}

export default function ProductLabPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<'catalog'|'analytics'|'costing'>('catalog')
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [rangeFilter, setRangeFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({ name: '', range: 'Moong Magic', type: 'Serum', price: 0, cost: 0, status: 'Active', sku: '', description: '', keyIngredients: '', benefits: '', targetConcern: '', moq: 0, stock: 0, supplier: '', notes: '' })

  useEffect(() => { setMounted(true); loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    try {
      const { data } = await supabase.from('product_lab').select('*').order('range').order('type')
      if (data && data.length > 0) {
        setProducts(data)
      } else {
        // Seed with default products
        const { data: inserted } = await supabase.from('product_lab').insert(DEFAULT_PRODUCTS).select()
        setProducts(inserted || DEFAULT_PRODUCTS)
      }
    } catch { setProducts(DEFAULT_PRODUCTS); toast.error('Using local data') }
    setLoading(false)
  }

  async function saveProduct() {
    if (!form.name) { toast.error('Name required'); return }
    try {
      if (editing && selected) {
        const { error } = await supabase.from('product_lab').update(form).eq('id', selected.id)
        if (error) throw error
        toast.success('Updated!')
      } else {
        const { error } = await supabase.from('product_lab').insert(form)
        if (error) throw error
        toast.success('Product added!')
      }
      setShowAdd(false); setEditing(false); setSelected(null)
      setForm({ name: '', range: 'Moong Magic', type: 'Serum', price: 0, cost: 0, status: 'Active', sku: '', description: '', keyIngredients: '', benefits: '', targetConcern: '', moq: 0, stock: 0, supplier: '', notes: '' })
      loadProducts()
    } catch (e: any) { toast.error(e.message) }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete product?')) return
    await supabase.from('product_lab').delete().eq('id', id)
    setSelected(null); loadProducts(); toast.success('Deleted!')
  }

  async function updateField(id: string, key: string, val: any) {
    await supabase.from('product_lab').update({ [key]: val }).eq('id', id)
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [key]: val } : p))
    if (selected?.id === id) setSelected((s: any) => ({ ...s, [key]: val }))
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.keyIngredients?.toLowerCase().includes(search.toLowerCase())
    const matchRange = rangeFilter === 'all' || p.range === rangeFilter
    return matchSearch && matchRange
  })

  // Analytics
  const totalProducts = products.length
  const activeProducts = products.filter(p => p.status === 'Active').length
  const avgMargin = products.filter(p => p.price > 0 && p.cost > 0).length > 0
    ? Math.round(products.filter(p => p.price > 0 && p.cost > 0).reduce((s, p) => s + ((p.price - p.cost) / p.price * 100), 0) / products.filter(p => p.price > 0 && p.cost > 0).length)
    : 0
  const totalRevPotential = products.reduce((s, p) => s + (p.price || 0), 0)
  const rangeCounts = RANGES.reduce((a, r) => { a[r] = products.filter(p => p.range === r).length; return a }, {} as Record<string, number>)

  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Product <span style={{ color: 'var(--gold)' }}>Lab</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{totalProducts} products · {activeProducts} active · 3 ranges + standalones</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setEditing(false); setShowAdd(true) }} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>+ Add Product</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Products', value: totalProducts, color: 'var(--blue)' },
          { label: 'Active', value: activeProducts, color: 'var(--green)' },
          { label: 'Moong Magic', value: rangeCounts['Moong Magic'] || 0, color: 'var(--green)' },
          { label: 'Masoor Glow', value: rangeCounts['Masoor Glow'] || 0, color: 'var(--orange)' },
          { label: 'Oats Care', value: rangeCounts['Oats Care'] || 0, color: 'var(--teal)' },
          { label: 'Avg Margin', value: avgMargin + '%', color: 'var(--gold)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[{id:'catalog',l:'🧴 Catalog'},{id:'analytics',l:'📊 Analytics'},{id:'costing',l:'💰 Costing'}].map(t => (
          <button key={t.id} onClick={() => setView(t.id as any)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', background: view === t.id ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: view === t.id ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (view === t.id ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* CATALOG VIEW */}
      {view === 'catalog' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or ingredient..." style={{ ...inp, marginBottom: 0, flex: 1, minWidth: 200 }} />
            <div style={{ display: 'flex', gap: 4, background: 'var(--s2)', borderRadius: 8, padding: 4 }}>
              {['all', ...RANGES].map(r => (
                <button key={r} onClick={() => setRangeFilter(r)} style={{ padding: '5px 12px', borderRadius: 6, background: rangeFilter === r ? 'var(--s1)' : 'transparent', border: 'none', color: rangeFilter === r ? (RANGE_COLORS[r] || 'var(--gold)') : 'var(--mu)', fontWeight: rangeFilter === r ? 700 : 500, fontSize: 11.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
                  {r === 'all' ? 'All' : r}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 16, alignItems: 'start' }}>
              {/* Product Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Product','Range','Type','Price','Cost','Margin','Status','Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => {
                      const margin = p.price > 0 && p.cost > 0 ? Math.round((p.price - p.cost) / p.price * 100) : null
                      const isSelected = selected?.id === p.id || selected?.name === p.name
                      return (
                        <tr key={i} onClick={() => setSelected(isSelected ? null : p)} style={{ cursor: 'pointer', background: isSelected ? 'var(--gL)' : 'transparent' }}
                          onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.018)' }}
                          onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>{p.sku}</div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: RANGE_BG[p.range] || 'var(--s2)', color: RANGE_COLORS[p.range] || 'var(--mu)' }}>{p.range}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--mu2)' }}>{p.type}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>
                            {p.price > 0 ? '₹' + p.price : <span style={{ color: 'var(--mu)' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontSize: 12, color: 'var(--teal)' }}>
                            {p.cost > 0 ? '₹' + p.cost : <span style={{ color: 'var(--mu)' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {margin !== null ? (
                              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'DM Mono', color: margin >= 60 ? 'var(--green)' : margin >= 40 ? 'var(--gold)' : 'var(--red)' }}>{margin}%</span>
                            ) : <span style={{ color: 'var(--mu)', fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <select value={p.status} onClick={e => e.stopPropagation()} onChange={e => updateField(p.id || p.name, 'status', e.target.value)} style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 6, padding: '3px 8px', fontSize: 10.5, cursor: 'pointer', outline: 'none', fontFamily: 'Outfit', color: p.status === 'Active' ? 'var(--green)' : p.status === 'Discontinued' ? 'var(--red)' : 'var(--gold)' }}>
                              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setForm({ ...p }); setEditing(true); setShowAdd(true) }} style={{ padding: '3px 8px', background: 'var(--blL)', border: 'none', borderRadius: 5, color: 'var(--blue)', fontSize: 10.5, cursor: 'pointer' }}>Edit</button>
                              {p.id && <button onClick={() => deleteProduct(p.id)} style={{ padding: '3px 8px', background: 'var(--rdL)', border: 'none', borderRadius: 5, color: 'var(--red)', fontSize: 10.5, cursor: 'pointer' }}>Del</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No products found</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Detail Panel */}
              {selected && (
                <div style={{ position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>{selected.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{selected.sku} · {selected.type}</div>
                    </div>
                    <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                  </div>

                  <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: RANGE_BG[selected.range] || 'var(--s2)', color: RANGE_COLORS[selected.range] || 'var(--mu)', display: 'inline-block', marginBottom: 14 }}>{selected.range}</span>

                  {/* Price & Cost inline edit */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>MRP</div>
                      <input type="number" defaultValue={selected.price || 0} onBlur={e => updateField(selected.id || selected.name, 'price', Number(e.target.value))} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', fontFamily: 'Syne', fontSize: 18, fontWeight: 800, width: '100%', outline: 'none' }} placeholder="₹0" />
                    </div>
                    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>Cost</div>
                      <input type="number" defaultValue={selected.cost || 0} onBlur={e => updateField(selected.id || selected.name, 'cost', Number(e.target.value))} style={{ background: 'transparent', border: 'none', color: 'var(--teal)', fontFamily: 'Syne', fontSize: 18, fontWeight: 800, width: '100%', outline: 'none' }} placeholder="₹0" />
                    </div>
                    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>Margin</div>
                      <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: selected.price > 0 && selected.cost > 0 ? (((selected.price - selected.cost)/selected.price*100) >= 60 ? 'var(--green)' : 'var(--gold)') : 'var(--mu)' }}>
                        {selected.price > 0 && selected.cost > 0 ? Math.round((selected.price - selected.cost) / selected.price * 100) + '%' : '—'}
                      </div>
                    </div>
                  </div>

                  {selected.description && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Description</div>
                      <div style={{ fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6, background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>{selected.description}</div>
                    </div>
                  )}

                  {selected.keyIngredients && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7 }}>Key Ingredients</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {selected.keyIngredients.split(',').slice(0, 15).map((ing: string, i: number) => (
                          <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--gL)', color: 'var(--gold)', fontWeight: 600 }}>{ing.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.benefits && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Benefits</div>
                      <div style={{ fontSize: 12.5, color: 'var(--mu2)', background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>{selected.benefits}</div>
                    </div>
                  )}

                  {selected.targetConcern && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 5 }}>Target Concerns</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {selected.targetConcern.split(',').map((c: string, i: number) => (
                          <span key={i} style={{ fontSize: 10.5, padding: '3px 10px', borderRadius: 20, background: 'var(--orL)', color: 'var(--orange)', fontWeight: 600 }}>{c.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selected.stock > 0 || selected.moq > 0 || selected.supplier) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      {selected.stock > 0 && <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 12px' }}><div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>Stock</div><div style={{ fontSize: 14, fontWeight: 700 }}>{selected.stock} units</div></div>}
                      {selected.moq > 0 && <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 12px' }}><div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>MOQ</div><div style={{ fontSize: 14, fontWeight: 700 }}>{selected.moq} units</div></div>}
                      {selected.supplier && <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 12px', gridColumn: '1/-1' }}><div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>Supplier</div><div style={{ fontSize: 13, fontWeight: 600 }}>{selected.supplier}</div></div>}
                    </div>
                  )}

                  {selected.notes && (
                    <div style={{ background: 'var(--gL)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.6 }}>{selected.notes}</div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setForm({ ...selected }); setEditing(true); setShowAdd(true) }} style={{ flex: 1, padding: 10, background: 'var(--blL)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: 'var(--blue)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>Edit Product</button>
                    {selected.id && <button onClick={() => deleteProduct(selected.id)} style={{ padding: '10px 14px', background: 'var(--rdL)', border: 'none', borderRadius: 8, color: 'var(--red)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>Delete</button>}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ANALYTICS VIEW */}
      {view === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Range Distribution */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Products by Range</div>
              {RANGES.map(range => {
                const count = products.filter(p => p.range === range).length
                const pct = Math.round(count / (totalProducts || 1) * 100)
                return (
                  <div key={range} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, color: RANGE_COLORS[range] }}>{range}</span>
                      <span style={{ fontFamily: 'DM Mono', color: RANGE_COLORS[range] }}>{count} products ({pct}%)</span>
                    </div>
                    <div style={{ height: 10, background: 'var(--s2)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: RANGE_COLORS[range], borderRadius: 5 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Type Distribution */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Products by Type</div>
              {PRODUCT_TYPES.map((type, idx) => {
                const count = products.filter(p => p.type === type).length
                if (!count) return null
                const maxCount = Math.max(...PRODUCT_TYPES.map(t => products.filter(p => p.type === t).length), 1)
                const COLORS = ['var(--blue)','var(--teal)','var(--gold)','var(--purple)','var(--orange)','var(--green)','var(--red)']
                return (
                  <div key={type} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{type}</span>
                      <span style={{ fontFamily: 'DM Mono', color: COLORS[idx % COLORS.length] }}>{count}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.round(count/maxCount*100)+'%', background: COLORS[idx % COLORS.length], borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Range Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {['Moong Magic', 'Masoor Glow', 'Oats Care'].map(range => {
              const rangeProducts = products.filter(p => p.range === range)
              const avgPrice = rangeProducts.filter(p => p.price > 0).length > 0 ? Math.round(rangeProducts.filter(p => p.price > 0).reduce((s, p) => s + p.price, 0) / rangeProducts.filter(p => p.price > 0).length) : 0
              return (
                <div key={range} style={{ background: 'var(--s1)', border: '1px solid ' + RANGE_COLORS[range] + '44', borderTop: '3px solid ' + RANGE_COLORS[range], borderRadius: 14, padding: 20 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: RANGE_COLORS[range], marginBottom: 14 }}>{range}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: RANGE_COLORS[range] }}>{rangeProducts.length}</div>
                      <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>Products</div>
                    </div>
                    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{avgPrice > 0 ? '₹' + avgPrice : '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>Avg Price</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {rangeProducts.map((p, i) => (
                      <span key={i} onClick={() => { setSelected(p); setView('catalog') }} style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 20, background: RANGE_BG[range], color: RANGE_COLORS[range], fontWeight: 600, cursor: 'pointer' }}>{p.type}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* COSTING VIEW */}
      {view === 'costing' && (
        <div>
          <div style={{ background: 'var(--gL)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12.5, color: 'var(--gold)' }}>
            💡 Click on Price or Cost fields to edit directly. Margin auto-calculates.
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Product','Range','MRP','Cost Price','Gross Margin','Margin %','Stock','MOQ','Supplier'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const gross = (p.price || 0) - (p.cost || 0)
                  const marginPct = p.price > 0 && p.cost > 0 ? Math.round(gross / p.price * 100) : null
                  return (
                    <tr key={i} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.018)'} onMouseOut={e => e.currentTarget.style.background=''}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12.5 }}>{p.name}</td>
                      <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: RANGE_BG[p.range] || 'var(--s2)', color: RANGE_COLORS[p.range] || 'var(--mu)' }}>{p.range}</span></td>
                      <td style={{ padding: '10px 14px' }}>
                        <input type="number" defaultValue={p.price || 0} onBlur={e => updateField(p.id || p.name, 'price', Number(e.target.value))} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', fontFamily: 'DM Mono', fontSize: 13, fontWeight: 700, width: 70, outline: 'none', cursor: 'text' }} />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input type="number" defaultValue={p.cost || 0} onBlur={e => updateField(p.id || p.name, 'cost', Number(e.target.value))} style={{ background: 'transparent', border: 'none', color: 'var(--teal)', fontFamily: 'DM Mono', fontSize: 13, fontWeight: 700, width: 70, outline: 'none', cursor: 'text' }} />
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 13, color: gross > 0 ? 'var(--green)' : gross < 0 ? 'var(--red)' : 'var(--mu)' }}>
                        {p.price > 0 && p.cost > 0 ? '₹' + gross : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {marginPct !== null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: Math.min(marginPct, 100) + '%', background: marginPct >= 60 ? 'var(--green)' : marginPct >= 40 ? 'var(--gold)' : 'var(--red)', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontFamily: 'DM Mono', fontWeight: 700, color: marginPct >= 60 ? 'var(--green)' : marginPct >= 40 ? 'var(--gold)' : 'var(--red)', minWidth: 35 }}>{marginPct}%</span>
                          </div>
                        ) : <span style={{ color: 'var(--mu)', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input type="number" defaultValue={p.stock || 0} onBlur={e => updateField(p.id || p.name, 'stock', Number(e.target.value))} style={{ background: 'transparent', border: 'none', color: 'var(--tx)', fontFamily: 'DM Mono', fontSize: 12, width: 60, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input type="number" defaultValue={p.moq || 0} onBlur={e => updateField(p.id || p.name, 'moq', Number(e.target.value))} style={{ background: 'transparent', border: 'none', color: 'var(--mu)', fontFamily: 'DM Mono', fontSize: 12, width: 60, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input defaultValue={p.supplier || ''} onBlur={e => updateField(p.id || p.name, 'supplier', e.target.value)} placeholder="Add supplier..." style={{ background: 'transparent', border: 'none', color: 'var(--mu2)', fontSize: 12, width: 120, outline: 'none', fontFamily: 'Outfit' }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--b1)', background: 'var(--s2)' }}>
                  <td colSpan={2} style={{ padding: '10px 14px', fontFamily: 'Syne', fontWeight: 800, fontSize: 12 }}>TOTALS / AVERAGES</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--gold)' }}>₹{products.reduce((s,p) => s+(p.price||0), 0)}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--teal)' }}>₹{products.reduce((s,p) => s+(p.cost||0), 0)}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--green)' }}>₹{products.reduce((s,p) => s+((p.price||0)-(p.cost||0)), 0)}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontWeight: 800, color: 'var(--gold)' }}>{avgMargin}%</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 580, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>{editing ? 'Edit Product' : 'Add Product'}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{k:'name',l:'Product Name*',p:'Moong Magic Serum'},{k:'sku',l:'SKU',p:'MM-SR-01'}].map(f => (
                <div key={f.k}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label><input value={form[f.k] || ''} onChange={e => setForm((p: any) => ({...p, [f.k]: e.target.value}))} placeholder={f.p} style={inp} /></div>
              ))}
              {[{k:'range',l:'Range',opts:RANGES},{k:'type',l:'Type',opts:PRODUCT_TYPES},{k:'status',l:'Status',opts:STATUSES}].map(f => (
                <div key={f.k}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label><select value={form[f.k] || ''} onChange={e => setForm((p: any) => ({...p, [f.k]: e.target.value}))} style={inp}>{f.opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              ))}
              {[{k:'price',l:'MRP (₹)'},{k:'cost',l:'Cost Price (₹)'},{k:'stock',l:'Stock (units)'},{k:'moq',l:'MOQ (units)'}].map(f => (
                <div key={f.k}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label><input type="number" value={form[f.k] || 0} onChange={e => setForm((p: any) => ({...p, [f.k]: Number(e.target.value)}))} style={inp} /></div>
              ))}
            </div>

            {[{k:'description',l:'Description'},{k:'keyIngredients',l:'Key Ingredients (comma separated)'},{k:'benefits',l:'Benefits'},{k:'targetConcern',l:'Target Concerns'},{k:'supplier',l:'Supplier'},{k:'notes',l:'Notes'}].map(f => (
              <div key={f.k}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>{f.l}</label>{f.k === 'keyIngredients' || f.k === 'notes' ? <textarea value={form[f.k] || ''} onChange={e => setForm((p: any) => ({...p, [f.k]: e.target.value}))} rows={3} style={{ ...inp, resize: 'none' }} /> : <input value={form[f.k] || ''} onChange={e => setForm((p: any) => ({...p, [f.k]: e.target.value}))} style={inp} />}</div>
            ))}

            <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
              <button onClick={() => { setShowAdd(false); setEditing(false) }} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={saveProduct} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>{editing ? 'Save Changes' : 'Add Product'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
