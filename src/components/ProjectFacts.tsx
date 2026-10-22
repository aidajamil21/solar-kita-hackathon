import { motion } from 'framer-motion'
import { BarChart3, ChevronRight, Coins, Leaf, Star } from 'lucide-react'
import { createElement } from 'react'
import { KINDS, rm, type Site, type SiteKind } from '../data'
import { ProjectArt } from './Art'
import { Coin } from './ui'
import { Info } from './Info'
import { HELP } from '../help'

const ENTRY_NOTE: Record<SiteKind, string> = {
  subscription: 'Flexible subscription plans',
  investment: 'Long-term investment',
  rooftop: 'Per rooftop system',
  ev: 'Per charger bay',
}

/** Entry cost · expected return · reward points · carbon savings for one project */
export function ProjectFacts({ site, layout = 'list' }: { site: Site; layout?: 'list' | 'grid' }) {
  const unit = KINDS[site.kind].unitName
  const rows = [
    { icon: Coins, label: 'Entry cost', value: `From ${rm(site.pricePerUnit)}`, note: ENTRY_NOTE[site.kind], help: HELP.entryCost(unit) },
    { icon: BarChart3, label: 'Expected return', value: `${site.returnLow} – ${site.returnHigh}% p.a.`, note: 'Plus your money back over 10 years', help: HELP.expectedReturn },
    { icon: Star, label: 'Reward points', value: `+ ${site.pointsPerUnit} points`, note: `Per ${unit}`, help: HELP.rewardPoints(unit) },
    { icon: Leaf, label: 'Carbon savings', value: `~ ${site.co2PerUnit} tCO₂e / year`, note: `Per ${unit}`, help: HELP.carbon },
  ]
  if (layout === 'grid') {
    return (
      <div className="kv">
        {rows.map((r) => (
          <div key={r.label}>
            <span className="ic sm gold">{createElement(r.icon, { size: 15 })}</span>
            <div style={{ minWidth: 0 }}><div className="k">{r.label}<Info size={13}>{r.help}</Info></div><div className="v" style={{ fontSize: 13.5 }}>{r.value}</div></div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="list">
      {rows.map((r) => (
        <div key={r.label} className="list-row" style={{ padding: '10px 0' }}>
          <span className="ic gold">{createElement(r.icon, { size: 18 })}</span>
          <div className="grow">
            <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{r.label}<Info size={13}>{r.help}</Info></div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em' }}>{r.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.note}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** "Earn points across every initiative" cards */
export function InitiativeStrip({ sites, activeId, onPick }: { sites: Site[]; activeId?: string; onPick: (s: Site) => void }) {
  return (
    <div className="hscroll" style={{ gap: 10 }}>
      {sites.map((s) => {
        const meta = KINDS[s.kind]
        const on = s.id === activeId
        return (
          <motion.button key={s.id} whileTap={{ scale: 0.97 }} onClick={() => onPick(s)} className="card"
            style={{ width: 268, padding: 10, textAlign: 'left', borderColor: on ? 'var(--gold)' : undefined, boxShadow: on ? '0 0 0 1.5px var(--gold)' : undefined }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 70, height: 62, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}><ProjectArt kind={s.kind} /></div>
              <div className="grow">
                <div className="row" style={{ gap: 6 }}>
                  {createElement(meta.icon, { size: 14, color: '#E08600' })}
                  <span style={{ fontWeight: 800, fontSize: 12.5 }} className="grow ellipsis">{meta.label}</span>
                  <ChevronRight size={14} className="muted" />
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.35 }}>{meta.blurb.split('.')[0]}.</div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10, gap: 0, borderTop: '1px solid var(--line-2)', paddingTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>From</div>
                <div className="num" style={{ fontWeight: 800, fontSize: 12.5 }}>{rm(s.pricePerUnit)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="num" style={{ fontWeight: 800, fontSize: 12.5 }}>{s.returnLow} – {s.returnHigh}%</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Est. return</div>
              </div>
              <div className="row" style={{ gap: 5 }}>
                <Coin size={18} />
                <div>
                  <div className="num" style={{ fontWeight: 800, fontSize: 12.5 }}>+ {s.pointsPerUnit}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Points</div>
                </div>
              </div>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
