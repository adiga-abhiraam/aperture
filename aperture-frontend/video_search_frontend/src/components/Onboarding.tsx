import { useState } from 'react'
import { ArrowRight, Languages, Server, Sparkles } from 'lucide-react'
import { LANGUAGE_OPTIONS } from '../lib/languages'
import { stringsFor, RTL_LANGUAGES } from '../lib/i18n'
import {
  completeOnboarding,
  setDeployment,
  useLanguage,
} from '../lib/settings'

type Step = 'welcome' | 'language' | 'profile'

const ORDER: Step[] = ['welcome', 'language', 'profile']

interface OnboardingProps {
  onDone: () => void
}

export function Onboarding({ onDone }: OnboardingProps) {
  const [language, setLocalLanguage] = useLanguage()
  const t = stringsFor(language)
  const rtl = RTL_LANGUAGES.has(language)

  const [step, setStep] = useState<Step>('welcome')

  const position = ORDER.indexOf(step)

  const finish = () => {
    setDeployment('self-hosted')
    completeOnboarding()
    onDone()
  }

  const skip = () => {
    completeOnboarding()
    onDone()
  }

  const next = () => {
    const following = ORDER[position + 1]
    if (following) setStep(following)
    else finish()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm"
      dir={rtl ? 'rtl' : 'ltr'}
    >
      <div className="liquid-glass w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900/90 p-6">
        <div className="mb-5 flex items-center gap-1.5">
          {ORDER.map((item, index) => (
            <span
              key={item}
              className={`h-0.5 flex-1 rounded-full transition-colors ${
                index <= position ? 'bg-glow' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {step === 'welcome' && (
          <div>
            <Sparkles size={22} className="text-glow" />
            <h2
              className="mt-3 text-3xl leading-tight text-white"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              {t.onboardWelcomeTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-paper-300/70">
              {t.onboardWelcomeBody}
            </p>
          </div>
        )}

        {step === 'language' && (
          <div>
            <Languages size={20} className="text-glow" />
            <h2 className="mt-3 text-lg text-paper-100">{t.onboardLanguageTitle}</h2>
            <p className="mt-1 text-xs text-paper-300/50">{t.onboardLanguageBody}</p>
            <div className="mt-4 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => {
                    setLocalLanguage(option.code)
                  }}
                  className={`rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                    option.code === language
                      ? 'border-glow bg-glow/10 text-paper-100'
                      : 'border-white/10 bg-ink-800/60 text-paper-300/70 hover:border-white/25'
                  }`}
                >
                  {stringsFor(option.code).nativeName}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'profile' && (
          <div>
            <Server size={20} className="text-glow" />
            <h2 className="mt-3 text-lg text-paper-100">Self-Hosted Local AI Engine</h2>
            <p className="mt-1 text-xs text-paper-300/50">All processing runs locally on your machine.</p>
            <div className="mt-4">
              <div className="rounded-xl border border-glow bg-glow/10 p-4 text-left">
                <div className="flex items-center gap-2">
                  <Server size={18} className="text-glow" />
                  <p className="text-sm font-semibold text-paper-100">Whisper + X-CLIP + CLAP + BGE-M3 + Qwen-VL</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-paper-300/70">
                  Multimodal indexing & vector search powered by local Hugging Face checkpoints and Qdrant vector database.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={skip}
            className="text-xs text-paper-300/45 underline-offset-4 transition-colors hover:text-paper-100 hover:underline"
          >
            {t.onboardSkip}
          </button>
          <button
            type="button"
            onClick={next}
            className="flex items-center gap-2 rounded-xl bg-glow px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            {position === ORDER.length - 1 ? t.onboardFinish : t.onboardNext}
            <ArrowRight size={15} className={rtl ? 'rotate-180' : undefined} />
          </button>
        </div>
      </div>
    </div>
  )
}
