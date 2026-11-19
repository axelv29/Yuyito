import { useMemo, useState } from 'react'
import { FocusBars } from '@/components/FocusBars'
import { FocusHeatmap } from '@/components/FocusHeatmap'
import { StatsDonut } from '@/components/StatsDonut'
import type { DonutSegment } from '@/components/StatsDonut'
import { ViewSwitch } from '@/components/ViewSwitch'
import { GRID_COLS, GRID_ROWS } from '@/config/grid'
import type { View } from '@/config/views'
import { localDayNumber, startOfWeek } from '@/logic/day'
import {
  dailyFocus,
  forestFocus,
  formatFocusHours,
  formatFocusMinutes,
  heatmapWeeks,
  monthDays,
  statusCounts,
  studyAverage,
  studyStreak,
  summarizeStats,
  weekDays,
} from '@/logic/stats'
import { selectActiveForest } from '@/state/selectors'
import { useStore } from '@/state/store'

interface StatsPanelProps {
  now: number
  view: View
  onChangeView: (view: View) => void
}

type StatsScope = 'forest' | 'all'
type ChartMode = 'day' | 'week' | 'month'

const DAY_MS = 86_400_000
const MONTH_SHORT = new Intl.DateTimeFormat('es', { month: 'short', timeZone: 'UTC' })
const MONTH_LONG = new Intl.DateTimeFormat('es', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const DAY_MONTH = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const SCOPE_OPTIONS: ReadonlyArray<{ value: StatsScope; label: string }> = [
  { value: 'forest', label: 'Este bosque' },
  { value: 'all', label: 'Todos' },
]

const MODE_OPTIONS: ReadonlyArray<{ value: ChartMode; label: string }> = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
]

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function monthKey(year: number, monthIndex: number): number {
  return year * 12 + monthIndex
}

function formatWeekRange(startDay: number): string {
  const start = new Date(startDay * DAY_MS)
  const end = new Date((startDay + 6) * DAY_MS)
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()

  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${MONTH_SHORT.format(end).replace('.', '')}`
  }

  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${DAY_MONTH.format(start)} ${start.getUTCFullYear()} – ${DAY_MONTH.format(end)} ${end.getUTCFullYear()}`
  }

  return `${DAY_MONTH.format(start)} – ${DAY_MONTH.format(end)}`
}

