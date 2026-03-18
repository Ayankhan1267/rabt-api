'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'var(--blue)', bg: 'var(--blL)' },
  { id: 'inprogress', label: 'In Progress', color: 'var(--orange)', bg: 'var(--orL)' },
  { id: 'review', label: 'Review', color: 'var(--purple)', bg: 'rgba(139,92,246,0.15)' },
  { id: 'done', label: 'Done', color: 'var(--green)', bg: 'var(--grL)' },
]

const PRIORITIES = [
  { id: 'low', label: 'Low', color: 'var(--mu)' },
  { id: 'medium', label: 'Medium', color: 'var(--gold)' },
  { id: 'high', label: 'High', color: 'var(--orange)' },
  { id: 'urgent', label: 'Urgent', color: 'var(--red)' },
]

const TAGS = ['Marketing', 'Operations', 'Product', 'Tech', 'Finance', 'Specialist', 'Support', 'Admin']

export default function KanbanPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addToColumn, setAddToColumn] = useState('todo')
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [draggedTask, setDraggedTask] = useState<any>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', tag: 'Operations',
    assigned_to: '', due_date: '', column: 'todo'
  })

  useEffect(() => { setMounted(true); loadAll() }, [])

  useEffect(() => {
    const ch = supabase.channel('kanban')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_tasks' }, () => loadTasks())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const [p, pr, t] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user?.id).single(),
      supabase.from('profiles').select('*').order('name'),
      supabase.from('kanban_tasks').select('*, assigned_to(id,name,role), created_by(id,name)').order('created_at', { ascending: false }),
    ])
    setProfile(p.data)
    setProfiles(pr.data || [])
    setTasks(t.data || [])
    setLoading(false)
  }

  async function loadTasks() {
    const { data } = await supabase.from('kanban_tasks').select('*, assigned_to(id,name,role), created_by(id,name)').order('created_at', { ascending: false })
    setTasks(data || [])
  }

  async function addTask() {
    if (!form.title) { toast.error('Title required'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('kanban_tasks').insert({
      title: form.title, description: form.description,
      priority: form.priority, tag: form.tag,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      column: addToColumn, created_by: user?.id
    })
    if (error) { toast.error(error.message); return }
    if (form.assigned_to) {
      await supabase.from('notifications').insert({
        user_id: form.assigned_to, title: 'New Task', message: form.title, type: 'task'
      })
    }
    toast.success('Task added!')
    setShowAdd(false)
    setForm({ title: '', description: '', priority: 'medium', tag: 'Operations', assigned_to: '', due_date: '', column: 'todo' })
    loadTasks()
  }

  async function moveTask(taskId: string, newColumn: string) {
    await supabase.from('kanban_tasks').update({ column: newColumn }).eq('id', taskId)
    loadTasks()
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete?')) return
    await supabase.from('kanban_tasks').delete().eq('id', id)
    loadTasks()
    setSelectedTask(null)
    toast.success('Deleted!')
  }

  async function updateTask(id: string, updates: any) {
    await supabase.from('kanban_tasks').update(updates).eq('id', id)
    loadTasks()
  }

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase())
    const matchTag = filterTag === 'all' || t.tag === filterTag
    const matchAssignee = filterAssignee === 'all' || t.assigned_to?.id === filterAssignee
    return matchSearch && matchTag && matchAssignee
  })

  const isAdmin = profile && ['founder', 'manager', 'specialist_manager'].includes(profile.role)
  const inp: any = { width: '100%', background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', marginBottom: 10 }

  if (!mounted) return null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800 }}>Task <span style={{ color: 'var(--gold)' }}>Kanban</span></h1>
          <p style={{ color: 'var(--mu)', fontSize: 12.5, marginTop: 4 }}>{tasks.length} tasks · {tasks.filter(t => t.column === 'done').length} done</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAnalytics(!showAnalytics)} style={{ padding: '8px 14px', background: showAnalytics ? 'var(--gL)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (showAnalytics ? 'rgba(212,168,83,0.3)' : 'var(--b1)'), borderRadius: 8, color: showAnalytics ? 'var(--gold)' : 'var(--mu)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>📊 Analytics</button>
          <button onClick={() => { setAddToColumn('todo'); setShowAdd(true) }} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>+ Add Task</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {COLUMNS.map(col => (
          <div key={col.id} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 6 }}>{col.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, color: col.color }}>{tasks.filter(t => t.column === col.id).length}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." style={{ ...inp, marginBottom: 0, flex: 1, minWidth: 200 }} />
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ ...inp, marginBottom: 0, width: 'auto' }}>
          <option value="all">All Tags</option>
          {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ ...inp, marginBottom: 0, width: 'auto' }}>
          <option value="all">All Members</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>


      {/* ANALYTICS */}
      {showAnalytics && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {/* Column Distribution */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Column Distribution</div>
              {COLUMNS.map(col => {
                const count = tasks.filter(t => t.column === col.id).length
                const pct = Math.round(count / (tasks.length || 1) * 100)
                return (
                  <div key={col.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{col.label}</span>
                      <span style={{ fontFamily: 'DM Mono', color: col.color }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: col.color, borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Priority Breakdown */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Priority Breakdown</div>
              {PRIORITIES.map(p => {
                const count = tasks.filter(t => t.priority === p.id).length
                const pct = Math.round(count / (tasks.length || 1) * 100)
                return (
                  <div key={p.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{p.label}</span>
                      <span style={{ fontFamily: 'DM Mono', color: p.color }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: p.color, borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Team Workload */}
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Team Workload</div>
              {(() => {
                const workload: Record<string, {name: string, total: number, done: number}> = {}
                tasks.forEach(t => {
                  if (!t.assigned_to) return
                  const key = t.assigned_to.id
                  if (!workload[key]) workload[key] = { name: t.assigned_to.name, total: 0, done: 0 }
                  workload[key].total++
                  if (t.column === 'done') workload[key].done++
                })
                const entries = Object.values(workload).sort((a,b) => b.total - a.total).slice(0,6)
                if (entries.length === 0) return <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 12, padding: 20 }}>No assignments yet</div>
                const maxTasks = Math.max(...entries.map(e => e.total), 1)
                return entries.map((e, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{e.name}</span>
                      <span style={{ fontFamily: 'DM Mono', color: 'var(--teal)' }}>{e.done}/{e.total}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ height: '100%', width: Math.round(e.done / maxTasks * 100) + '%', background: 'var(--green)', borderRadius: '4px 0 0 4px' }} />
                      <div style={{ height: '100%', width: Math.round((e.total - e.done) / maxTasks * 100) + '%', background: 'var(--blue)' }} />
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Tag breakdown + Overdue */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Tasks by Tag</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TAGS.map(tag => {
                  const count = tasks.filter(t => t.tag === tag).length
                  if (!count) return null
                  return (
                    <div key={tag} style={{ background: 'var(--blL)', borderRadius: 8, padding: '8px 12px', textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>{count}</div>
                      <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 600 }}>{tag}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="card">
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Total Tasks', value: tasks.length, color: 'var(--blue)' },
                  { label: 'Completed', value: tasks.filter(t => t.column === 'done').length, color: 'var(--green)' },
                  { label: 'Overdue', value: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.column !== 'done').length, color: 'var(--red)' },
                  { label: 'Urgent', value: tasks.filter(t => t.priority === 'urgent' && t.column !== 'done').length, color: 'var(--orange)' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12 }}>
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.column === col.id)
            return (
              <div key={col.id} style={{ minWidth: 270, flexShrink: 0 }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (draggedTask) { moveTask(draggedTask.id, col.id); setDraggedTask(null) } }}>

                {/* Column Header */}
                <div style={{ padding: '10px 13px', borderRadius: '10px 10px 0 0', background: col.bg, color: col.color, border: '1px solid ' + col.color + '33', borderBottom: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: col.color }} />
                  <span style={{ fontWeight: 700, fontSize: 12, flex: 1 }}>{col.label}</span>
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', color: col.color, padding: '1px 7px', borderRadius: 20 }}>{colTasks.length}</span>
                  <button onClick={() => { setAddToColumn(col.id); setShowAdd(true) }} style={{ background: 'none', border: 'none', color: col.color, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>+</button>
                </div>

                {/* Tasks */}
                <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderTop: 'none', borderRadius: '0 0 10px 10px', minHeight: 400, padding: 8 }}>
                  {colTasks.map(task => {
                    const priority = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1]
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.column !== 'done'
                    return (
                      <div key={task.id}
                        draggable
                        onDragStart={() => setDraggedTask(task)}
                        onClick={() => setSelectedTask(task)}
                        style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderLeft: '3px solid ' + priority.color, borderRadius: 10, padding: '11px 12px', marginBottom: 8, cursor: 'grab', transition: 'all 0.13s' }}
                        onMouseOver={e => e.currentTarget.style.borderColor = col.color}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--b1)'}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, flex: 1, marginRight: 6 }}>{task.title}</div>
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: priority.color + '22', color: priority.color, fontWeight: 700, flexShrink: 0 }}>{priority.label}</span>
                        </div>

                        {task.description && (
                          <div style={{ fontSize: 11.5, color: 'var(--mu2)', marginBottom: 8, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.description}</div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {task.tag && (
                            <span style={{ fontSize: 9.5, padding: '1px 7px', borderRadius: 20, background: 'var(--blL)', color: 'var(--blue)', fontWeight: 600 }}>{task.tag}</span>
                          )}
                          {task.assigned_to?.name && (
                            <span style={{ fontSize: 10, color: 'var(--teal)' }}>@{task.assigned_to.name.split(' ')[0]}</span>
                          )}
                          {task.due_date && (
                            <span style={{ fontSize: 10, color: isOverdue ? 'var(--red)' : 'var(--mu)', marginLeft: 'auto' }}>
                              {isOverdue ? '⚠️ ' : '📅 '}{new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {colTasks.length === 0 && (
                    <div onClick={() => { setAddToColumn(col.id); setShowAdd(true) }} style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--mu)', fontSize: 12, cursor: 'pointer', borderRadius: 8, border: '1px dashed var(--b2)' }}>
                      + Add task
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedTask(null)}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, flex: 1, marginRight: 12 }}>{selectedTask.title}</div>
              <button onClick={() => setSelectedTask(null)} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {selectedTask.description && (
              <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: 'var(--mu2)', lineHeight: 1.6 }}>{selectedTask.description}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Priority', value: selectedTask.priority },
                { label: 'Tag', value: selectedTask.tag || '—' },
                { label: 'Assigned', value: selectedTask.assigned_to?.name || 'Unassigned' },
                { label: 'Due Date', value: selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('en-IN') : '—' },
                { label: 'Created By', value: selectedTask.created_by?.name || '—' },
                { label: 'Column', value: COLUMNS.find(c => c.id === selectedTask.column)?.label || selectedTask.column },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--s2)', borderRadius: 8, padding: '9px 11px' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Move to column */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 8 }}>Move to</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {COLUMNS.map(col => (
                  <button key={col.id} onClick={() => { moveTask(selectedTask.id, col.id); setSelectedTask({ ...selectedTask, column: col.id }) }}
                    style={{ flex: 1, padding: '6px', borderRadius: 8, border: '1px solid ' + (selectedTask.column === col.id ? col.color + '55' : 'var(--b1)'), cursor: 'pointer', fontSize: 10.5, fontWeight: 600, fontFamily: 'Outfit', background: selectedTask.column === col.id ? col.bg : 'transparent', color: selectedTask.column === col.id ? col.color : 'var(--mu2)' }}>
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {isAdmin && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 6 }}>Reassign</div>
                <select onChange={e => { updateTask(selectedTask.id, { assigned_to: e.target.value || null }); setSelectedTask({ ...selectedTask, assigned_to: profiles.find(p => p.id === e.target.value) }) }}
                  style={{ ...inp, marginBottom: 0 }}>
                  <option value="">Unassigned</option>
                  {profiles.map(p => <option key={p.id} value={p.id} selected={selectedTask.assigned_to?.id === p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { updateTask(selectedTask.id, { column: 'done' }); setSelectedTask(null); toast.success('Marked done!') }} style={{ flex: 1, padding: 10, background: 'var(--grL)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, color: 'var(--green)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                ✅ Mark Done
              </button>
              {isAdmin && (
                <button onClick={() => deleteTask(selectedTask.id)} style={{ padding: '10px 16px', background: 'var(--rdL)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--red)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit' }}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 16, padding: '26px 30px', width: 480, maxWidth: '94vw' }}>
            <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Add Task</div>

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Title*</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Task title..." style={inp} />

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Details..." rows={3} style={{ ...inp, resize: 'none' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={inp}>
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Tag</label>
                <select value={form.tag} onChange={e => setForm(p => ({ ...p, tag: e.target.value }))} style={inp}>
                  {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Assign To</label>
                <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} style={inp}>
                  <option value="">Unassigned</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={inp} />
              </div>
            </div>

            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Column</label>
            <select value={addToColumn} onChange={e => setAddToColumn(e.target.value)} style={inp}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--b2)', borderRadius: 8, color: 'var(--mu2)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Cancel</button>
              <button onClick={addTask} style={{ flex: 1, padding: 10, background: 'linear-gradient(135deg,#D4A853,#B87C30)', border: 'none', borderRadius: 8, color: '#08090C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Outfit' }}>Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
