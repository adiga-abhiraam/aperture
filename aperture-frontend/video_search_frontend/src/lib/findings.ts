// The Results tab: every moment the chat cited, grouped by the question that
// produced it, so a viewer can jump to it, cut it, or export the whole list
// without scrolling back through the conversation.
import type { ChatCitation, ChatMessage } from './jobs'

export interface Finding {
  /** Stable per (question, second) so re-renders keep rows in place. */
  id: string
  start: number
  end: number
  label: string
  snippet: string
  kind: ChatCitation['kind']
}

export interface FindingGroup {
  id: string
  question: string
  /** Reference photo attached to the question, when there was one. */
  imageUrl?: string
  lookingFor?: string
  answer: string
  source: 'transcript' | 'video'
  askedAt?: number
  findings: Finding[]
}

/** Seconds of lead-in and tail around a cited second for a downloadable clip. */
export const CLIP_LEAD_SECONDS = 5
export const CLIP_TAIL_SECONDS = 10

export function clipRange(finding: Finding, duration: number): { start: number; end: number } {
  const start = Math.max(0, Math.floor(finding.start) - CLIP_LEAD_SECONDS)
  // Cover the whole cited window when the citation is one, else a short tail.
  const naturalEnd = finding.end > finding.start ? finding.end : finding.start + CLIP_TAIL_SECONDS
  const end = Math.ceil(Math.max(naturalEnd, finding.start + CLIP_TAIL_SECONDS))
  return { start, end: duration > 0 ? Math.min(end, Math.ceil(duration)) : end }
}

/** Newest question first; within a question, moments in video order. */
export function findingsFromMessages(messages: ChatMessage[]): FindingGroup[] {
  const groups: FindingGroup[] = []
  let lastUser: ChatMessage | null = null
  for (const message of messages) {
    if (message.role === 'user') {
      lastUser = message
      continue
    }
    if (message.error || !message.citations || message.citations.length === 0) continue
    const seen = new Set<number>()
    const findings: Finding[] = []
    for (const citation of message.citations) {
      const second = Math.floor(citation.start)
      if (seen.has(second)) continue
      seen.add(second)
      findings.push({
        id: `${message.id}-${second}`,
        start: citation.start,
        end: citation.end,
        label: citation.label,
        snippet: citation.snippet,
        kind: citation.kind,
      })
    }
    findings.sort((a, b) => a.start - b.start)
    groups.push({
      id: message.id,
      question: lastUser?.content ?? '',
      imageUrl: lastUser?.image_url ?? lastUser?.image_preview,
      lookingFor: message.reference?.subject || undefined,
      answer: message.content,
      source: message.source ?? 'transcript',
      askedAt: lastUser?.created_at,
      findings,
    })
  }
  return groups.reverse()
}

export function countFindings(groups: FindingGroup[]): number {
  return groups.reduce((sum, group) => sum + group.findings.length, 0)
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** One row per cited moment; opens cleanly in Excel / Sheets. */
export function findingsToCsv(title: string, groups: FindingGroup[]): string {
  const rows: (string | number)[][] = [['video', 'timestamp', 'seconds', 'question', 'evidence', 'answer', 'source']]
  for (const group of groups) {
    for (const finding of group.findings) {
      rows.push([
        title,
        finding.label,
        Math.round(finding.start),
        group.question,
        finding.snippet,
        group.answer.replace(/\s+/g, ' ').trim(),
        group.source === 'video' ? 'watched footage' : 'transcript & scene notes',
      ])
    }
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}
