import { describe, expect, it } from 'vitest'
import { clipRange, countFindings, findingsFromMessages, findingsToCsv } from './findings'
import type { ChatMessage } from './jobs'

const messages: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'when is the bike taken?', image_url: '/img/1.jpg', created_at: 1 },
  {
    id: 'a1',
    role: 'assistant',
    content: 'Taken at [00:58].',
    source: 'video',
    reference: { subject: 'red motorcycle', description: '', distinguishing_marks: [] },
    citations: [
      { window_id: 'w5', window_index: 5, start: 58, end: 60, label: '00:58', snippet: 'man wheels bike', kind: 'visual' },
      { window_id: 'w5', window_index: 5, start: 58.4, end: 60, label: '00:58', snippet: 'dup', kind: 'visual' },
      { window_id: 'w2', window_index: 2, start: 20, end: 30, label: '00:20', snippet: 'approach', kind: 'visual' },
    ],
  },
  { id: 'u2', role: 'user', content: 'summarise' },
  { id: 'a2', role: 'assistant', content: 'nothing cited' },
  { id: 'u3', role: 'user', content: 'who speaks?' },
  { id: 'a3', role: 'assistant', content: 'oops', error: true, citations: [{ window_id: 'x', window_index: 0, start: 1, end: 2, label: '00:01', snippet: '', kind: 'transcript' }] },
]

describe('findingsFromMessages', () => {
  it('groups citations under the question that produced them, newest first, deduped per second', () => {
    const groups = findingsFromMessages(messages)
    expect(groups).toHaveLength(1)
    const [group] = groups
    expect(group.question).toBe('when is the bike taken?')
    expect(group.imageUrl).toBe('/img/1.jpg')
    expect(group.lookingFor).toBe('red motorcycle')
    expect(group.source).toBe('video')
    expect(group.findings.map((f) => f.label)).toEqual(['00:20', '00:58'])
    expect(countFindings(groups)).toBe(2)
  })

  it('skips answers without citations and errored answers', () => {
    expect(findingsFromMessages(messages.slice(2))).toEqual([])
  })
})

describe('clipRange', () => {
  it('leads in before the moment and covers the cited window or a short tail', () => {
    expect(clipRange({ id: 'x', start: 58, end: 60, label: '', snippet: '', kind: 'visual' }, 452)).toEqual({ start: 53, end: 68 })
    expect(clipRange({ id: 'x', start: 2, end: 2, label: '', snippet: '', kind: 'visual' }, 452)).toEqual({ start: 0, end: 12 })
    expect(clipRange({ id: 'x', start: 448, end: 452, label: '', snippet: '', kind: 'visual' }, 452)).toEqual({ start: 443, end: 452 })
  })
})

describe('findingsToCsv', () => {
  it('writes one row per moment and escapes commas and quotes', () => {
    const csv = findingsToCsv('CCTV, cam "1"', findingsFromMessages(messages))
    const lines = csv.split('\n')
    expect(lines[0]).toBe('video,timestamp,seconds,question,evidence,answer,source')
    expect(lines).toHaveLength(3)
    expect(lines[1].startsWith('"CCTV, cam ""1""",00:20,20,when is the bike taken?,approach,')).toBe(true)
  })
})
