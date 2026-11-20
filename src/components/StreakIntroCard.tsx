import { useEffect } from 'react'
import { STREAK_MIN_FOCUS_MIN } from '@/logic/streak'
import type { DailyStreak } from '@/logic/streak'
import { CloseIcon, LeafIcon } from './icons'

const AUTO_DISMISS_MS = 8000

/**
 * Card del nuevo día: número grande, tira de 7 días con hojas y un mensaje
 * para conservar la racha. Como aviso del día se cierra sola (`autoClose`);
 * abierta desde la hoja queda hasta que el usuario la cierre. Siempre se
 * cierra con la × o con Escape.
 */
export function StreakIntroCard({
  streak,
  onClose,
  autoClose = true,
}: {
  streak: DailyStreak
  onClose: () => void
  autoClose?: boolean
}) {
  useEffect(() => {
    let timeout: number | null = null

    const start = () => {
      if (timeout === null) {
        timeout = window.setTimeout(onClose, AUTO_DISMISS_MS)
      }
    }
    const stop = () => {
      if (timeout !== null) {
        window.clearTimeout(timeout)
        timeout = null
      }
    }
    // No quemar el aviso del día mientras la pestaña está en segundo plano:
    // el cierre automático corre solo con la card a la vista.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start()
      } else {
        stop()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (autoClose) {
      if (document.visibilityState === 'visible') {
        start()
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [autoClose, onClose])

  const message = streak.plantedToday
    ? `Volvé mañana y sumá ${STREAK_MIN_FOCUS_MIN} minutos para conservar la racha.`
    : streak.current >= 1
      ? `Sumá ${STREAK_MIN_FOCUS_MIN} minutos hoy y volvé mañana para conservarla.`
      : `Empezá una racha: sumá ${STREAK_MIN_FOCUS_MIN} minutos hoy.`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div
        className="card streak-card"
        role="dialog"
        aria-labelledby="streak-card-title"
        aria-modal="false"
      >
        <button
          type="button"
          className="icon-button streak-card__close"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <CloseIcon />
        </button>

        <LeafIcon className="streak-card__leaf" />
        <p className="eyebrow">Racha diaria</p>
        <p
          id="streak-card-title"
          className={`streak-card__count${streak.current === 0 ? ' streak-card__count--empty' : ''}`}
        >
          {streak.current}
          <span className="streak-card__unit">{streak.current === 1 ? ' día' : ' días'}</span>
        </p>

        <div className="streak-strip" aria-hidden="true">
          {streak.recent.map((entry) => (
            <div
              key={entry.day}
              className={[
                'streak-day',
                entry.planted ? 'streak-day--planted' : '',
                entry.isToday ? 'streak-day--today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <LeafIcon className="streak-day__leaf" />
              <span className="streak-day__label">{entry.label}</span>
            </div>
          ))}
        </div>

        <p className="type-body type-muted streak-card__message">{message}</p>
      </div>
    </div>
  )
}
