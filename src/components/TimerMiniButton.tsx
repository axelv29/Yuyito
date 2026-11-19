import { FOCUS_MINUTES } from '@/config/timer'
import { elapsedMs, formatClock, remainingMs } from '@/logic/timer'
import { useStore } from '@/state/store'
import { TimerIcon } from './icons'

const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface TimerMiniButtonProps {
  now: number
  onRestore: () => void
}

/**
 * Botón flotante para cuando la card del temporizador está oculta. Con una
 * sesión en curso muestra la rueda mínima (sin números ni letras, solo el
 * arco avanzando); en reposo muestra un reloj simple. El tooltip resume el
 * estado actual: en sesión el tiempo restante y los pomodoros (p. ej.
 * «18:42 · 2/3»); en reposo, la sesión pendiente o los minutos por defecto.
 * Tocarlo vuelve a mostrar la card entera.
 */
export function TimerMiniButton({ now, onRestore }: TimerMiniButtonProps) {
  const active = useStore((state) => state.active)
  const plans = useStore((state) => state.plans)
  const activePlanId = useStore((state) => state.activePlanId)
  const settings = useStore((state) => state.settings)

  const openPlan = plans.find((plan) => plan.id === activePlanId && plan.finishedAt === null)
  const isPaused = active?.pausedAt !== null && active?.pausedAt !== undefined
  const focusMin = openPlan?.focusMin ?? settings.focusMin ?? FOCUS_MINUTES
  const duration = active ? active.durationMin * 60_000 : focusMin * 60_000
  const progress = active ? Math.min(1, elapsedMs(active, now) / duration) : 0
  const remaining = active ? remainingMs(active, now) : 0
  const ringVariant =
    !active || active.kind === 'focus' ? 'focus' : active.longBreak ? 'longBreak' : 'shortBreak'
  const ringClass =
    ringVariant === 'longBreak' ? 'long-break' : ringVariant === 'shortBreak' ? 'short-break' : 'focus'
  const pomoProgress =
    active?.pomoIndex && active.pomoTotal ? { index: active.pomoIndex, total: active.pomoTotal } : null

  const tooltip = active
    ? pomoProgress && pomoProgress.total > 1
      ? `${formatClock(remaining)} · ${pomoProgress.index}/${pomoProgress.total}`
      : formatClock(remaining)
    : openPlan
      ? `Sesión pendiente · ${openPlan.completedPomodoros}/${openPlan.targetPomodoros}`
      : `Listo · ${focusMin} min de enfoque`

  return (
    <div
      className={`timer-mini${active ? ` timer-mini--live timer-mini--${ringClass}` : ''}${isPaused ? ' timer-mini--paused' : ''}`}
    >
      <button
        type="button"
        className="timer-mini__button"
        onClick={onRestore}
        aria-label="Mostrar temporizador"
      >
        {active ? (
          <svg className="timer-mini__svg" viewBox="0 0 64 64" aria-hidden="true">
            <circle className="timer-mini__track" cx="32" cy="32" r={RADIUS} />
            <circle
              className="timer-mini__fill"
              cx="32"
              cy="32"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          </svg>
        ) : (
          <TimerIcon className="timer-mini__icon" />
        )}
      </button>
      <span className="timer-mini__tip" role="tooltip">
        {tooltip}
      </span>
    </div>
  )
}
