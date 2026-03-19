import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, name, email } = body

    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

    // Check automation enabled
    const { data: auto } = await supabase
      .from('comm_automations')
      .select('*')
      .eq('trigger', 'user_login')
      .eq('enabled', true)
      .single()

    if (!auto) return NextResponse.json({ message: 'Login automation not enabled' })

    const message = (auto.template || `Hi {{name}}! 👋

Rabt Naturals mein aapka swagat hai! 🌿

Apni skin ke baare mein jaanein:
✨ AI Skin Analysis: rabtnaturals.com/skin-analysis
🛍️ Shop: rabtnaturals.com/products
📋 Consultation book karein: rabtnaturals.com/consultation

Koi sawaal ho toh reply karein! 💚
~Rabt Naturals`)
      .replace(/{{name}}/g, name || 'Customer')
      .replace(/{{email}}/g, email || '')

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://admin.rabtnaturals.com'

    if (auto.channel === 'whatsapp') {
      await fetch(`${baseUrl}/api/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message, template: 'user_login', log_type: 'automation' }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
