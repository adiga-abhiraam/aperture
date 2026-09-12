import { useEffect, useRef, useState } from 'react'
import { Eye, Loader2, MessageSquare, Send, Sparkles, Trash2 } from 'lucide-react'
import { askVideo, clearChat, getChat, JobsApiError, type ChatCitation, type ChatMessage } from '../lib/jobs'

const SUGGESTIONS = [
  'Summarize this video in a few sentences.',
  'What happens at the beginning and at the end?',
  'Which moment is the most important, and when is it?',
  'List every person, object or place that is mentioned or shown.',
]

const TIMESTAMP_RE = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g

function toSeconds(label: string): number {
  const parts = label.split(':').map(Number)
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
}

/** Render "[mm:ss]" tokens inside an answer as clickable pills that seek the player. */
function AnswerText({ text, onSeek }: { text: string; onSeek: (seconds: number) => void }) {
  const nodes: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(TIMESTAMP_RE)) {
    const index = match.index ?? 0
    if (index > last) nodes.push(text.slice(last, index))
    const label = match[1]
    nodes.push(
      <button
        key={`${index}-${label}`}
        type="button"
        onClick={() => onSeek(toSeconds(label))}
        className="mx-0.5 inline-flex items-center rounded-md border border-glow/40 bg-glow/10 px-1.5 py-px font-mono text-[11px] text-glow-soft transition-colors hover:bg-glow/25"
      >
        {label}
      </button>,
    )
    last = index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return <span className="whitespace-pre-wrap">{nodes}</span>
}

function Citation({ citation, onSeek }: { citation: ChatCitation; onSeek: (seconds: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSeek(citation.start)}
      className="flex w-full items-start gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-2.5 py-2 text-left transition-colors hover:border-glow/40"
    >
      <span className="shrink-0 rounded-md bg-glow/15 px-1.5 py-px font-mono text-[10px] text-glow-soft">{citation.label}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] text-paper-100/85">{citation.snippet || 'Matched moment'}</span>
        <span className="block text-[10px] uppercase tracking-wider text-paper-300/40">{citation.kind === 'transcript' ? 'speech' : 'on screen'}</span>
      </span>
    </button>
  )
}

interface VideoChatProps {
  jobId: string
  ready: boolean
  onSeek: (seconds: number) => void
}

export function VideoChat({ jobId, ready, onSeek }: VideoChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    getChat(jobId)
      .then((history) => {
        if (!cancelled) setMessages(history)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [jobId])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, busy])

  const send = async (question: string) => {
    const text = question.trim()
    if (!text || busy || !ready) return
    setDraft('')
    setBusy(true)
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    try {
      const reply = await askVideo(jobId, text)
      setMessages((prev) => [...prev, reply])
    } catch (cause) {
      const message = cause instanceof JobsApiError ? cause.message : 'The chat is unavailable right now.'
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: message, error: true }])
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  const reset = async () => {
    setMessages([])
    try {
      await clearChat(jobId)
    } catch {
      // best effort
    }
  }

  return (
    <section className="liquid-glass flex h-full min-h-[420px] flex-col rounded-2xl border border-white/10 bg-ink-900/70">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-paper-100">
          <MessageSquare size={14} className="text-glow" /> Ask this video
        </p>
        {messages.length > 0 && (
          <button type="button" onClick={() => void reset()} className="inline-flex items-center gap-1 text-[11px] text-paper-300/50 transition-colors hover:text-white" title="Clear conversation">
            <Trash2 size={11} /> Clear
          </button>
        )}
      </header>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!ready ? (
          <p className="rounded-xl border border-white/10 bg-ink-800/50 px-3 py-3 text-xs leading-relaxed text-paper-300/60">
            Chat opens once this video has been processed. The answers come only from its transcript and scene descriptions, so every timestamp can be checked in the player.
          </p>
        ) : messages.length === 0 && loaded ? (
          <div className="space-y-2">
            <p className="text-xs text-paper-300/60">Answers are grounded in what was said and shown; timestamps jump the player.</p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-ink-800/50 px-3 py-2 text-left text-xs text-paper-100/85 transition-colors hover:border-glow/40"
              >
                <Sparkles size={12} className="shrink-0 text-glow" /> {suggestion}
              </button>
            ))}
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  message.role === 'user'
                    ? 'rounded-br-md bg-glow text-black'
                    : message.error
                      ? 'rounded-bl-md border border-red-400/30 bg-red-400/10 text-red-100'
                      : 'rounded-bl-md border border-white/10 bg-ink-800/70 text-paper-100'
                }`}
              >
                {message.role === 'user' ? message.content : <AnswerText text={message.content} onSeek={onSeek} />}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {message.citations.map((citation) => (
                      <Citation key={citation.window_id + citation.label} citation={citation} onSeek={onSeek} />
                    ))}
                  </div>
                )}
                {message.role === 'assistant' && !message.error && message.found_in_video === false && (
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-amber-200/70">Not found in this video</p>
                )}
                {message.role === 'assistant' && !message.error && message.source === 'video' && (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-glow/30 bg-glow/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-glow-soft">
                    <Eye size={10} /> Watched the footage
                  </p>
                )}
                {message.role === 'assistant' && message.elapsed_seconds != null && (
                  <p className="mt-1.5 font-mono text-[10px] text-paper-300/35">
                    {message.elapsed_seconds.toFixed(1)}s
                  </p>
                )}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-ink-800/70 px-3.5 py-2.5 text-xs text-paper-300/70">
              <Loader2 size={12} className="animate-spin text-glow" /> Reading the transcript and scene notes…
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
        className="border-t border-white/10 p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border border-white/15 bg-ink-800/60 px-3 py-2 focus-within:border-glow/50">
          <textarea
            ref={input}
            value={draft}
            disabled={!ready || busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send(draft)
              }
            }}
            rows={1}
            placeholder={ready ? 'Ask anything about this video…' : 'Process the video to start chatting'}
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-paper-100 outline-none placeholder:text-paper-300/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!ready || busy || !draft.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-glow text-black transition-opacity hover:opacity-90 disabled:opacity-30"
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </section>
  )
}
