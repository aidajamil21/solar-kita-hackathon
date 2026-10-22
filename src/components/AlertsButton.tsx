import { Bell, CheckCheck, Sparkles } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Alert } from '../api/types'
import { backendApi } from '../api/backend'
import { siteById } from '../data'
import { useStore } from '../store'
import { AlertRow } from './chat/Cards'
import { SAMPLE_ALERTS } from './chat/sample'
import { Seg, Sheet } from './ui'

/* ---------- shared alerts state (the bell lives on every page, the sheet is mounted once) ---------- */
const listeners = new Set<() => void>()
// with a backend the list starts empty and loads from /api/alerts; the local demo uses the sample alerts
let snap = { alerts: (backendApi.isConfigured() ? [] : SAMPLE_ALERTS) as Alert[], open: false, online: false }
const set = (next: Partial<typeof snap>) => { snap = { ...snap, ...next }; listeners.forEach((l) => l()) }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const useAlertsState = () => useSyncExternalStore(subscribe, () => snap)

export const openAlerts = () => set({ open: true })

/** fetch the resident's alerts from the backend (no-op in the local demo) */
export async function reloadAlerts() {
  if (!snap.online) return
  try { set({ alerts: await backendApi.getActiveAlerts() }) } catch { /* keep what we have */ }
}

const markRead = async (id?: string) => {
  set({ alerts: snap.alerts.map((a) => (!id || a.id === id ? { ...a, read: true } : a)) })
  if (!snap.online) return
  try {
    await (id ? backendApi.markAlertRead(id) : backendApi.markAllAlertsRead())
  } catch {
    void reloadAlerts()
  }
}

/** where tapping an alert takes the user: a route plus the section of that page to scroll to */
export interface AlertTarget { to: string; section?: string; openDoc?: 'docs' }
export function alertTarget(a: Alert, subscribed: (siteId: string) => boolean): AlertTarget {
  const site = a.projectId ? siteById(a.projectId) : undefined
  const mine = !!site && subscribed(site.id)
  const onMap = site ? { to: `/explore?site=${site.id}` } : { to: '/solar' }
  switch (a.type) {
    case 'low_generation':
    case 'project_outage':
      return mine ? { to: `/solar/${site!.id}`, section: 'performance' } : onMap
    case 'project_report':
      return mine ? { to: `/solar/${site!.id}`, section: 'documents', openDoc: 'docs' } : onMap
    case 'contribution_recorded':
      return mine ? { to: `/solar/${site!.id}`, section: 'units' } : onMap
    case 'funding_milestone':
      return site ? onMap : { to: '/explore' }
    case 'payout_completed':
    case 'payout_overdue':
      return { to: '/solar', section: 'credits' }
    case 'rewards_milestone':
      return { to: '/rewards', section: 'points' }
  }
}

/** Bell with unread count; opens the notifications sheet. */
export default function AlertsButton() {
  const { alerts } = useAlertsState()
  const unread = alerts.filter((a) => !a.read).length
  return (
    <button className="icon-btn" aria-label={`Notifications, ${unread} unread`} onClick={openAlerts}>
      <Bell size={18} />
      {unread > 0 && <span className="bell-count">{unread}</span>}
    </button>
  )
}

/** the notifications sheet; rows open the page (and section) the alert is about */
export function AlertsSheet() {
  const nav = useNavigate()
  const store = useStore()
  const { alerts, open } = useAlertsState()
  const [tab, setTab] = useState<'All' | 'Unread'>('All')
  const [loading, setLoading] = useState(false)
  const unread = alerts.filter((a) => !a.read).length
  const shown = alerts.filter((a) => tab === 'All' || !a.read)
  const day = 86_400_000
  const fresh = shown.filter((a) => Date.now() - new Date(a.createdAt).getTime() < 2 * day)
  const older = shown.filter((a) => !fresh.includes(a))
  const close = () => set({ open: false })

  // online: load now, whenever the sheet opens, and every minute so new alerts show on the bell
  useEffect(() => {
    if (!store.online) {
      if (snap.online || !snap.alerts.length) set({ alerts: SAMPLE_ALERTS, online: false })
      return
    }
    snap.online = true
    void reloadAlerts()
    const t = window.setInterval(() => { void reloadAlerts() }, 60_000)
    return () => window.clearInterval(t)
  }, [store.online])
  useEffect(() => {
    if (!open || !store.online) return
    setLoading(!snap.alerts.length)
    reloadAlerts().finally(() => setLoading(false))
  }, [open, store.online])

  const go = (a: Alert) => {
    void markRead(a.id)
    const t = alertTarget(a, (id) => store.subs.some((s) => s.siteId === id))
    close()
    nav(t.to, { state: { from: 'alerts', section: t.section, openDoc: t.openDoc } })
  }

  return (
    <Sheet open={open} onClose={close} label="Notifications">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="eyebrow">Alerts</div>
          <h2 className="h2" style={{ fontSize: 18, marginTop: 4 }}>Notifications</h2>
        </div>
        {unread > 0 && (
          <button className="pill-link" onClick={() => { void markRead() }}><CheckCheck size={13} /> Mark all read</button>
        )}
      </div>
      <div style={{ margin: '14px 0 4px' }}>
        <Seg id="alerts" options={['All', 'Unread'] as const as ('All' | 'Unread')[]} value={tab} onChange={setTab} />
      </div>
      {loading && <div className="empty">Loading alerts…</div>}
      {!loading && shown.length === 0 && <div className="empty">You’re all caught up.</div>}
      {[['New', fresh], ['Earlier', older]].map(([label, list]) => (list as Alert[]).length > 0 && (
        <div key={label as string}>
          <div className="eyebrow" style={{ margin: '14px 0 2px' }}>{label as string}</div>
          <div className="list">{(list as Alert[]).map((a) => <AlertRow key={a.id} a={a} onClick={() => go(a)} />)}</div>
        </div>
      ))}
      <button className="btn ghost block" style={{ marginTop: 16 }} onClick={() => { close(); nav('/assistant') }}>
        <Sparkles size={16} color="#E60000" /> Ask Solar Analyst about my alerts
      </button>
    </Sheet>
  )
}
