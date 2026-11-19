import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, localDayKey, localDayNumber } from '@/logic/day'
import { dailyStreak } from '@/logic/streak'
import { useStore } from '@/state/store'
import { LeafIcon } from './icons'
import { StreakIntroCard } from './StreakIntroCard'

/**
 * Racha diaria: chip discreto con hoja en la esquina inferior izquierda y
 * card del nuevo día. La card se deriva en render —una sola vez por día
 * local— y se posterga mientras hay sesión en curso, descanso pendiente o
 * aviso visible; se marca recién al cerrarse.
 *
 * La hoja alterna abrir y cerrar la card. Cuando se abre desde la hoja, la
 * card queda fija hasta que la cierre el usuario; solo el aviso del nuevo día
 * se cierra solo.
 *
 * El panel dev puede correr el día (`devDayOffset`) para probar el cambio de
 * día sin tocar el reloj del sistema.
 */
interface StreakOverlayProps {
  now: number
  /** Notifica al App cuando la card de racha se abre o se cierra (para auto-ocultar el temporizador en móvil). */
  onOpenChange?: (open: boolean) => void
}

export function StreakOverlay({ now, onOpenChange }: StreakOverlayProps) {
  const sessions = useStore((state) => state.sessions)
  const active = useStore((state) => state.active)
  const pendingBreak = useStore((state) => state.pendingBreak)
  const notice = useStore((state) => state.notice)
  const streakIntroShownOn = useStore((state) => state.streakIntroShownOn)
  const devDayOffset = useStore((state) => state.devDayOffset)
  const markStreakIntroShown = useStore((state) => state.markStreakIntroShown)

  const streakNow = addDays(now, devDayOffset)
  const dayKey = localDayKey(streakNow)
  const today = localDayNumber(streakNow)
  const streak = useMemo(() => dailyStreak(sessions, today), [sessions, today])

  const [manualOpen, setManualOpen] = useState(false)
  // Día en el que la card ya se cerró: el aviso no vuelve a abrirse solo.
  const [dismissedDay, setDismissedDay] = useState<string | null>(null)

  const autoOpen =
    dayKey !== streakIntroShownOn &&
    dayKey !== dismissedDay &&
    sessions.length > 0 &&
    active === null &&
    !pendingBreak &&
    notice === null

  const close = useCallback(() => {
    setManualOpen(false)
    setDismissedDay(dayKey)
    markStreakIntroShown(dayKey)
  }, [dayKey, markStreakIntroShown])

  const open = autoOpen || manualOpen

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  const toggle = () => {
    if (open) {
      close()
    } else {
      setManualOpen(true)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`streak-chip${streak.current === 0 ? ' streak-chip--empty' : ''}`}
        aria-label={`Racha de ${streak.current} días`}
        aria-expanded={open}
        title={`Racha de ${streak.current} días`}
        onClick={toggle}
      >
        <LeafIcon />
        <span>{streak.current}</span>
      </button>
      {open && <StreakIntroCard streak={streak} autoClose={!manualOpen} onClose={close} />}
    </>
  )
}
