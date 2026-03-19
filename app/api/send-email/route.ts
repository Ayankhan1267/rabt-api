import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to, subject, message, variables, log_type } = body

    if (!to || !message) {
      return NextResponse.json({ error: 'to and message required' }, { status: 400 })
    }

    // Get settings
    const { data: settData } = await supabase
      .from('app_settings').select('value').eq('key', 'comm_settings').single()
    const settings = settData?.value ? JSON.parse(settData.value) : {}

    if (!settings.email_enabled) {
      return NextResponse.json({ error: 'Email not enabled' }, { status: 400 })
    }

    // Replace variables
    let finalMessage = message
    let finalSubject = subject || 'Message from Rabt Naturals'
    if (variables) {
      Object.entries(variables).forEach(([key, val]) => {
        finalMessage = finalMessage.replace(new RegExp(`{{${key}}}`, 'g'), String(val))
        finalSubject = finalSubject.replace(new RegExp(`{{${key}}}`, 'g'), String(val))
      })
    }

    // Send via SMTP using nodemailer approach
    // Using fetch to a transactional email service or direct SMTP
    const smtpHost  = settings.smtp_host
    const smtpPort  = settings.smtp_port || '587'
    const smtpUser  = settings.smtp_user
    const smtpPass  = settings.smtp_pass
    const smtpFrom  = settings.smtp_from || 'Rabt Naturals'

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({ error: 'SMTP credentials missing' }, { status: 400 })
    }

    // Log attempt
    await supabase.from('comm_logs').insert({
      type: log_type || 'manual',
      channel: 'email',
      trigger: 'custom',
      audience_count: 1,
      message: finalMessage,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, message: 'Email logged. Install nodemailer for actual sending.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
