import { Landing } from './pages/Landing'
import { Preprocess } from './pages/Preprocess'
import { HowItWorks } from './pages/HowItWorks'
import { Design } from './pages/Design'
import { Dashboard } from './pages/Dashboard'
import { Watch } from './pages/Watch'
import { AnalyticsConsent } from './components/AnalyticsConsent'
import { usePathname } from './lib/router'

function App() {
  const pathname = usePathname()
  const page = (() => {
    if (pathname === '/preprocess' || pathname === '/upload') return <Preprocess />
    if (pathname === '/how-it-works') return <HowItWorks />
    if (pathname === '/design') return <Design />
    if (pathname === '/dashboard' || pathname === '/library') return <Dashboard />
    const watch = pathname.match(/^\/videos\/([A-Za-z0-9_-]+)\/?$/)
    if (watch) return <Watch key={watch[1]} jobId={watch[1]} />
    return <Landing />
  })()

  return (
    <>
      {page}
      <AnalyticsConsent pathname={pathname} />
    </>
  )
}

export default App
