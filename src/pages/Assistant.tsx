import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, BadgeCheck, ChevronLeft, LineChart, PlugZap, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChatMessage } from '../api/types'
import { AttachmentView, ToolTrace } from '../components/chat/Cards'
import { SAMPLE_CONVERSATION, SUGGESTIONS } from '../components/chat/sample'

/** tiny markdown: paragraphs, "- " bullet lists and **bold** */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))
  return (
    <>
      {text.split(/\n\n+/).map((block, i) => {
        const lines = block.split('\n')
        if (lines.every((l) => l.startsWith('- '))) {
          return <ul key={i} style={{ margin: '6px 0', paddingLeft: 18 }}>{lines.map((l, k) => <li key={k} style={{ margin: '2px 0' }}>{inline(l.slice(2))}</li>)}</ul>
        }
        return <p key={i} style={{ margin: i ? '8px 0 0' : 0 }}>{inline(block)}</p>
      })}
    </>
  )
}

function Avatar({ size = 34 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff', background: 'linear-gradient(150deg,#FF6E00,#F20000)', boxShadow: '0 6px 14px -6px rgba(220,0,0,.7)' }}>
      <Sparkles size={size * 0.48} />
    </span>
  )
}

function Bubble({ m, streaming }: { m: ChatMessage; streaming?: string }) {
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
            <AttachmentView a={a} />
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

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (!messages.length && !pending && !streaming) return
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending, streaming])

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  /** Preview only: plays the sample answer for a suggested question. Replace with the chat API. */
  const send = (text: string) => {
    const q = text.trim()
    if (!q || pending || streaming) return
    setInput('')
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', content: q, createdAt: new Date().toISOString() }])
    const idx = SAMPLE_CONVERSATION.findIndex((m) => m.role === 'user' && m.content.toLowerCase() === q.toLowerCase())
    const sample = idx >= 0 ? SAMPLE_CONVERSATION[idx + 1] : null
    const reply: ChatMessage = sample
      ? { ...sample, id: `a${Date.now()}` }
      : {
          id: `a${Date.now()}`, role: 'assistant', createdAt: new Date().toISOString(),
          content: 'I’m not connected to live data yet, so I can’t answer that one. Once the Solar Kita backend is online, I’ll answer using **verified portfolio and project data** only.\n\nIn the meantime, try one of the suggested questions to preview how answers will look.',
          suggestions: SUGGESTIONS.slice(0, 3),
        }
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
    }, reply.toolCalls?.length ? 1100 : 600)
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
          <div className="row" style={{ gap: 4, fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}><ShieldCheck size={12} color="#1F8A5B" /> Answers from verified data only</div>
        </div>
        {messages.length > 0 && (
          <button className="icon-btn" aria-label="New conversation" onClick={() => { timers.current.forEach(clearTimeout); setMessages([]); setPending(null); setStreaming(null) }}>
            <RotateCcw size={17} />
          </button>
        )}
      </div>

      {/* messages */}
      <div className="chat-scroll" ref={scroller}>
        {messages.length === 0 && !pending && !streaming && <Welcome onPick={send} />}
        <div className="col" style={{ gap: 14 }}>
          {messages.map((m) => <Bubble key={m.id} m={m} />)}
          <AnimatePresence>{pending && <Typing tools={pending.tools} />}</AnimatePresence>
          {streaming && <Bubble m={streaming.msg} streaming={streaming.text} />}
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

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  const Point = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
    <div className="row" style={{ gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--ink-2)' }}>
      <span className="ic sm" style={{ width: 28, height: 28 }}>{icon}</span><span style={{ paddingTop: 5 }}>{children}</span>
    </div>
  )
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '12px 2px 18px' }}>
      <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Avatar size={64} />
        <h1 className="h1" style={{ fontSize: 22, marginTop: 14 }}>Hi Jane, I’m your <em>Solar Analyst</em></h1>
        <p className="sub" style={{ fontSize: 13, marginTop: 6, maxWidth: 300 }}>Ask me about your portfolio, payouts, project performance or environmental impact.</p>
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
