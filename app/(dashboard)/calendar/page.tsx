'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const EVENT_TYPES = [
  { id: 'consultation', label: 'Consultation', color: '#14B8A6', bg: 'rgba(20,184,166,0.15)' },
  { id: 'order', label: 'Order Due', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  { id: 'task', label: 'Task Due', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { id: 'reminder', label: 'Reminder', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { id: 'meeting', label: 'Meeting', color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  { id: 'launch', label: 'Product Launch', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
  { id: 'followup', label: 'Follow Up', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
]

export default function CalendarPage() {
  const [today] = useState(new Date())
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<any[]>([])
  const [kanbanTasks, setKanbanTasks] = useState<any[]>([])
  const [consultations, setConsultations] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'month'|'week'|'agenda'>('month')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date|null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [form, setForm] = useState({ title: '', type: 'meeting', date: '', time: '', notes: '', assigned_to: '' })
  const [profiles, setProfiles] = useState<any[]>([])

  useEffect(() => { setMounted(true); loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const [p, pr, ev, kt] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user?.id).single(),
        supabase.from('profiles').select('*').order('name'),
        supabase.from('calendar_events').select('*, created_by(id,name), assigned_to(id,name)').order('event_date'),
        supabase.from('kanban_tasks').select('*, assigned_to(id,name)').not('due_date', 'is', null),
      ])
      setProfile(p.data)
      setProfiles(pr.data || [])
      setEvents(ev.data || [])
      setKanbanTasks(kt.data || [])

      const url = process.env.NEXT_PUBLIC_MONGO_API_URL || localStorage.getItem('rabt_mongo_url')
      if (url) {
        const consRes = await fetch(url + '/api/consultations').then(r => r.ok ? r.json() : [])
        setConsultations(Array.isArray(consRes) ? consRes.filter((c: any) => c.scheduledDate) : [])
      }
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }

  async function addEvent() {
    if (!form.title || !form.date) { toast.error('Title and date required'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('calendar_events').insert({
      title: form.title, type: form.type,
      event_date: form.date, event_time: form.time || null,
      notes: form.notes, assigned_to: form.assigned_to || null,
      created_by: user?.id
    })
    if (error) { toast.error(error.message); return }
    if (form.assigned_to) {
      await supabase.from('notifications').insert({ user_id: form.assigned_to, title: 'New Event: ' + form.title, message: form.date + (form.time ? ' at ' + form.time : ''), type: 'calendar' })
    }
    toast.success('Event added!')
    setShowAdd(false)
    setForm({ title: '', type: 'meeting', date: '', time: '', notes: '', assigned_to: '' })
    loadAll()
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete event?')) return
    await supabase.from('calendar_events').delete().eq('id', id)
    setSelectedEvent(null)
    loadAll()
    toast.success('Deleted!')
  }

  // Merge all events for a date
  function getAllEventsForDate(date: Date) {
    const dateStr = date.toISOString().split('T')[0]
    const all: any[] = []

    // Custom events
    events.filter(e => e.event_date === dateStr).forEach(e => {
      const type = EVENT_TYPES.find(t => t.id === e.type) || EVENT_TYPES[4]
      all.push({ ...e, _color: type.color, _bg: type.bg, _label: e.title, _source: 'event' })
    })

    // Kanban tasks due
    kanbanTasks.filter(t => t.due_date === dateStr).forEach(t => {
      const type = EVENT_TYPES[2]
      all.push({ ...t, _color: type.color, _bg: type.bg, _label: '📋 ' + t.title, _source: 'task' })
    })

    // Consultations
    consultations.filter(c => {
      const d = c.scheduledDate ? new Date(c.scheduledDate).toISOString().split('T')[0] : null
      return d === dateStr
    }).forEach(c => {
      const type = EVENT_TYPES[0]
      all.push({ ...c, _color: type.color, _bg: type.bg, _label: '🌿 ' + (c.name || 'Consultation'), _source: 'consultation' })
    })

    return all
  }

  // Calendar grid
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  // Upcoming events (next 30 days)
  const upcoming = (() => {
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const all: any[] = []
    for (let d = new Date(now); d <= in30; d.setDate(d.getDate() + 1)) {
      getAllEventsForDate(new Date(d)).forEach(e => all.push({ ...e, _date: new Date(d).toISOString().split('T')[0] }))
    }
    return all.sort((a, b) => (a._date > b._date ? 1 : -1)).slice(0, 20)
  })()

  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>
            <span style={{ color: 'var(--gold)' }}>Calendar</span>
          </h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>Consultations · Tasks · Events · Reminders</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['month','week','agenda'].map(v => (
            <button key={v} onClick={() => setView(v as any)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', textTransform: 'capitalize', background: view === v ? 'var(--gL)' : 'rgba(255,255,255,0.05)', color: view === v ? 'var(--gold)' : 'var(--mu2)', border: '1px solid ' + (view === v ? 'rgba(212,168,83,0.3)' : 'var(--b1)') }}>
              {v}
            </button>
          ))}
          <button onClick={() => { setShowAdd(true); setForm(f => ({ ...f, date: new Date().toISOString().split('T')[0] })) }} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>
            + Add Event
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {EVENT_TYPES.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
            <span style={{ fontSize: 11, color: 'var(--mu)' }}>{t.label}</span>
          </div>
        ))}
      </div>

      {view === 'month' && (
        <div>
          {/* Month Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <button onClick={() => setCurrentDate(new Date(year, month - 1))} style={{ width: 32, height: 32, background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 8, cursor: 'pointer', color: 'var(--tx)', fontSize: 16 }}>‹</button>
            <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, minWidth: 200, textAlign: 'center' }}>{MONTHS[month]} {year}</div>
            <button onClick={() => setCurrentDate(new Date(year, month + 1))} style={{ width: 32, height: 32, background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 8, cursor: 'pointer', color: 'var(--tx)', fontSize: 16 }}>›</button>
            <button onClick={() => setCurrentDate(new Date())} style={{ padding: '5px 12px', background: 'var(--gL)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: 7, cursor: 'pointer', color: 'var(--gold)', fontSize: 12, fontWeight: 700, fontFamily: 'Outfit' }}>Today</button>
          </div>

          {/* Grid */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--b1)' }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--mu)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
              ))}
            </div>

            {/* Calendar cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {Array.from({ length: totalCells }, (_, i) => {
                let dayNum: number
                let isCurrentMonth = true
                if (i < firstDay) { dayNum = daysInPrevMonth - firstDay + i + 1; isCurrentMonth = false }
                else if (i >= firstDay + daysInMonth) { dayNum = i - firstDay - daysInMonth + 1; isCurrentMonth = false }
                else dayNum = i - firstDay + 1

                const cellDate = new Date(year, isCurrentMonth ? month : (i < firstDay ? month - 1 : month + 1), dayNum)
                const isToday = cellDate.toDateString() === today.toDateString()
                const isSelected = selectedDay?.toDateString() === cellDate.toDateString()
                const dayEvents = getAllEventsForDate(cellDate)

                return (
                  <div key={i} onClick={() => { setSelectedDay(cellDate); if (dayEvents.length === 0) { setShowAdd(true); setForm(f => ({ ...f, date: cellDate.toISOString().split('T')[0] })) } }}
                    style={{ minHeight: 90, padding: '6px 8px', borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--b1)', borderBottom: '1px solid var(--b1)', cursor: 'pointer', background: isSelected ? 'rgba(212,168,83,0.05)' : 'transparent', transition: 'background 0.1s' }}
                    onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? '#08090C' : isCurrentMonth ? 'var(--tx)' : 'var(--mu)', background: isToday ? 'var(--gold)' : 'transparent', borderRadius: isToday ? '50%' : 0, width: isToday ? 22 : 'auto', height: isToday ? 22 : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: isToday ? 'Syne' : 'inherit' }}>{dayNum}</span>
                      {dayEvents.length > 0 && <span style={{ fontSize: 9, color: 'var(--mu)', fontFamily: 'DM Mono' }}>{dayEvents.length}</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayEvents.slice(0, 3).map((e, ei) => (
                        <div key={ei} onClick={ev => { ev.stopPropagation(); setSelectedEvent(e) }} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: e._bg, color: e._color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                          {e.event_time ? e.event_time.slice(0,5) + ' ' : ''}{e._label}
                        </div>
                      ))}
                      {dayEvents.length > 3 && <div style={{ fontSize: 9, color: 'var(--mu)', paddingLeft: 5 }}>+{dayEvents.length - 3} more</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'agenda' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Upcoming 30 Days</div>
            {upcoming.length === 0 ? (
              <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--mu)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
                <div>No upcoming events</div>
              </div>
            ) : upcoming.map((e, i) => {
              const isNew = i === 0 || upcoming[i-1]?._date !== e._date
              return (
                <div key={i}>
                  {isNew && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 0 6px' }}>
                      {new Date(e._date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                  )}
                  <div onClick={() => setSelectedEvent(e)} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderLeft: '3px solid ' + e._color, borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: e._color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e._label}</div>
                      {(e.notes || e.concern) && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{(e.notes || e.concern)?.slice(0, 60)}</div>}
                    </div>
                    {e.event_time && <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: 'DM Mono', flexShrink: 0 }}>{e.event_time.slice(0,5)}</div>}
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: e._bg, color: e._color, fontWeight: 700, flexShrink: 0 }}>
                      {e._source === 'consultation' ? 'Consultation' : e._source === 'task' ? 'Task' : (EVENT_TYPES.find(t => t.id === e.type)?.label || 'Event')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mini stats */}
          <div>
            <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, marginBottom: 14 }}>This Month</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Consultations', value: consultations.filter(c => { const d = c.scheduledDate ? new Date(c.scheduledDate) : null; return d && d.getMonth() === month && d.getFullYear() === year }).length, color: 'var(--teal)' },
                { label: 'Task Deadlines', value: kanbanTasks.filter(t => { const d = t.due_date ? new Date(t.due_date) : null; return d && d.getMonth() === month && d.getFullYear() === year }).length, color: 'var(--gold)' },
                { label: 'Custom Events', value: events.filter(e => { const d = e.event_date ? new Date(e.event_date) : null; return d && d.getMonth() === month && d.getFullYear() === year }).length, color: 'var(--purple)' },
                { label: 'Overdue Tasks', value: kanbanTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.column !== 'done').length, color: 'var(--red)' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Today's events */}
            <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginTop: 20, marginBottom: 10 }}>Today</div>
            {getAllEventsForDate(today).length === 0 ? (
              <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 10, padding: '20px', textAlign: 'center', color: 'var(--mu)', fontSize: 12 }}>No events today</div>
            ) : getAllEventsForDate(today).map((e, i) => (
              <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderLeft: '3px solid ' + e._color, borderRadius: 9, padding: '10px 12px', marginBottom: 7 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e._label}</div>
                {e.event_time && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{e.event_time.slice(0,5)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'week' && (() => {
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay())
        const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); return d })
        return (
          <div>
            <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 14, color: 'var(--gold)' }}>
              This Week — {weekDays[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to {weekDays[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10 }}>
              {weekDays.map((day, i) => {
                const isToday = day.toDateString() === today.toDateString()
                const dayEvs = getAllEventsForDate(day)
                return (
                  <div key={i} style={{ background: isToday ? 'rgba(212,168,83,0.07)' : 'var(--s1)', border: '1px solid ' + (isToday ? 'rgba(212,168,83,0.4)' : 'var(--b1)'), borderRadius: 12, padding: '12px 10px', minHeight: 200 }}>
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase' }}>{DAYS[i]}</div>
                      <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: isToday ? 'var(--gold)' : 'var(--tx)', marginTop: 2 }}>{day.getDate()}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {dayEvs.map((e, ei) => (
                        <div key={ei} onClick={() => setSelectedEvent(e)} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 5, background: e._bg, color: e._color, fontWeight: 600, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e._label}
                        </div>
                      ))}
                      {dayEvs.length === 0 && (
                        <div onClick={() => { setShowAdd(true); setForm(f => ({ ...f, date: day.toISOString().split('T')[0] })) }} style={{ fontSize: 10, color: 'var(--mu)', textAlign: 'center', padding: '8px 0', cursor: 'pointer' }}>+ Add</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedEvent(null)}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 460, maxWidth: '94vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedEvent._color }} />
                <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>{selectedEvent._label}</div>
              </div>
              <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Date', value: selectedEvent.event_date || selectedEvent._date || selectedEvent.scheduledDate?.split('T')[0] || '—' },
                { label: 'Time', value: selectedEvent.event_time || selectedEvent.scheduledTime || '—' },
                { label: 'Type', value: selectedEvent._source === 'consultation' ? 'Consultation' : selectedEvent._source === 'task' ? 'Task Due' : (EVENT_TYPES.find(t => t.id === selectedEvent.type)?.label || '—') },
                { label: 'Assigned', value: selectedEvent.assigned_to?.name || selectedEvent.specialistName || '—' },
                { label: 'Status', value: selectedEvent.status || selectedEvent.column || '—' },
                { label: 'Priority', value: selectedEvent.priority || '—' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 12px' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{item.value}</div>
                </div>
              ))}
            </div>
            {(selectedEvent.notes || selectedEvent.concern || selectedEvent.description) && (
              <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12.5, color: 'var(--mu2)', lineHeight: 1.5 }}>
                {selectedEvent.notes || selectedEvent.concern || selectedEvent.description}
              </div>
            )}
            {selectedEvent._source === 'event' && profile && (selectedEvent.created_by?.id === profile.id || ['founder','manager'].includes(profile.role)) && (
              <button onClick={() => deleteEvent(selectedEvent.id)} style={{ width: '100%', padding: 10, background: 'var(--rdL)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--red)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                Delete Event
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 480, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Event</div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Title*</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Event title..." style={inp} />
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Type</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inp}>
              {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Date*</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Time</label>
                <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} style={inp} />
              </div>
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Assign To</label>
            <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} style={inp}>
              <option value="">No assignment</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." rows={3} style={{ ...inp, resize: 'none' }} />
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addEvent} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
