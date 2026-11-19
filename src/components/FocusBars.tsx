import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatFocusMinutes } from '@/logic/stats'
import type { PeriodDay } from '@/logic/stats'

interface FocusBarsProps {
  mode: 'week' | 'month'
  days: readonly PeriodDay[]
  label: string
  today: number
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}

interface BarsTip {
  x: number
  y: number
  day: number
  minutes: number
  pomodoros: number
}

const DAY_MS = 86_400_000
const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const DAY_LABEL = new Intl.DateTimeFormat('es', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

function dayOfMonth(day: number): number {
  return new Date(day * DAY_MS).getUTCDate()
}

function dayName(day: number): string {
  return DAY_LABEL.format(new Date(day * DAY_MS)).replace(',', '')
}

/** Barras de los días de una semana o de un mes, navegables con flechas. */
export function FocusBars({
  mode,
  days,
  label,
  today,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: FocusBarsProps) {
  const [tip, setTip] = useState<BarsTip | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)

  const total = days.reduce((sum, day) => sum + day.minutes, 0)
  const max = Math.max(1, ...days.map((day) => day.minutes))

  const showTip = (event: MouseEvent<HTMLDivElement>, day: PeriodDay) => {
    const plot = plotRef.current
    if (!plot || day.future) {
      setTip(null)
      return
    }

    const plotRect = plot.getBoundingClientRect()
    const columnRect = event.currentTarget.getBoundingClientRect()
    const center = columnRect.left - plotRect.left + columnRect.width / 2

    setTip({
      x: Math.min(Math.max(center, 70), plotRect.width - 70),
      y: columnRect.top - plotRect.top,
      day: day.day,
      minutes: day.minutes,
      pomodoros: day.pomodoros,
    })
  }

  return (
    <div className="stats-bars">
      <div className="stats-bars__head">
        <p className="stats-bars__total">
          <span className="stats-bars__total-value">{formatFocusMinutes(total)}</span>
          <span className="stats-bars__total-label">
            {mode === 'week' ? 'en la semana' : 'en el mes'}
          </span>
        </p>

        <div className="stats-bars__nav">
          <button
            type="button"
            className="stats-nav__button"
            aria-label={mode === 'week' ? 'Semana anterior' : 'Mes anterior'}
            disabled={!canPrev}
            onClick={onPrev}
          >
            <ChevronLeft />
          </button>
          <span className="stats-bars__range">{label}</span>
          <button
            type="button"
            className="stats-nav__button"
            aria-label={mode === 'week' ? 'Semana siguiente' : 'Mes siguiente'}
            disabled={!canNext}
            onClick={onNext}
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      <div
        className="stats-bars__plot"
        ref={plotRef}
        role="img"
        aria-label={`${mode === 'week' ? 'Enfoque de la semana' : 'Enfoque del mes'} ${label}: ${formatFocusMinutes(total)} en total.`}
        onMouseLeave={() => setTip(null)}
      >
        {days.map((day, index) => {
          const date = dayOfMonth(day.day)
          const axis =
            mode === 'week'
              ? WEEKDAYS[index]
              : date === 1 || date === 10 || date === 20 || date === 30
                ? String(date)
                : ''

          return (
            <div
              className="stats-bars__col"
              key={day.day}
              onMouseEnter={(event) => showTip(event, day)}
            >
              <span className="stats-bars__track">
                <span
                  className={[
                    'stats-bars__bar',
                    day.day === today ? 'stats-bars__bar--today' : '',
                    day.future ? 'stats-bars__bar--future' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ height: `${day.minutes > 0 ? Math.max(3, (day.minutes / max) * 100) : 0}%` }}
                />
              </span>
              <span
                className={[
                  'stats-bars__label',
                  day.day === today ? 'stats-bars__label--today' : '',
                  day.future ? 'stats-bars__label--future' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              >
                {axis}
              </span>
            </div>
          )
        })}

        {total === 0 && <span className="stats-bars__empty">Sin enfoques en este período</span>}

        {tip && (
          <div
            className="stats-chart__tip"
            style={{ left: tip.x, top: tip.y }}
            aria-hidden="true"
          >
            <span className="stats-chart__tip-title">{dayName(tip.day)}</span>
            <span className="stats-chart__tip-value">
              {tip.minutes > 0
                ? `${formatFocusMinutes(tip.minutes)} · ${tip.pomodoros} ${
                    tip.pomodoros === 1 ? 'pomodoro' : 'pomodoros'
                  }`
                : 'Sin enfoque'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
