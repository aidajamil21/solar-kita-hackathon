import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, BadgeCheck, ChevronLeft, LineChart, PlugZap, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { backendApi } from '../api/backend'
import type { ChatMessage } from '../api/types'
import { AttachmentView, ToolTrace, type CardActions } from '../components/chat/Cards'
import { alertTarget, reloadAlerts } from '../components/AlertsButton'
import { SAMPLE_CONVERSATION, SUGGESTIONS } from '../components/chat/sample'
import { useStore } from '../store'
import { Info } from '../components/Info'
import { HELP } from '../help'


/** inline markdown: **bold**, *italic* / _italic_ and `code` */
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\b_[^_]+_\b)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <b key={i}>{p.slice(2, -2)}</b>
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i}>{p.slice(1, -1)}</code>
    if (/^\*[^*].*\*$|^_.+_$/.test(p)) return <i key={i}>{p.slice(1, -1)}</i>
    return <Fragment key={i}>{p}</Fragment>
  })
}

/**
 * small markdown for chat replies: paragraphs (single line breaks kept), "- " / "* " / "•" bullets,
 * "1." numbered lists, # headings (shown as bold lines), **bold**, *italic* and `code`
 */
function Rich({ text }: { text: string }) {
  type Block = { type: 'p' | 'ul' | 'ol' | 'h'; lines: string[] }
  const blocks: Block[] = []
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*(?:[-*•])\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/)
    const last = blocks[blocks.length - 1]
    if (!line.trim()) { blocks.push({ type: 'p', lines: [] }); continue }
    if (heading) blocks.push({ type: 'h', lines: [heading[1]] })
    else if (bullet) {
      if (last?.type === 'ul') last.lines.push(bullet[1])
      else blocks.push({ type: 'ul', lines: [bullet[1]] })
    } else if (numbered) {
      if (last?.type === 'ol') last.lines.push(numbered[1])
      else blocks.push({ type: 'ol', lines: [numbered[1]] })
    } else if (last?.type === 'p') last.lines.push(line.trim())
    else blocks.push({ type: 'p', lines: [line.trim()] })
  }
  return (
    <div className="chat-rich">
      {blocks.filter((b) => b.lines.length).map((b, i) => {
        if (b.type === 'h') return <h4 key={i}>{inline(b.lines[0])}</h4>
        if (b.type === 'ul') return <ul key={i}>{b.lines.map((l, k) => <li key={k}>{inline(l)}</li>)}</ul>
        if (b.type === 'ol') return <ol key={i}>{b.lines.map((l, k) => <li key={k}>{inline(l)}</li>)}</ol>
        return <p key={i}>{b.lines.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{inline(l)}</Fragment>)}</p>
      })}
    </div>
  )
}

