import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const mongoUrl = process.env.NEXT_PUBLIC_MONGO_API_URL
    if (!mongoUrl) return NextResponse.json({ error: 'No mongo URL' })

    // Fetch latest consultations
    const res = await fetch(mongoUrl + '/api/consultations')
    if (!res.ok) return NextResponse.json({ error: 'Mongo fetch failed' })
    const all = await res.json()

    const unassigned = Array.isArray(all)
      ? all.filter((c: any) => c.status === 'pending' && !c.assignedSpecialist)
      : []

    // Check last notified time
    const { data: lastCheck } = await supabase
      .from('app_settings').select('value').eq('key', 'last_cons_check').single()
    const lastTime = lastCheck?.value ? new Date(JSON.parse(lastCheck.value)) : new Date(0)

    // New consultations since last check
    const newCons = unassigned.filter((c: any) => new Date(c.createdAt) > lastTime)

    if (newCons.length > 0) {
      // Get all specialists and managers
      const { data: specialists } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['specialist', 'specialist_manager', 'founder', 'manager'])

      for (const spec of specialists || []) {
        for (const c of newCons) {
          await supabase.from('notifications').insert({
            user_id: spec.id,
            title: 'New Consultation!',
            message: `${c.fullName || c.name || 'Customer'} ne consultation request ki - ${c.description || c.concern || ''}`,
            type: 'consultation',
            is_read: false,
          })
        }
      }

      // Update last check time
      await supabase.from('app_settings').upsert({
        key: 'last_cons_check',
        value: JSON.stringify(new Date().toISOString())
      })
    }

    return NextResponse.json({ checked: all.length, new: newCons.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}