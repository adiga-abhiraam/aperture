import { useEffect } from 'react'
import { ArrowRight, Eye, Film, Image, Mic, Play, Volume2 } from 'lucide-react'
import { Nav } from '../components/Nav'
import { BackgroundVideo } from '../components/BackgroundVideo'
import { ParticleField } from '../components/ParticleField'
import { RTL_LANGUAGES } from '../lib/i18n'
import { useLanguage } from '../lib/settings'
import { navigate } from '../lib/router'
import { track } from '../lib/analytics'

const CAPABILITIES = [
  { icon: Film, title: 'Describe it', copy: 'Search using natural-language text.' },
  { icon: Mic, title: 'Say it', copy: 'Ask by voice in your own language.' },
  { icon: Image, title: 'Show it', copy: 'Upload a reference image to find a person or object.' },
  { icon: Play, title: 'Match it', copy: 'Provide a reference clip to find similar moments.' },
]

const SIGNALS = [
  ['Visual content', Eye], ['Audio events', Volume2], ['Spoken words', Mic], ['Captions, objects and actions', Film],
] as const

function route(path: string, event?: string) {
  if (event) track(event)
  navigate(path)
}

export function Landing() {
  const [language] = useLanguage()
  const rtl = RTL_LANGUAGES.has(language)

  useEffect(() => {
    track('landing_viewed', { language })
  }, [language])

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-paper-100" dir={rtl ? 'rtl' : 'ltr'}>
      <section className="relative overflow-hidden pb-12 md:pb-16">
        <BackgroundVideo />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black" />
        <div className="relative z-10"><Nav /></div>
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-5 pt-8 text-center md:pt-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-glow">Aperture</p>
          <h1 className="mt-5 max-w-4xl text-5xl leading-[0.98] tracking-tight text-white md:text-7xl" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Search any video archive <span className="italic text-glow">the way you remember it.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-white/70 md:text-lg">
            Ask with text, voice, an image or another clip, in 13 Indian languages, and retrieve the exact playable moment.
          </p>
        </div>
      </section>

      <main className="relative bg-black"><ParticleField />
        <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-10 md:pb-24 md:pt-14"><p className="eyebrow">Search the way you remember</p><div className="mt-8 grid gap-4 md:grid-cols-4">{CAPABILITIES.map(({ icon: Icon, title, copy }) => <article key={title} className="rounded-2xl border border-white/10 bg-ink-900/60 p-5"><Icon className="text-glow" size={20}/><h3 className="mt-5 text-lg text-white">{title}</h3><p className="mt-2 text-sm text-paper-300/55">{copy}</p></article>)}</div></section>

        <section className="relative z-10 mx-auto max-w-6xl border-y border-white/10 px-5 py-24"><p className="eyebrow">From hours of footage to the exact moment</p><div className="mt-9 grid gap-8 md:grid-cols-3">{['Choose footage', 'Ask naturally', 'Play the matching moment'].map((label, i) => <div key={label}><span className="font-mono text-xs text-glow">0{i + 1}</span><h3 className="mt-3 text-2xl text-white">{label}</h3></div>)}</div><button onClick={() => route('/how-it-works', 'how_it_works_opened')} className="mt-10 inline-flex items-center gap-2 text-sm text-glow">How it works <ArrowRight size={15}/></button></section>

        <section className="relative z-10 mx-auto grid max-w-6xl gap-16 px-5 py-24 lg:grid-cols-2"><div><p className="eyebrow">Built for difficult footage</p><h2 className="mt-4 text-4xl text-white" style={{ fontFamily: "'Instrument Serif', serif" }}>Real archives are rarely clean.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-paper-300/60">Silent video, audio-only inputs, low-light scenes, contradictory signals, long recordings and honest no-result queries are part of the design—not afterthoughts.</p></div><div><p className="eyebrow">How Aperture understands video</p><div className="mt-5 grid grid-cols-2 gap-3">{SIGNALS.map(([label, Icon]) => <div key={label} className="rounded-xl border border-white/10 p-4"><Icon size={16} className="text-glow"/><p className="mt-3 text-sm text-white/80">{label}</p></div>)}</div><p className="mt-5 text-sm leading-7 text-paper-300/60">Each signal stays independent and ranking combines the evidence, so a missing or misleading modality does not automatically ruin the result.</p><button onClick={() => route('/design')} className="mt-5 text-sm text-glow">View technical design →</button></div></section>

        <section className="relative z-10 mx-auto max-w-5xl px-5 py-28 text-center"><h2 className="text-5xl text-white md:text-6xl" style={{ fontFamily: "'Instrument Serif', serif" }}>Your footage already contains the answer.</h2><p className="mx-auto mt-5 max-w-xl text-white/60">Aperture helps you find the exact moment without scrubbing through the entire recording.</p><button onClick={() => { track('product_hunt_cta_clicked'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="mt-8 rounded-full bg-glow px-7 py-3 font-semibold text-black">Learn more</button></section>
      </main>
    </div>
  )
}
