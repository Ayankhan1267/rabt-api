import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to, message, template, variables, log_type } = body

    if (!to || !message) {
      return NextResponse.json({ error: 'to and message required' }, { status: 400 })
    }

    // Get settings from Supabase
    const { data: settData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'comm_settings')
      .single()

    const settings = settData?.value ? JSON.parse(settData.value) : {}

    if (!settings.whatsapp_enabled) {
      return NextResponse.json({ error: 'WhatsApp not enabled' }, { status: 400 })
    }

    const accountSid = settings.twilio_sid || process.env.TWILIO_ACCOUNT_SID
    const authToken  = settings.twilio_token || process.env.TWILIO_AUTH_TOKEN
    const fromNumber = settings.twilio_whatsapp || process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'

    if (!accountSid || !authToken) {
      return NextResponse.json({ error: 'Twilio credentials missing' }, { status: 400 })
    }

    // Format phone number
    let toNumber = to.replace(/[^0-9+]/g, '')
    if (!toNumber.startsWith('+')) toNumber = '+91' + toNumber
    const waTo = 'whatsapp:' + toNumber

    // Replace template variables
    let finalMessage = message
    if (variables) {
      Object.entries(variables).forEach(([key, val]) => {
        finalMessage = finalMessage.replace(new RegExp(`{{${key}}}`, 'g'), String(val))
      })
    }

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const params = new URLSearchParams({
      From: fromNumber,
      To: waTo,
      Body: finalMessage,
    })

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const result = await response.json()

    // Log to Supabase
    await supabase.from('comm_logs').insert({
      type: log_type || 'manual',
      channel: 'whatsapp',
      trigger: template || 'custom',
      audience_count: 1,
      message: finalMessage,
      status: response.ok ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
    })

    if (!response.ok) {
      return NextResponse.json({ error: result.message || 'Twilio error' }, { status: 400 })
    }

    return NextResponse.json({ success: true, sid: result.sid })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
