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
let snap = { alerts: SAMPLE_ALERTS as Alert[], open: false }
const set = (next: Partial<typeof snap>) => { snap = { ...snap, ...next }; listeners.forEach((l) => l()) }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const useAlertsState = () => useSyncExternalStore(subscribe, () => snap)

export const openAlerts = () => set({ open: true })
const markRead = async (id?: string) => {
  set({ alerts: snap.alerts.map((a) => (!id || a.id === id ? { ...a, read: true } : a)) })
  if (!backendApi.isConfigured()) return
  try {
    if (id) {
      await backendApi.markAlertRead(id)
      return
    }
    await Promise.all(snap.alerts.map((a) => backendApi.markAlertRead(a.id)))
  } catch {
    // Keep optimistic UI state in demo mode if API mark-read fails.
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

/** Bell with unread count; opens the notifications sheet. Sample alerts for now; will read from get_active_alerts. */
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

  useEffect(() => {
    if (!open || !backendApi.isConfigured()) return
    let live = true
    setLoading(true)
    backendApi.getActiveAlerts()
      .then(async (rows) => {
        if (!live) return
        if (rows.length > 0) {
          set({ alerts: rows })
          return
        }
        await backendApi.seedDemoData((import.meta.env.VITE_DEMO_CONVERSATION_ID as string | undefined)?.trim() || '00000000-0000-0000-0000-000000000001')
        const seeded = await backendApi.getActiveAlerts()
        if (live) set({ alerts: seeded })
      })
      .catch(() => { /* fallback to local sample alerts */ })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [open])

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
