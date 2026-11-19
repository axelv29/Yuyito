import { useEffect, useState } from 'react'

/**
 * Suscribe a una media query y devuelve si coincide ahora mismo. Se usa para
 * los ajustes exclusivos de móvil (auto-ocultar el temporizador, mover el
 * chip de racha) sin duplicar lógica fuera del componente.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const handleChange = () => setMatches(media.matches)
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [query])

  return matches
}
