import { useCallback, useMemo, useState } from 'react'
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
 * El panel dev puede correr el día (`devDayOffset`) para probar el cambio de
 * día sin tocar el reloj del sistema.
 */
export function StreakOverlay({ now }: { now: number }) {
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

  const autoOpen =
    dayKey !== streakIntroShownOn &&
    sessions.length > 0 &&
    active === null &&
    !pendingBreak &&
    notice === null

  const close = useCallback(() => {
    setManualOpen(false)
    markStreakIntroShown(dayKey)
  }, [dayKey, markStreakIntroShown])

  return (
    <>
      <button
        type="button"
        className={`streak-chip${streak.current === 0 ? ' streak-chip--empty' : ''}`}
        aria-label={`Racha de ${streak.current} días`}
        title={`Racha de ${streak.current} días`}
        onClick={() => setManualOpen(true)}
      >
        <LeafIcon />
        <span>{streak.current}</span>
      </button>
      {(autoOpen || manualOpen) && <StreakIntroCard streak={streak} onClose={close} />}
    </>
  )
}
