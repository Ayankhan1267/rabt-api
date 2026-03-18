// ════════════════════════════════════════════════════════
// RABT TRACKING — Add to rabtnaturals.com
// File: components/RabtTracker.tsx
// ════════════════════════════════════════════════════════
'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const API = 'https://rabt-api.onrender.com'

// Get/create visitor ID
function getVid(): string {
  if (typeof window === 'undefined') return ''
  let vid = localStorage.getItem('rabt_vid')
  if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('rabt_vid', vid) }
  return vid
}

export function getCartId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('rabt_cart_id')
  if (!id) { id = 'cart_' + Math.random().toString(36).slice(2); localStorage.setItem('rabt_cart_id', id) }
  return id
}

// Ping live server
export async function pingLive(action = 'browsing', page?: string) {
  try {
    const phone = localStorage.getItem('rabt_user_phone') || null
    await fetch(`${API}/api/live/ping`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVid(), page: page || window.location.pathname, action, phone, source: document.referrer || 'direct' })
    })
  } catch {}
}

// Track an event
export async function trackEvent(event: string, data?: any) {
  try {
    const phone = localStorage.getItem('rabt_user_phone') || null
    await fetch(`${API}/api/tracking/event`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, visitorId: getVid(), phone, data: data || {} })
    })
  } catch {}
}

// Sync cart to HQ
export async function syncCart(items: any[], total: number, user?: any) {
  try {
    const phone = user?.phoneNumber || user?.phone || localStorage.getItem('rabt_user_phone') || null
    await fetch(`${API}/api/carts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartId: getCartId(),
        phone,
        name: user?.name || user?.firstName || null,
        items: items.map(i => ({ name: i.name || i.productSnapshot?.name, qty: i.quantity || i.qty || 1, price: i.price?.final || i.price || 0, image: i.image || '' })),
        total,
        page: window.location.pathname,
        source: document.referrer || 'direct'
      })
    })
    // Also ping live as "added_to_cart"
    await pingLive('added_to_cart')
  } catch {}
}

// Mark cart converted on order success
export async function markCartConverted(orderId: string) {
  try {
    await fetch(`${API}/api/carts/${getCartId()}/convert`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    })
  } catch {}
}

// ── Main Tracker Component ──────────────────────────────
// Add <RabtTracker /> to your layout.tsx
export default function RabtTracker() {
  const pathname = usePathname()

  useEffect(() => {
    // Page view
    pingLive('browsing', pathname)
    trackEvent('page_view', { path: pathname })

    // Detect action from pathname
    if (pathname.includes('/skin-analysis') || pathname.includes('/know-your-skin')) {
      pingLive('skin_analysis', pathname)
      trackEvent('skin_analysis_start', { path: pathname })
    }
    if (pathname.includes('/consultation')) {
      pingLive('consultation', pathname)
      trackEvent('consultation_start', { path: pathname })
    }
    if (pathname.includes('/checkout')) {
      pingLive('checkout', pathname)
      trackEvent('checkout_start', { path: pathname })
    }
    if (pathname.includes('/products/') || pathname.includes('/product/')) {
      pingLive('viewing_product', pathname)
      trackEvent('product_view', { path: pathname })
    }

    // Ping every 30 seconds while on page
    const iv = setInterval(() => pingLive('browsing', pathname), 30000)
    return () => clearInterval(iv)
  }, [pathname])

  return null // invisible component
}

// ════════════════════════════════════════════════════════
// HOW TO USE:
// 
// 1. Copy this file to rabtnaturals.com/components/RabtTracker.tsx
//
// 2. In app/layout.tsx, add:
//    import RabtTracker from '@/components/RabtTracker'
//    // Inside <body>:
//    <RabtTracker />
//
// 3. In your cart context (wherever cart updates), call:
//    import { syncCart } from '@/components/RabtTracker'
//    // When cart changes:
//    syncCart(cartItems, cartTotal, currentUser)
//
// 4. When user logs in, save phone:
//    localStorage.setItem('rabt_user_phone', user.phoneNumber)
//
// 5. On order success page:
//    import { markCartConverted, trackEvent } from '@/components/RabtTracker'
//    markCartConverted(orderId)
//    trackEvent('order_placed', { orderId, amount })
//
// 6. On skin analysis completion:
//    import { trackEvent, pingLive } from '@/components/RabtTracker'
//    trackEvent('skin_analysis_complete', { skinType, score })
//    pingLive('skin_analysis')
// ════════════════════════════════════════════════════════
