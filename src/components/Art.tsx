import { useId } from 'react'
import { KIND_PHOTOS, type SiteKind, type Township } from '../data'
import { asset } from '../asset'

/** Real project photography per initiative type. `hero` picks the wide shot. */
export function ProjectArt({ kind, hero = false, style, className }: { kind: SiteKind; hero?: boolean; style?: React.CSSProperties; className?: string }) {
  const ph = KIND_PHOTOS[kind]
  return <img src={hero ? ph.hero : ph.thumb} alt="" className={`photo ${className ?? ''}`} style={style} loading="lazy" draggable={false} />
}

/** Township photo, or a snapshot of its 3D map when we don't have one */
export function TownPhoto({ township, className }: { township: Township; className?: string }) {
  return <img src={township.photo ?? asset(`previews/${township.id}.jpg`)} alt="" className={`photo ${className ?? ''}`} loading="lazy" draggable={false} />
}

/** Sime Darby Property RM50 shopping voucher (generated artwork) */
export function VoucherArt({ amount = 50 }: { amount?: number }) {
  const leaf = (x: number, y: number, r: number, s: number, c: string) => (
    <path d="M0 0 C 18 -22 52 -22 70 0 C 52 22 18 22 0 0Z M0 0 L70 0" fill={c} stroke="#4f8b4a" strokeWidth="1.2" transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} />
  )
  return (
    <div className="voucher-art">
      <svg viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden>
        {leaf(-6, 40, -20, 1.2, '#6fae5f')}{leaf(10, 120, -50, 1.1, '#5e9f52')}{leaf(230, 30, 200, 1.1, '#7ab86a')}
        {leaf(262, 120, 230, 1.2, '#5e9f52')}{leaf(40, 10, 30, 0.9, '#8cc47a')}{leaf(200, 170, -120, 1, '#6fae5f')}
        <ellipse cx="150" cy="160" rx="96" ry="12" fill="#ffffff" opacity=".9" />
        <ellipse cx="150" cy="166" rx="96" ry="10" fill="#dfe6dc" />
      </svg>
      <div style={{ position: 'relative', width: '62%', aspectRatio: '1.6', background: '#fff', borderRadius: 12, transform: 'rotate(-7deg) translateY(-6%)', boxShadow: '0 18px 30px -14px rgba(0,0,0,.45)', padding: '9% 9% 7%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div className="row between" style={{ gap: 6 }}>
          <img src={asset('sdp-logo.png')} alt="" style={{ height: '34%', minHeight: 18, maxHeight: 30, width: 'auto' }} />
          <div style={{ fontSize: 'clamp(6px, 2.2vw, 9px)', fontWeight: 800, letterSpacing: '.06em', lineHeight: 1.15, textAlign: 'right', color: '#15181d' }}>SHOPPING<br />VOUCHER</div>
        </div>
        <div style={{ textAlign: 'right', fontWeight: 800, color: '#15181d', lineHeight: 1 }}>
          <span style={{ fontSize: 'clamp(8px, 2.6vw, 12px)' }}>RM </span><span style={{ fontSize: 'clamp(18px, 7vw, 30px)' }}>{amount}</span>
        </div>
      </div>
    </div>
  )
}

/** a small greyscale aerial township with gold-glowing sites, for map teasers & township thumbnails */
export function AerialArt({ style, highlight = true }: { style?: React.CSSProperties; highlight?: boolean }) {
  const id = useId().replace(/:/g, '')
  const blocks: [number, number, number][] = []
  for (let gx = 0; gx < 7; gx++) for (let gy = 0; gy < 6; gy++) blocks.push([gx, gy, (gx * 7 + gy * 13) % 5])
  const iso = (x: number, y: number) => [160 + (x - y) * 26, 18 + (x + y) * 15] as const
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" style={{ display: 'block', width: '100%', height: '100%', ...style }} aria-hidden>
      <defs>
        <radialGradient id={`gl${id}`}>
          <stop offset="0" stopColor="#FFC24A" stopOpacity=".9" />
          <stop offset="1" stopColor="#FF6E00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill="#DADCD7" />
      {blocks.map(([gx, gy, v]) => {
        const site = highlight && ((gx === 4 && gy === 2) || (gx === 2 && gy === 4))
        const [x, y] = iso(gx, gy)
        if (site) {
          return (
            <g key={`${gx}${gy}`}>
              <ellipse cx={x} cy={y + 14} rx="38" ry="22" fill={`url(#gl${id})`} />
              <path d={`M${x} ${y + 2} l22 12.5 l-22 12.5 l-22 -12.5z`} fill="#CBC7BB" stroke="#FF5A00" strokeWidth="1.6" />
              {[0, 1, 2, 3].map((k) => (
                <path key={k} d={`M${x - 14 + k * 5} ${y + 10 + k * 2.8} l14 8 l-3 1.7 l-14 -8z`} fill="#2A4370" />
              ))}
            </g>
          )
        }
        return (
          <g key={`${gx}${gy}`}>
            <path d={`M${x} ${y + 2} l22 12.5 l-22 12.5 l-22 -12.5z`} fill={v === 0 ? '#C3CBBD' : '#E3E3DE'} />
            {v === 0
              ? [[-8, 12], [6, 10], [0, 18], [10, 17]].map(([dx, dy], k) => <circle key={k} cx={x + dx} cy={y + dy - 3} r="4.5" fill="#9AA796" />)
              : [[-9, 11], [0, 6], [9, 11], [0, 16]].map(([dx, dy], k) => (
                <g key={k}>
                  <path d={`M${x + dx - 5} ${y + dy} l5 2.8 l5 -2.8 v-${4 + ((v + k) % 3) * 2} l-5 -2.8 l-5 2.8z`} fill="#F4F4F1" />
                  <path d={`M${x + dx} ${y + dy + 2.8} l5 -2.8 v-${4 + ((v + k) % 3) * 2} l-5 2.8z`} fill="#D2D1CC" />
                </g>
              ))}
          </g>
        )
      })}
    </svg>
  )
}
