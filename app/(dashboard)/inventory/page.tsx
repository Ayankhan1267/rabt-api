'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const mongoUrl = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_MONGO_API_URL || process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url') : null

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    if (!mongoUrl) { setLoading(false); return }
    try {
      const res = await fetch(mongoUrl + '/api/products')
      if (res.ok) setProducts(await res.json())
    } catch { toast.error('Failed to load products') }
    setLoading(false)
  }

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))]
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'All' || p.category === catFilter
    return matchSearch && matchCat
  })

  const lowStock = products.filter(p => p.stock < (p.lowStockThreshold || 10))
  const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0)

  const CAT_COLORS: Record<string, string> = {
    cleanser: 'var(--blue)', toner: 'var(--teal)', serum: 'var(--purple)',
    moisturizer: 'var(--green)', sunscreen: 'var(--orange)', cream: 'var(--pink)',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}><span style={{ color: 'var(--gold)' }}>Inventory</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>
            {products.length} products · {totalStock} total units · {lowStock.length} low stock
            {!mongoUrl && ' · Connect MongoDB for live data'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Products', value: products.length, color: 'var(--blue)' },
          { label: 'Total Units', value: totalStock, color: 'var(--green)' },
          { label: 'Low Stock', value: lowStock.length, color: 'var(--red)' },
          { label: 'Out of Stock', value: products.filter(p => p.stock === 0).length, color: 'var(--orange)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <div style={{ background: 'var(--rdL)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, color: 'var(--red)', marginBottom: 10 }}>⚠️ Low Stock Alerts</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lowStock.map((p, i) => (
              <div key={i} style={{ background: 'rgba(239,68,68,0.15)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                <strong>{p.name.split(' ').slice(0, 3).join(' ')}</strong> — <span style={{ color: 'var(--red)', fontFamily: 'DM Mono', fontWeight: 700 }}>{p.stock} units</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search products..." style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', flex: 1 }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', cursor: 'pointer' }}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {!mongoUrl ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)', background: 'var(--s1)', borderRadius: 12, border: '1px solid var(--b1)' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🍃</div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Connect MongoDB to see live inventory</div>
          <div style={{ fontSize: 12 }}>18 products from rabtnaturals.com</div>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>Loading products...</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Product', 'Category', 'Variants', 'Price', 'Stock', 'Status', 'SKU'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--b1)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const stockColor = p.stock === 0 ? 'var(--red)' : p.stock < (p.lowStockThreshold || 10) ? 'var(--orange)' : 'var(--green)'
                const catColor = CAT_COLORS[p.category] || 'var(--mu)'
                return (
                  <tr key={i} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.018)')} onMouseOut={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {p.image && <img src={p.image} alt={p.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} onError={e => (e.currentTarget.style.display = 'none')} />}
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          {p.badges?.length > 0 && <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>{p.badges.slice(0, 2).map((b: string, bi: number) => <span key={bi} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 20, background: 'var(--gL)', color: 'var(--gold)', fontWeight: 600 }}>{b}</span>)}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: catColor + '22', color: catColor, fontWeight: 700, textTransform: 'capitalize' }}>{p.category}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--mu2)' }}>
                      {p.variants?.map((v: any) => v.size).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontFamily: 'DM Mono', fontWeight: 700 }}>₹{p.price}</div>
                      {p.originalPrice > p.price && <div style={{ fontSize: 10, color: 'var(--mu)', textDecoration: 'line-through' }}>₹{p.originalPrice}</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 16, fontWeight: 800, color: stockColor }}>{p.stock}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: p.stock === 0 ? 'var(--rdL)' : p.stock < (p.lowStockThreshold || 10) ? 'var(--orL)' : 'var(--grL)', color: stockColor }}>
                        {p.stock === 0 ? 'Out of Stock' : p.stock < (p.lowStockThreshold || 10) ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'DM Mono', fontSize: 11, color: 'var(--mu)' }}>{p.sku || '—'}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--mu)' }}>No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