function Avatar({ size = 34 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff', background: 'linear-gradient(150deg,#FF6E00,#F20000)', boxShadow: '0 6px 14px -6px rgba(220,0,0,.7)' }}>
      <Sparkles size={size * 0.48} />
    </span>
  )
}

function Bubble({ m, streaming, actions }: { m: ChatMessage; streaming?: string; actions?: CardActions }) {
  if (m.role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="row" style={{ justifyContent: 'flex-end' }}>
        <div style={{ maxWidth: '82%', background: 'linear-gradient(160deg,#FF2A0A,#E80000)', color: '#fff', padding: '10px 14px', borderRadius: '18px 18px 4px 18px', fontSize: 14, lineHeight: 1.45, fontWeight: 500 }}>
          {m.content}
        </div>
      </motion.div>
    )
  }
  const text = streaming ?? m.content
  const done = streaming === undefined
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
      <Avatar size={28} />
      <div className="grow">
        {m.toolCalls && <ToolTrace calls={m.toolCalls} />}
        <div style={{ background: '#fff', border: '1px solid var(--line)', padding: '10px 14px', borderRadius: '4px 18px 18px 18px', fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
          <Rich text={text} />
          {!done && <span className="caret" />}
        </div>
        {done && m.attachments?.map((a, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
            <AttachmentView a={a} {...actions} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function Typing({ tools }: { tools: ChatMessage['toolCalls'] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
      <Avatar size={28} />
      <div>
        {tools && tools.length > 0 && <ToolTrace calls={tools} live />}
        <div className="row" style={{ gap: 4, background: '#fff', border: '1px solid var(--line)', padding: '12px 14px', borderRadius: '4px 18px 18px 18px' }}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }}
              style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--brand)' }} />
          ))}
          <span className="muted" style={{ fontSize: 11.5, marginLeft: 6 }}>{tools?.length ? 'Checking verified data…' : 'Thinking…'}</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function Assistant() {
  const nav = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<{ tools: ChatMessage['toolCalls'] } | null>(null)
  const [streaming, setStreaming] = useState<{ msg: ChatMessage; text: string } | null>(null)
  const [input, setInput] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const { online, name, subs } = useStore()

  // cards and buttons in replies open the page they're about; that page offers "Back to Solar Analyst"
  const actions: CardActions = {
    onOpen: (to, section) => {
      const site = to.match(/^\/solar\/(.+)$/)?.[1]
      // a project page only exists for projects the resident holds; otherwise show it on the map
      const dest = site && !subs.some((s) => s.siteId === site) ? `/explore?site=${site}` : to
      nav(dest, { state: { from: 'assistant', section } })
    },
    onAlert: (a) => {
      const t = alertTarget(a, (id) => subs.some((s) => s.siteId === id))
      if (online && !a.read) backendApi.markAlertRead(a.id).then(reloadAlerts).catch(() => {})
      nav(t.to, { state: { from: 'assistant', section: t.section, openDoc: t.openDoc } })
    },
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (!messages.length && !pending && !streaming) return
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending, streaming])

  // online: show the saved conversation
  useEffect(() => {
    if (!online) return
    let live = true
    backendApi.chatMessages()
      .then((rows) => { if (live) setMessages(rows) })
      .catch(() => { if (live) setError('Couldn’t load your conversation from the server.') })
    return () => { live = false }
  }, [online])

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  /** show the tool trace, then type the reply out */
  const play = (reply: ChatMessage) => {
    setPending({ tools: reply.toolCalls })
    later(() => {
      setPending(null)
      const words = reply.content.split(/(\s+)/)
      let n = 0
      const tick = () => {
        n = Math.min(words.length, n + 4)
        setStreaming({ msg: reply, text: words.slice(0, n).join('') })
        if (n < words.length) later(tick, 30)
        else { setStreaming(null); setMessages((m) => [...m, reply]) }
      }
      tick()
    }, reply.toolCalls?.length ? 700 : 300)
  }

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || pending || streaming) return
    setInput('')
    setError(null)
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', content: q, createdAt: new Date().toISOString() }])

    if (online) {
      setPending({ tools: [] })
      try {
        play(await backendApi.chatSend(q))
      } catch (err) {
        setPending(null)
        setError(err instanceof Error ? err.message : 'The Solar Analyst couldn’t answer just now.')
      }
      return
    }

    const idx = SAMPLE_CONVERSATION.findIndex((m) => m.role === 'user' && m.content.toLowerCase() === q.toLowerCase())
    const sample = idx >= 0 ? SAMPLE_CONVERSATION[idx + 1] : null
    play(sample
      ? { ...sample, id: `a${Date.now()}` }
      : {
          id: `a${Date.now()}`, role: 'assistant', createdAt: new Date().toISOString(),
          content: 'I’m not connected to live data yet, so I can’t answer that one. Once the Solar Kita backend is online, I’ll answer using **verified portfolio and project data** only.\n\nIn the meantime, try one of the suggested questions to preview how answers will look.',
          suggestions: SUGGESTIONS.slice(0, 3),
        })
  }

  const clear = () => {
    timers.current.forEach(clearTimeout)
    setMessages([]); setPending(null); setStreaming(null); setError(null)
    if (online) backendApi.chatClear().catch(() => setError('Couldn’t clear the conversation on the server.'))
  }

  const last = messages[messages.length - 1]
  const followUps = !pending && !streaming && last?.role === 'assistant' ? last.suggestions : undefined

  return (
    <div className="chat-page">
      {/* header */}
      <div className="chat-head">
        <button className="icon-btn" aria-label="Back" onClick={() => nav(-1)}><ChevronLeft size={20} /></button>
        <Avatar />
        <div className="grow">
          <div style={{ fontWeight: 800, fontSize: 15 }}>Solar Analyst</div>
          <div className="row" style={{ gap: 4, fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}><ShieldCheck size={12} color="#1F8A5B" /> Answers from verified data only<Info size={12}>{HELP.verifiedData}</Info></div>
        </div>
        {messages.length > 0 && (
          <button className="icon-btn" aria-label="New conversation" onClick={clear}>
            <RotateCcw size={17} />
          </button>
        )}
      </div>

      {/* messages */}
      <div className="chat-scroll" ref={scroller}>
        {error && <div className="empty" style={{ marginBottom: 10 }}>{error}</div>}
        {messages.length === 0 && !pending && !streaming && <Welcome onPick={send} name={name.split(' ')[0]} />}
        <div className="col" style={{ gap: 14 }}>
          {messages.map((m) => <Bubble key={m.id} m={m} actions={actions} />)}
          <AnimatePresence>{pending && <Typing tools={pending.tools} />}</AnimatePresence>
          {streaming && <Bubble m={streaming.msg} streaming={streaming.text} actions={actions} />}
          {followUps && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', paddingLeft: 36 }}>
              {followUps.map((s) => <button key={s} className="chip" style={{ height: 32, fontSize: 12 }} onClick={() => send(s)}>{s}</button>)}
            </div>
          )}
        </div>
      </div>

      {/* composer */}
      <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(input) }}>
        <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask about your solar portfolio…"
            rows={1}
            aria-label="Message Solar Analyst"
          />
          <button type="submit" className="send" aria-label="Send" disabled={!input.trim() || !!pending || !!streaming}><ArrowUp size={20} strokeWidth={2.5} /></button>
        </div>
        <p className="chat-disclaimer">AI answers can be wrong. Projections aren’t guaranteed and this isn’t financial advice.</p>
      </form>
    </div>
  )
}