function formatMonthLabel(year: number, monthIndex: number): string {
  const label = MONTH_LONG.format(new Date(Date.UTC(year, monthIndex, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function StatsPanel({ now, view, onChangeView }: StatsPanelProps) {
  const sessions = useStore((state) => state.sessions)
  const trees = useStore((state) => state.trees)
  const forests = useStore((state) => state.forests)
  const activeForestId = useStore((state) => state.activeForestId)
  const activeForest = selectActiveForest(forests, activeForestId)

  const today = localDayNumber(now)
  const currentDate = new Date(now)
  const [scope, setScope] = useState<StatsScope>('forest')
  const [mode, setMode] = useState<ChartMode>('day')
  const [weekAnchor, setWeekAnchor] = useState(today)
  const [monthAnchor, setMonthAnchor] = useState(() => ({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
  }))

  const effectiveScope: StatsScope = activeForest && scope === 'forest' ? 'forest' : 'all'
  const forestId = effectiveScope === 'forest' ? activeForest?.id : undefined
  const totalCells = activeForest ? activeForest.size * activeForest.size : GRID_COLS * GRID_ROWS

  const days = useMemo(() => dailyFocus(sessions, forestId), [sessions, forestId])
  const summary = useMemo(
    () => summarizeStats(sessions, trees, now, forestId),
    [sessions, trees, now, forestId],
  )
  const streak = useMemo(() => studyStreak(days, today), [days, today])
  const average = useMemo(() => studyAverage(days, today), [days, today])
  const status = useMemo(() => statusCounts(sessions, forestId), [sessions, forestId])
  const ranking = useMemo(
    () => forestFocus(sessions, trees, forests),
    [sessions, trees, forests],
  )
  const heatmap = useMemo(() => heatmapWeeks(days, today), [days, today])
  const week = useMemo(() => weekDays(weekAnchor, days, today), [weekAnchor, days, today])
  const month = useMemo(
    () => monthDays(monthAnchor.year, monthAnchor.month, days, today),
    [monthAnchor, days, today],
  )

  const earliestDay = days.size > 0 ? Math.min(...days.keys()) : today
  const earliestDate = new Date(earliestDay * DAY_MS)
  const earliestMonth = monthKey(earliestDate.getUTCFullYear(), earliestDate.getUTCMonth())
  const currentMonth = monthKey(currentDate.getFullYear(), currentDate.getMonth())
  const selectedMonth = monthKey(monthAnchor.year, monthAnchor.month)
  const selectedWeek = startOfWeek(weekAnchor)

  const canPrevWeek = startOfWeek(earliestDay) < selectedWeek
  const canNextWeek = selectedWeek < startOfWeek(today)
  const canPrevMonth = earliestMonth < selectedMonth
  const canNextMonth = selectedMonth < currentMonth

  const shiftMonth = (delta: number) => {
    setMonthAnchor(({ year, month: monthIndex }) => {
      const date = new Date(Date.UTC(year, monthIndex + delta, 1))
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
    })
  }

  const forestsWithMinutes = ranking.filter((forest) => forest.minutes > 0)
  const favorite = forestsWithMinutes[0] ?? null
  const showForests = forests.length > 1
  const showForestDonut = effectiveScope === 'all' && showForests && forestsWithMinutes.length > 1

  const topForests = forestsWithMinutes.slice(0, 5)
  const otherForests = forestsWithMinutes.slice(5)
  const forestSegments: DonutSegment[] = topForests.map((forest, index) => ({
    key: forest.forestId,
    label: forest.name,
    value: forest.minutes,
    display: formatFocusMinutes(forest.minutes),
    series: index + 1,
  }))

  if (otherForests.length > 0) {
    const minutes = otherForests.reduce((sum, forest) => sum + forest.minutes, 0)
    forestSegments.push({
      key: 'otros',
      label: 'Otros bosques',
      value: minutes,
      display: formatFocusMinutes(minutes),
      series: 6,
    })
  }

  const statusSegments: DonutSegment[] = [
    {
      key: 'completed',
      label: 'Completados',
      value: status.completed,
      display: `${status.completed}`,
      series: 1,
    },
    {
      key: 'abandoned',
      label: 'Abandonados',
      value: status.abandoned,
      display: `${status.abandoned}`,
      series: 5,
    },
  ]

  const scopeLabel =
    effectiveScope === 'forest'
      ? (activeForest?.name ?? 'Este bosque')
      : showForests
        ? 'Todos los bosques'
        : (activeForest?.name ?? 'Todos los bosques')

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-16" aria-label="Estadísticas">
      <div className="mx-auto mb-7 w-full max-w-xs">
        <ViewSwitch view={view} onChange={onChangeView} />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="eyebrow">Estadísticas</p>
          <h2 className="type-title-lg mt-2">Tu bosque en números</h2>
          <p className="type-caption type-muted mt-1">{scopeLabel}</p>
        </div>

        {showForests && (
          <div className="stats-pills" role="group" aria-label="Alcance de las estadísticas">
            {SCOPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="stats-pill"
                aria-pressed={effectiveScope === option.value}
                onClick={() => setScope(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="stat-grid mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Hoy"
          value={`${summary.todayPomodoros}`}
          unit="pomodoros"
          detail={`${formatFocusMinutes(summary.todayMinutes)} de enfoque`}
        />
        <StatCard
          label="Total"
          value={`${summary.totalPomodoros}`}
          unit="pomodoros"
          detail={`${formatFocusMinutes(summary.totalMinutes)} de enfoque`}
        />
        <StatCard
          label="Racha"
          value={`${streak.current}`}
          unit={streak.current === 1 ? 'día seguido' : 'días seguidos'}
          detail={
            streak.studiedDays > 0
              ? `Mejor racha: ${plural(streak.best, 'día', 'días')}`
              : 'Todavía no hay días con enfoque'
          }
        />
        <StatCard
          label="Promedio"
          value={formatFocusMinutes(average.averageMin)}
          unit="por día estudiado"
          detail={
            average.activeDays > 0
              ? `${average.activeDays} de ${average.windowDays} días con enfoque`
              : `Sin enfoques en los últimos ${average.windowDays} días`
          }
        />
      </div>

      <article className="card mt-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <p className="eyebrow">Enfoque</p>
            <h3 className="type-title mt-1">Tiempo estudiado</h3>
          </div>
          <div className="stats-pills" role="group" aria-label="Período del gráfico">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="stats-pill"
                aria-pressed={mode === option.value}
                onClick={() => setMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {mode === 'day' ? (
            <FocusHeatmap columns={heatmap} today={today} />
          ) : (
            <FocusBars
              mode={mode}
              days={mode === 'week' ? week : month}
              label={
                mode === 'week'
                  ? formatWeekRange(selectedWeek)
                  : formatMonthLabel(monthAnchor.year, monthAnchor.month)
              }
              today={today}
              canPrev={mode === 'week' ? canPrevWeek : canPrevMonth}
              canNext={mode === 'week' ? canNextWeek : canNextMonth}
              onPrev={() =>
                mode === 'week' ? setWeekAnchor(selectedWeek - 7) : shiftMonth(-1)
              }
              onNext={() =>
                mode === 'week' ? setWeekAnchor(selectedWeek + 7) : shiftMonth(1)
              }
            />
          )}
        </div>
      </article>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className={`card${showForestDonut ? '' : ' sm:col-span-2'}`}>
          <p className="eyebrow">Pomodoros</p>
          <h3 className="type-title mt-1">Completados y abandonados</h3>
          <StatsDonut
            segments={statusSegments}
            centerValue={`${status.completed + status.abandoned}`}
            centerUnit="pomodoros"
            ariaLabel={`${status.completed} pomodoros completados y ${status.abandoned} abandonados.`}
            emptyText="Todavía no hay pomodoros en este alcance."
          />
          <p className="type-caption type-muted mt-3">
            Los abandonos registran minutos reales, pero no suman a las estadísticas.
          </p>
        </article>

        {showForestDonut && (
          <article className="card">
            <p className="eyebrow">Bosques</p>
            <h3 className="type-title mt-1">Reparto del enfoque</h3>
            <StatsDonut
              segments={forestSegments}
              centerValue={formatFocusHours(
                forestsWithMinutes.reduce((sum, forest) => sum + forest.minutes, 0),
              )}
              centerUnit="de enfoque"
              ariaLabel={`Reparto de minutos completados entre ${forestsWithMinutes.length} bosques.`}
              emptyText="Todavía no hay minutos completados por bosque."
            />
            <p className="type-caption type-muted mt-3">
              Minutos de pomodoros completados en cada bosque.
            </p>
          </article>
        )}
      </div>

      {effectiveScope === 'all' && showForests && favorite && (
        <article className="card mt-4">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <p className="eyebrow">Bosque favorito</p>
              <h3 className="type-title mt-1">{favorite.name}</h3>
            </div>
            <p className="type-caption type-muted">
              {formatFocusMinutes(favorite.minutes)} · {plural(favorite.trees, 'árbol', 'árboles')}
            </p>
          </div>

          <ul className="stats-ranking">
            {topForests.map((forest) => (
              <li className="stats-ranking__row" key={forest.forestId}>
                <span className="stats-ranking__name">{forest.name}</span>
                <span className="stats-ranking__track">
                  <span
                    className="stats-ranking__bar"
                    style={{
                      width: `${favorite.minutes > 0 ? (forest.minutes / favorite.minutes) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="stats-ranking__value">
                  {formatFocusMinutes(forest.minutes)}
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}

      <div className="stat-grid mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Árboles"
          value={`${summary.matureTrees}`}
          unit="adultos"
          detail={`${summary.growingTrees} en crecimiento · ${summary.witheredTrees} marchitos`}
        />
        {effectiveScope === 'forest' && activeForest ? (
          <StatCard
            label="Pradera"
            value={`${totalCells}`}
            unit="celdas"
            detail={`Grilla ${activeForest.size} × ${activeForest.size} del bosque`}
          />
        ) : (
          <StatCard
            label="Bosques"
            value={`${forests.length}`}
            unit={forests.length === 1 ? 'bosque' : 'bosques'}
            detail={`${ranking.filter((forest) => forest.trees > 0).length} con árboles plantados`}
          />
        )}
      </div>

      <p className="type-body type-muted mt-6">
        Solo los pomodoros completados suman minutos. Los descansos no plantan árboles.
      </p>
    </section>
  )
}

interface StatCardProps {
  label: string
  value: string
  unit: string
  detail: string
}

function StatCard({ label, value, unit, detail }: StatCardProps) {
  return (
    <article className="card">
      <p className="eyebrow">{label}</p>
      <p className="type-stat mt-3">{value}</p>
      <p className="type-body type-muted">{unit}</p>
      <p className="type-caption type-muted mt-2">{detail}</p>
    </article>
  )
}
