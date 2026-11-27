import { useEffect } from 'react'
import type { ThemeMode } from '@/state/types'

export type ResolvedTheme = 'day' | 'night'

export function resolveThemeMode(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'night') return 'night'
  if (mode === 'day') return 'day'
  return systemDark ? 'night' : 'day'
}

function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'night' ? '#141c24' : '#edede9')
  }
}

/** Sincroniza el tema visual con la preferencia guardada y el sistema. */
export function useThemeMode(mode: ThemeMode): ResolvedTheme {
  const systemDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = resolveThemeMode(mode, systemDark)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      applyTheme(resolveThemeMode(mode, media.matches))
    }

    sync()
    if (mode !== 'system') {
      return
    }

    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [mode])

  return resolved
}
