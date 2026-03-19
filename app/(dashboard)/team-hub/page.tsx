'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const CHANNELS = [
  { id: 'general',     label: '# general',     icon: '💬', desc: 'Team general chat' },
  { id: 'sales',       label: '# sales',       icon: '📦', desc: 'Orders & sales updates' },
  { id: 'specialists', label: '# specialists', icon: '🌿', desc: 'Specialist team' },
  { id: 'marketing',   label: '# marketing',   icon: '📢', desc: 'Marketing campaigns' },
  { id: 'support',     label: '# support',     icon: '💚', desc: 'Customer support' },
]

const PLATFORMS = [
  { id: 'google_meet', label: 'Google Meet',  icon: '🎥', color: 'var(--green)' },
  { id: 'zoom',        label: 'Zoom',         icon: '💙', color: 'var(--blue)'  },
  { id: 'teams',       label: 'MS Teams',     icon: '💜', color: 'var(--purple)'},
  { id: 'whatsapp',    label: 'WhatsApp Call', icon: '📞', color: 'var(--green)' },
]

export default function TeamHubPage() {
  const [profile, setProfile]           = useState<any>(null)
  const [tab, setTab]                   = useState<'chat'|'meetings'|'announcements'|'members'>('chat')
  const [activeChannel, setActiveChannel] = useState('general')
  const [messages, setMessages]         = useState<any[]>([])
  const [meetings, setMeetings]         = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [members, setMembers]           = useState<any[]>([])
  const [message, setMessage]           = useState('')
  const [sending, setSending]           = useState(false)
  const [mounted, setMounted]           = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [meetingForm, setMeetingForm] = useState({
    title: '', description: '', meeting_link: '', platform: 'google_meet',
    scheduled_at: '', duration_mins: 30, attendees: [] as string[],
  })

  const [announcementForm, setAnnouncementForm] = useState({
    title: '', message: '', priority: 'normal',
  })

  useEffect(() => { setMounted(true); loadAll() }, [])
  useEffect(() => { if (tab === 'chat') loadMessages() }, [activeChannel, tab])
  useEffect(() => { scrollToBottom() }, [messages])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
    setProfile(prof)
    await Promise.all([loadMessages(), loadMeetings(), loadAnnouncements(), loadMembers()])
    setupRealtime()
  }

  async function loadMessages() {
    const { data } = await supabase.from('team_messages').select('*')
      .eq('channel', activeChannel).order('created_at', { ascending: true }).limit(100)
    setMessages(data || [])
  }

  async function loadMeetings() {
    const { data } = await supabase.from('team_meetings').select('*')
      .order('scheduled_at', { ascending: true })
    setMeetings(data || [])
  }

  async function loadAnnouncements() {
    const { data } = await supabase.from('team_announcements').select('*')
      .order('created_at', { ascending: false })
    setAnnouncements(data || [])
  }

  async function loadMembers() {
    const { data } = await supabase.from('profiles').select('*').order('name')
    setMembers(data || [])
  }

  function setupRealtime() {
    supabase.channel('team_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages' }, (payload) => {
        const msg = payload.new as any
        if (msg.channel === activeChannel) {
          setMessages(prev => [...prev, msg])
        }
      }).subscribe()

    supabase.channel('team_announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_announcements' }, (payload) => {
        setAnnouncements(prev => [payload.new, ...prev])
        toast(`📢 ${(payload.new as any).title}`, { duration: 5000 })
      }).subscribe()
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function sendMessage() {
    if (!message.trim() || !profile) return
    setSending(true)
    await supabase.from('team_messages').insert({
      channel: activeChannel,
      sender_id: profile.id,
      sender_name: profile.name || profile.email,
      sender_role: profile.role || 'team',
      message: message.trim(),
    })
    setMessage('')
    setSending(false)
  }

  async function createMeeting() {
    if (!meetingForm.title || !meetingForm.scheduled_at) {
      toast.error('Title aur time required hai')
      return
    }
    await supabase.from('team_meetings').insert({
      ...meetingForm,
      created_by: profile?.id,
      attendees: meetingForm.attendees,
    })
    toast.success('Meeting scheduled! 📅')
    setShowMeetingModal(false)
    setMeetingForm({ title: '', description: '', meeting_link: '', platform: 'google_meet', scheduled_at: '', duration_mins: 30, attendees: [] })
    loadMeetings()

    // Send message in general channel
    await supabase.from('team_messages').insert({
      channel: 'general',
      sender_id: profile?.id,
      sender_name: profile?.name || 'Team',
      sender_role: profile?.role,
      message: `📅 *Meeting Scheduled*: ${meetingForm.title}\n🗓️ ${new Date(meetingForm.scheduled_at).toLocaleString('en-IN')}\n🔗 ${meetingForm.meeting_link || 'Link TBD'}`,
      type: 'meeting',
    })
  }

  async function createAnnouncement() {
    if (!announcementForm.title || !announcementForm.message) {
      toast.error('Title aur message required hai')
      return
    }
    await supabase.from('team_announcements').insert({
      ...announcementForm,
      created_by: profile?.id,
      creator_name: profile?.name || profile?.email,
    })
    toast.success('Announcement posted! 📢')
    setShowAnnouncementModal(false)
    setAnnouncementForm({ title: '', message: '', priority: 'normal' })

    // Also send in general channel
    await supabase.from('team_messages').insert({
      channel: 'general',
      sender_id: profile?.id,
      sender_name: profile?.name || 'Team',
      sender_role: profile?.role,
      message: `📢 *Announcement*: ${announcementForm.title}\n${announcementForm.message}`,
      type: 'announcement',
    })
  }

  async function deleteMeeting(id: string) {
    if (!confirm('Delete this meeting?')) return
    await supabase.from('team_meetings').delete().eq('id', id)
    setMeetings(prev => prev.filter(m => m.id !== id))
    toast.success('Meeting deleted!')
  }

  const upcomingMeetings = meetings.filter(m => new Date(m.scheduled_at) > new Date())
  const pastMeetings     = meetings.filter(m => new Date(m.scheduled_at) <= new Date())

  const inp: any = {
    background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8,
    padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit',
    outline: 'none', width: '100%', marginBottom: 10,
  }

  const ROLE_COLORS: Record<string, string> = {
    founder: '#D4A853', manager: '#0097A7', specialist: '#22C55E',
    specialist_manager: '#8B5CF6', ops: '#F97316', support: '#3B82F6',
    partner: '#EC4899',
  }

  if (!mounted) return null

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: 0 }}>

      {/* LEFT SIDEBAR */}
      <div style={{ width: 220, flexShrink: 0, background: 'var(--s2)', borderRadius: '12px 0 0 12px', border: '1px solid var(--b1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--b1)' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800 }}>🏢 Team Hub</div>
          <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>{members.length} members online</div>
        </div>

        {/* Nav */}
        <div style={{ padding: '8px 8px 0' }}>
          {[
            { id: 'chat',          l: '💬 Chat',          badge: 0 },
            { id: 'meetings',      l: '📅 Meetings',      badge: upcomingMeetings.length },
            { id: 'announcements', l: '📢 Announcements', badge: announcements.filter(a => a.priority === 'urgent').length },
            { id: 'members',       l: '👥 Members',       badge: 0 },
          ].map(t => (
            <div key={t.id} onClick={() => setTab(t.id as any)} style={{
              padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
              background: tab === t.id ? 'rgba(0,151,167,0.12)' : 'transparent',
              color: tab === t.id ? 'var(--teal)' : 'var(--mu2)',
              fontWeight: tab === t.id ? 700 : 400, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {t.l}
              {t.badge > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'var(--teal)', color: '#fff', fontWeight: 700 }}>{t.badge}</span>}
            </div>
          ))}
        </div>

        {/* Channels */}
        {tab === 'chat' && (
          <div style={{ padding: '12px 8px 0', flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 6 }}>Channels</div>
            {CHANNELS.map(ch => (
              <div key={ch.id} onClick={() => setActiveChannel(ch.id)} style={{
                padding: '7px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                background: activeChannel === ch.id ? 'rgba(0,151,167,0.12)' : 'transparent',
                color: activeChannel === ch.id ? 'var(--teal)' : 'var(--mu)',
                fontWeight: activeChannel === ch.id ? 700 : 400, fontSize: 12.5,
              }}>{ch.icon} {ch.label.replace('# ', '')}</div>
            ))}
          </div>
        )}

        {/* Online members */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--b1)', marginTop: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 6 }}>Online</div>
          {members.slice(0, 5).map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: ROLE_COLORS[m.role] || '#0097A7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {(m.name || m.email || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--mu2)' }}>{m.name || m.email}</div>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', marginLeft: 'auto', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, border: '1px solid var(--b1)', borderLeft: 'none', borderRadius: '0 12px 12px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--s1)' }}>

        {/* CHAT */}
        {tab === 'chat' && (
          <>
            {/* Channel header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ fontSize: 18 }}>{CHANNELS.find(c => c.id === activeChannel)?.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{activeChannel}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>{CHANNELS.find(c => c.id === activeChannel)?.desc}</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mu)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                  <div style={{ fontSize: 14 }}>#{activeChannel} channel mein koi message nahi</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>Pehla message bhejo!</div>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === profile?.id
                const prevMsg = messages[i - 1]
                const showHeader = !prevMsg || prevMsg.sender_id !== msg.sender_id || new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000
                const roleColor = ROLE_COLORS[msg.sender_role] || '#0097A7'
                const isMeeting = msg.type === 'meeting' || msg.type === 'announcement'

                return (
                  <div key={msg.id} style={{ marginTop: showHeader ? 12 : 2 }}>
                    {showHeader && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                          {(msg.sender_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{msg.sender_name}</span>
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: roleColor + '22', color: roleColor, fontWeight: 700 }}>{msg.sender_role}</span>
                          <span style={{ fontSize: 10, color: 'var(--mu)' }}>{new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    )}
                    <div style={{ paddingLeft: showHeader ? 0 : 36 }}>
                      <div style={{
                        display: 'inline-block', maxWidth: '80%',
                        background: isMeeting ? 'rgba(0,151,167,0.08)' : isMe ? 'rgba(0,151,167,0.1)' : 'var(--s2)',
                        border: isMeeting ? '1px solid rgba(0,151,167,0.2)' : '1px solid var(--b1)',
                        borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        padding: '8px 12px', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--b1)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder={`Message #${activeChannel}...`}
                style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 10, padding: '10px 14px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none' }}
              />
              <button onClick={sendMessage} disabled={sending || !message.trim()} style={{
                padding: '10px 18px', borderRadius: 10, border: 'none',
                background: message.trim() ? 'linear-gradient(135deg,#0097A7,#005F6A)' : 'var(--s2)',
                color: message.trim() ? '#fff' : 'var(--mu)', fontWeight: 700, fontSize: 13,
                cursor: message.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Outfit',
              }}>Send</button>
            </div>
          </>
        )}

        {/* MEETINGS */}
        {tab === 'meetings' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>📅 Meetings</div>
                <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>{upcomingMeetings.length} upcoming</div>
              </div>
              <button onClick={() => setShowMeetingModal(true)} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#0097A7,#005F6A)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
                + Schedule Meeting
              </button>
            </div>

            {upcomingMeetings.length === 0 && pastMeetings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <div style={{ fontSize: 14 }}>Koi meeting scheduled nahi hai</div>
              </div>
            ) : (
              <>
                {upcomingMeetings.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Upcoming</div>
                    {upcomingMeetings.map((m, i) => {
                      const platform = PLATFORMS.find(p => p.id === m.platform) || PLATFORMS[0]
                      return (
                        <div key={i} style={{ background: 'var(--s2)', borderRadius: 12, padding: '16px', marginBottom: 12, border: '1px solid rgba(0,151,167,0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{m.title}</div>
                              {m.description && <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 3 }}>{m.description}</div>}
                            </div>
                            <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,151,167,0.1)', color: 'var(--teal)', fontWeight: 700 }}>Upcoming</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--mu2)', marginBottom: 12, flexWrap: 'wrap' }}>
                            <span>🗓️ {new Date(m.scheduled_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            <span>⏰ {new Date(m.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>⏱️ {m.duration_mins} mins</span>
                            <span style={{ color: platform.color }}>{platform.icon} {platform.label}</span>
                          </div>
                          {m.meeting_link && (
                            <a href={m.meeting_link} target="_blank" rel="noopener noreferrer" style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '8px 16px', borderRadius: 8,
                              background: 'linear-gradient(135deg,#0097A7,#005F6A)',
                              color: '#fff', fontWeight: 700, fontSize: 13,
                              textDecoration: 'none', fontFamily: 'Outfit',
                            }}>
                              🔗 Join Meeting
                            </a>
                          )}
                          <button onClick={() => deleteMeeting(m.id)} style={{ marginLeft: 8, padding: '8px 14px', background: 'var(--rdL)', border: 'none', borderRadius: 8, color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {pastMeetings.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Past</div>
                    {pastMeetings.slice(0, 5).map((m, i) => (
                      <div key={i} style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, opacity: 0.6, border: '1px solid var(--b1)' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 3 }}>
                          {new Date(m.scheduled_at).toLocaleDateString('en-IN')} · {m.duration_mins} mins
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ANNOUNCEMENTS */}
        {tab === 'announcements' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800 }}>📢 Announcements</div>
              <button onClick={() => setShowAnnouncementModal(true)} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 9, color: '#08090C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>
                + New Announcement
              </button>
            </div>

            {announcements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📢</div>
                <div style={{ fontSize: 14 }}>Koi announcement nahi hai</div>
              </div>
            ) : announcements.map((a, i) => (
              <div key={i} style={{
                background: 'var(--s2)', borderRadius: 12, padding: '16px 18px', marginBottom: 12,
                borderLeft: '4px solid ' + (a.priority === 'urgent' ? 'var(--red)' : a.priority === 'important' ? 'var(--gold)' : 'var(--teal)'),
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.title}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                    background: a.priority === 'urgent' ? 'var(--rdL)' : a.priority === 'important' ? 'var(--gL)' : 'rgba(0,151,167,0.1)',
                    color: a.priority === 'urgent' ? 'var(--red)' : a.priority === 'important' ? 'var(--gold)' : 'var(--teal)',
                  }}>{a.priority}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--mu2)', lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{a.message}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>
                  By {a.creator_name} · {new Date(a.created_at).toLocaleDateString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MEMBERS */}
        {tab === 'members' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 20 }}>👥 Team Members ({members.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
              {members.map((m, i) => {
                const roleColor = ROLE_COLORS[m.role] || '#0097A7'
                return (
                  <div key={i} style={{ background: 'var(--s2)', borderRadius: 12, padding: '16px', border: '1px solid var(--b1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                        {(m.name || m.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{m.name || 'User'}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)' }}>{m.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: roleColor + '22', color: roleColor, fontWeight: 700 }}>{m.role || 'team'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                        <span style={{ fontSize: 10, color: 'var(--mu)' }}>Online</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* MEETING MODAL */}
      {showMeetingModal && (
        <div onClick={() => setShowMeetingModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--s1)', borderRadius: 16, padding: '24px 28px', width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 20 }}>📅 Schedule Meeting</div>

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Title*</label>
            <input value={meetingForm.title} onChange={e => setMeetingForm(p => ({ ...p, title: e.target.value }))} placeholder="Weekly Team Sync" style={inp} />

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Description</label>
            <textarea value={meetingForm.description} onChange={e => setMeetingForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Meeting agenda..." style={{ ...inp, resize: 'none' }} />

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Platform</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setMeetingForm(prev => ({ ...prev, platform: p.id }))} style={{
                  flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'Outfit',
                  border: '1.5px solid ' + (meetingForm.platform === p.id ? p.color : 'var(--b1)'),
                  background: meetingForm.platform === p.id ? p.color + '22' : 'var(--s2)',
                  color: meetingForm.platform === p.id ? p.color : 'var(--mu)',
                }}>{p.icon} {p.label}</button>
              ))}
            </div>

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Meeting Link</label>
            <input value={meetingForm.meeting_link} onChange={e => setMeetingForm(p => ({ ...p, meeting_link: e.target.value }))} placeholder="https://meet.google.com/..." style={inp} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Date & Time*</label>
                <input type="datetime-local" value={meetingForm.scheduled_at} onChange={e => setMeetingForm(p => ({ ...p, scheduled_at: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Duration (mins)</label>
                <select value={meetingForm.duration_mins} onChange={e => setMeetingForm(p => ({ ...p, duration_mins: Number(e.target.value) }))} style={inp}>
                  {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} mins</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setShowMeetingModal(false)} style={{ flex: 1, padding: 11, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 10, color: 'var(--mu2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={createMeeting} style={{ flex: 2, padding: 11, background: 'linear-gradient(135deg,#0097A7,#005F6A)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Syne' }}>📅 Schedule Meeting</button>
            </div>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENT MODAL */}
      {showAnnouncementModal && (
        <div onClick={() => setShowAnnouncementModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--s1)', borderRadius: 16, padding: '24px 28px', width: 460, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 20 }}>📢 New Announcement</div>

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Title*</label>
            <input value={announcementForm.title} onChange={e => setAnnouncementForm(p => ({ ...p, title: e.target.value }))} placeholder="Announcement title..." style={inp} />

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Message*</label>
            <textarea value={announcementForm.message} onChange={e => setAnnouncementForm(p => ({ ...p, message: e.target.value }))} rows={4} placeholder="Announcement details..." style={{ ...inp, resize: 'none' }} />

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Priority</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'normal',    l: 'Normal',    c: 'var(--teal)' },
                { id: 'important', l: 'Important', c: 'var(--gold)' },
                { id: 'urgent',    l: 'Urgent',    c: 'var(--red)'  },
              ].map(p => (
                <button key={p.id} onClick={() => setAnnouncementForm(prev => ({ ...prev, priority: p.id }))} style={{
                  flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Outfit',
                  border: '1.5px solid ' + (announcementForm.priority === p.id ? p.c : 'var(--b1)'),
                  background: announcementForm.priority === p.id ? p.c + '22' : 'var(--s2)',
                  color: announcementForm.priority === p.id ? p.c : 'var(--mu)',
                }}>{p.l}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAnnouncementModal(false)} style={{ flex: 1, padding: 11, background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 10, color: 'var(--mu2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={createAnnouncement} style={{ flex: 2, padding: 11, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 10, color: '#08090C', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Syne' }}>📢 Post Announcement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