function Welcome({ onPick, name }: { onPick: (q: string) => void; name: string }) {
  const Point = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
    <div className="row" style={{ gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--ink-2)' }}>
      <span className="ic sm" style={{ width: 28, height: 28 }}>{icon}</span><span style={{ paddingTop: 5 }}>{children}</span>
    </div>
  )
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '12px 2px 18px' }}>
      <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Avatar size={64} />
        <h1 className="h1" style={{ fontSize: 22, marginTop: 14 }}>Hi {name}, I’m your <em>Solar Analyst</em></h1>
        <p className="sub" style={{ fontSize: 13, marginTop: 6, maxWidth: 300 }}>Ask me about your portfolio, Energy Savings Credits, project performance or environmental impact.</p>
      </div>
      <div className="card" style={{ padding: 14, marginTop: 18, display: 'grid', gap: 10 }}>
        <Point icon={<BadgeCheck size={14} />}>I only use <b>verified data</b> from Solar Kita, and I’ll tell you when something is missing or out of date.</Point>
        <Point icon={<LineChart size={14} />}>I keep <b>actual results</b> separate from <b>forecasts</b>, and I explain my assumptions.</Point>
        <Point icon={<PlugZap size={14} />}>I can’t move money or change your records, and I never share other residents’ details.</Point>
      </div>
      <div className="eyebrow" style={{ margin: '20px 0 10px' }}>Try asking</div>
      <div className="col" style={{ gap: 8 }}>
        {SUGGESTIONS.map((s) => (
          <motion.button key={s} whileTap={{ scale: 0.98 }} onClick={() => onPick(s)} className="card row between" style={{ padding: '12px 14px', textAlign: 'left', fontSize: 13.5, fontWeight: 600 }}>
            {s} <ArrowUp size={15} style={{ transform: 'rotate(45deg)', color: 'var(--brand)' }} />
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
