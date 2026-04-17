import { useEffect, useState } from 'react'

export type ViewportMode = 'mobile' | 'tablet' | 'desktop'

const MOBILE_QUERY = '(max-width: 767px)'
const TABLET_QUERY = '(max-width: 1199px)'

function getViewportMode(): ViewportMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop'
  if (window.matchMedia(MOBILE_QUERY).matches) return 'mobile'
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet'
  return 'desktop'
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() => getViewportMode())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mobile = window.matchMedia(MOBILE_QUERY)
    const tablet = window.matchMedia(TABLET_QUERY)
    const update = () => setMode(getViewportMode())

    update()
    mobile.addEventListener('change', update)
    tablet.addEventListener('change', update)

    return () => {
      mobile.removeEventListener('change', update)
      tablet.removeEventListener('change', update)
    }
  }, [])

  return mode
}
