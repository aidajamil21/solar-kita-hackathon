import { Bell, CheckCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Alert } from '../api/types'
import { AlertRow } from './chat/Cards'
import { SAMPLE_ALERTS } from './chat/sample'
import { Seg, Sheet } from './ui'

/** Bell + notifications sheet. Sample alerts for now; will read from get_active_alerts. */
export default function AlertsButton() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>(SAMPLE_ALERTS)
  const [tab, setTab] = useState<'All' | 'Unread'>('All')
  const unread = alerts.filter((a) => !a.read).length
  const markRead = (id?: string) => setAlerts((list) => list.map((a) => (!id || a.id === id ? { ...a, read: true } : a)))
  const shown = alerts.filter((a) => tab === 'All' || !a.read)
  const day = 86_400_000
  const fresh = shown.filter((a) => Date.now() - new Date(a.createdAt).getTime() < 2 * day)
  const older = shown.filter((a) => !fresh.includes(a))

  return (
    <>
      <button className="icon-btn" aria-label={`Notifications, ${unread} unread`} onClick={() => setOpen(true)}>
        <Bell size={18} />
        {unread > 0 && <span className="bell-count">{unread}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Notifications">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="eyebrow">Alerts</div>
            <h2 className="h2" style={{ fontSize: 18, marginTop: 4 }}>Notifications</h2>
          </div>
          {unread > 0 && (
            <button className="pill-link" onClick={() => markRead()}><CheckCheck size={13} /> Mark all read</button>
          )}
        </div>
        <div style={{ margin: '14px 0 4px' }}>
          <Seg id="alerts" options={['All', 'Unread'] as const as ('All' | 'Unread')[]} value={tab} onChange={setTab} />
        </div>
        {shown.length === 0 && <div className="empty">You’re all caught up.</div>}
        {[['New', fresh], ['Earlier', older]].map(([label, list]) => (list as Alert[]).length > 0 && (
          <div key={label as string}>
            <div className="eyebrow" style={{ margin: '14px 0 2px' }}>{label as string}</div>
            <div className="list">{(list as Alert[]).map((a) => <AlertRow key={a.id} a={a} onClick={() => markRead(a.id)} />)}</div>
          </div>
        ))}
        <button className="btn ghost block" style={{ marginTop: 16 }} onClick={() => { setOpen(false); nav('/assistant') }}>
          <Sparkles size={16} color="#E60000" /> Ask Solar Analyst about my alerts
        </button>
      </Sheet>
    </>
  )
}
