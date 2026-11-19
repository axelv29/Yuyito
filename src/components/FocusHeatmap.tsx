import { useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { dayNumberOf } from '@/logic/day'
import { formatFocusMinutes } from '@/logic/stats'
import type { PeriodDay } from '@/logic/stats'

interface FocusHeatmapProps {
  columns: readonly PeriodDay[][]
  today: number
}

interface HeatmapTip {
  x: number
  y: number
  day: number
  minutes: number
  pomodoros: number
}

const DAY_MS = 86_400_000
const LEVELS = 4
const MONTH_LABEL = new Intl.DateTimeFormat('es', { month: 'short', timeZone: 'UTC' })
const DAY_LABEL = new Intl.DateTimeFormat('es', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const WEEKDAY_LABELS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

function monthOf(day: number): number {
  return new Date(day * DAY_MS).getUTCMonth()
}

function monthName(day: number): string {
  const name = MONTH_LABEL.format(new Date(day * DAY_MS)).replace('.', '')
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function dayName(day: number): string {
  return DAY_LABEL.format(new Date(day * DAY_MS)).replace(',', '')
}

function levelOf(minutes: number, max: number): number {
  if (minutes <= 0) {
    return 0
  }

  return Math.min(LEVELS, Math.max(1, Math.ceil((minutes / max) * LEVELS)))
}

/** Mapa de calor del año, al estilo de un calendario de contribuciones. */
export function FocusHeatmap({ columns, today }: FocusHeatmapProps) {
  const [tip, setTip] = useState<HeatmapTip | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  const year = useMemo(() => new Date(today * DAY_MS).getUTCFullYear(), [today])
  const max = useMemo(
    () => Math.max(1, ...columns.flatMap((column) => column.map((day) => day.minutes))),
    [columns],
  )
  const summary = useMemo(() => {
    const studied = columns.flat().filter((day) => day.minutes > 0)
    const minutes = studied.reduce((sum, day) => sum + day.minutes, 0)

    return { studied: studied.length, minutes }
  }, [columns])
  const monthLabels = useMemo(() => {
    const labels = new Map<number, string>()
    let last = -Infinity
    let lastMonth = -1
    const jan1 = dayNumberOf(year, 0, 1)
    const dec31 = dayNumberOf(year, 11, 31)

    for (let index = 0; index < columns.length; index++) {
      const column = columns[index]
      if (!column) {
        continue
      }

      const inYear = column.find((day) => day.day >= jan1 && day.day <= dec31)
      if (!inYear) {
        continue
      }

      const month = monthOf(inYear.day)
      if (month === lastMonth) {
        continue
      }

      lastMonth = month
      if (index - last < 3) {
        continue
      }

      labels.set(index, monthName(inYear.day))
      last = index
    }

    return labels
  }, [columns, year])

  const showTip = (event: MouseEvent<HTMLSpanElement>, day: PeriodDay) => {
    const host = hostRef.current
    if (!host || day.future) {
      setTip(null)
      return
    }

    const hostRect = host.getBoundingClientRect()
    const cellRect = event.currentTarget.getBoundingClientRect()
    const center = cellRect.left - hostRect.left + cellRect.width / 2

    setTip({
      x: Math.min(Math.max(center, 70), hostRect.width - 70),
      y: cellRect.top - hostRect.top,
      day: day.day,
      minutes: day.minutes,
      pomodoros: day.pomodoros,
    })
  }

  return (
    <div
      ref={hostRef}
      className="stats-heatmap"
      role="img"
      aria-label={`Enfoque por día de ${year}: ${summary.studied} días estudiados, ${formatFocusMinutes(summary.minutes)} en total.`}
      onMouseLeave={() => setTip(null)}
    >
      <div className="stats-heatmap__scroll" onScroll={() => setTip(null)}>
        <div className="stats-heatmap__inner">
          <div className="stats-heatmap__months" aria-hidden="true">
            {columns.map((column, index) => (
              <span className="stats-heatmap__month" key={column[0]?.day ?? index}>
                {monthLabels.get(index) ?? ''}
              </span>
            ))}
          </div>

          <div className="stats-heatmap__body">
            <div className="stats-heatmap__weekdays" aria-hidden="true">
              {WEEKDAY_LABELS.map((label, index) => (
                <span className="stats-heatmap__weekday" key={label}>
                  {index % 2 === 0 ? label : ''}
                </span>
              ))}
            </div>

            <div className="stats-heatmap__grid" aria-hidden="true">
              {columns.flatMap((column) =>
                column.map((day) => {
                  const level = levelOf(day.minutes, max)
                  const classes = [
                    'stats-heatmap__cell',
                    `stats-heatmap__cell--l${level}`,
                    day.day === today ? 'stats-heatmap__cell--today' : '',
                    day.future ? 'stats-heatmap__cell--future' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <span
                      className={classes}
                      key={day.day}
                      onMouseEnter={(event) => showTip(event, day)}
                    />
                  )
                }),
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="stats-heatmap__legend" aria-hidden="true">
        <span>Menos</span>
        {Array.from({ length: LEVELS + 1 }, (_, level) => (
          <span
            className={`stats-heatmap__swatch stats-heatmap__cell--l${level}`}
            key={level}
          />
        ))}
        <span>Más</span>
      </div>

      {tip && (
        <div className="stats-chart__tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
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
  )
}
