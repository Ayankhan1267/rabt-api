import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_TEMPLATES: Record<string, string> = {
  post_purchase: `Hi {{name}}! 🎉 Aapka order #{{orderNumber}} place ho gaya hai!

🌿 Rabt Naturals se purchase karne ke liye shukriya.
📦 Expected delivery: 3-5 working days

Apna order track karein: rabtnaturals.com/track
Koi sawaal ho toh reply karein! 💚`,

  consultation_booked: `Hi {{name}}! 📅

Aapki skin consultation schedule ho gayi hai!
🗓️ Date: {{date}}
⏰ Time: {{time}}
👩‍⚕️ Specialist: {{specialist}}

~Rabt Naturals 🌿`,

  consultation_reminder: `Hi {{name}}! ⏰

Kal aapki skin consultation hai!
🗓️ {{date}} ko {{time}} pe
👩‍⚕️ {{specialist}} ke saath

Ready rahein! 🌿
~Rabt Naturals`,

  consultation_complete: `Hi {{name}}! ✅

Aapki skin consultation complete ho gayi!

🌿 *Skin Analysis Results:*
- Skin Type: {{skinType}}
- Skin Score: {{skinScore}}/100
- Category: {{skinCategory}}
- Recommended Range: {{recommendedRange}}

📋 Aapki detailed skin profile report:
{{pdfLink}}

Recommended products: rabtnaturals.com/products
Koi sawaal ho: reply karein! 💚
~Rabt Naturals 🌿`,

  reorder_reminder: `Hi {{name}}! 🔄

Aapka {{product}} khatam hone wala hoga!
Reorder karein: rabtnaturals.com

~Rabt Naturals 🌿`,

  feedback_request: `Hi {{name}}! ⭐

Aapka order deliver ho gaya! Kaisi lagi products?
Review: rabtnaturals.com/review

~Rabt Naturals 💚`,

  user_login: `Hi {{name}}! 👋 Rabt Naturals mein aapka swagat hai! 🌿

Apni skin ke baare mein jaanein:
✨ AI Skin Analysis: rabtnaturals.com/skin-analysis
📅 Consultation book karein: rabtnaturals.com/consultation
🛍️ Shop: rabtnaturals.com/products

Koi sawaal ho toh reply karein! 💚
~Rabt Naturals`,

  no_booking: `Hi {{name}}! 💚

Aapne login kiya lekin consultation abhi book nahi ki!

Humari specialist aapki skin ke liye personalized routine suggest karegi.
📅 Book karein: rabtnaturals.com/consultation

Pehli consultation bilkul FREE hai! 🌿
~Rabt Naturals`,

  cart_abandoned: `Hi {{name}}! 🛒

Aapne cart mein products add kiye hain!
Rs.{{amount}} ka order complete karein:
🔗 rabtnaturals.com/cart

Limited time offer: RABT10 se 10% off milega! 🎁
~Rabt Naturals`,

  win_back: `Hi {{name}}! 💝

Aapko miss kar rahe hain! 30 din se aapka koi order nahi aaya.

Exclusive offer sirf aapke liye:
🎁 Code: COMEBACK15 → 15% off
🛍️ rabtnaturals.com/products

~Rabt Naturals 🌿`,

  birthday: `Happy Birthday {{name}}! 🎂🎉

Aaj aapka special din hai!
Rabt Naturals ki taraf se ek special gift:
🎁 Code: BDAY20 → 20% off
Valid aaj sirf!

🛍️ rabtnaturals.com/products
~Rabt Naturals 💚`,
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { trigger, customer, data } = body

    // customer = { name, phone, email }
    // data = { orderNumber, date, time, specialist, product, etc }
    // trigger = 'post_purchase' | 'consultation_booked' | etc

    if (!trigger || !customer?.phone) {
      return NextResponse.json({ error: 'trigger and customer.phone required' }, { status: 400 })
    }

    // Check if automation is enabled
    const { data: auto } = await supabase
      .from('comm_automations')
      .select('*')
      .eq('trigger', trigger)
      .eq('enabled', true)
      .single()

    if (!auto) {
      return NextResponse.json({ message: 'Automation not enabled for: ' + trigger }, { status: 200 })
    }

    // For consultation_complete - fetch skin profile
    let extraData: Record<string, string> = {}
    if (trigger === 'consultation_complete' && customer.phone) {
      try {
        const mongoUrl = process.env.NEXT_PUBLIC_MONGO_API_URL
        if (mongoUrl) {
          const skinRes = await fetch(mongoUrl + '/api/skinprofiles')
          if (skinRes.ok) {
            const profiles = await skinRes.json()
            const profile = Array.isArray(profiles)
              ? profiles.find((p: any) => p.phone === customer.phone || p.customerPhone === customer.phone)
              : null
            if (profile) {
              extraData = {
                skinType: profile.skinType || '—',
                skinScore: profile.skinScore || '—',
                skinCategory: profile.skinCategory || '—',
                recommendedRange: profile.recommendedRange || '—',
                pdfLink: 'rabtnaturals.com/skin-profile (apne account mein login karein)',
              }
            }
          }
        }
      } catch {}
    }

    // Get template
    const template = auto.template || DEFAULT_TEMPLATES[trigger] || ''
    const variables = { name: customer.name || 'Customer', ...data, ...extraData }

    // Replace variables
    let message = template
    Object.entries(variables).forEach(([key, val]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(val))
    })

    // Send based on channel
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://admin.rabtnaturals.com'

    if (auto.channel === 'whatsapp') {
      const res = await fetch(`${baseUrl}/api/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.phone,
          message,
          template: trigger,
          log_type: 'automation',
        }),
      })
      const result = await res.json()
      return NextResponse.json(result)
    }

    if (auto.channel === 'email' && customer.email) {
      const res = await fetch(`${baseUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.email,
          subject: 'Rabt Naturals - ' + trigger.replace(/_/g, ' '),
          message,
          log_type: 'automation',
        }),
      })
      const result = await res.json()
      return NextResponse.json(result)
    }

    return NextResponse.json({ success: true, message: 'Processed' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
