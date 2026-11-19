import type { FocusRecord, Forest, Tree } from '@/state/types'
import {
  dayNumberOf,
  daysInMonth,
  localDayKey,
  localDayNumber,
  startOfWeek,
} from './day'

const DAY_MS = 86_400_000

export interface StatsSummary {
  todayPomodoros: number
  todayMinutes: number
  totalPomodoros: number
  totalMinutes: number
  matureTrees: number
  growingTrees: number
  witheredTrees: number
}

/** Enfoque completado de un día: minutos y pomodoros. */
export interface DayFocus {
  minutes: number
  pomodoros: number
}

/** Día de un período, con el ordinal local y si todavía no llegó. */
export interface PeriodDay extends DayFocus {
  day: number
  future: boolean
}

export interface StudyStreak {
  current: number
  best: number
  studiedDays: number
}

export interface StudyAverage {
  averageMin: number
  activeDays: number
  windowDays: number
}

export interface StatusCounts {
  completed: number
  abandoned: number
}

export interface ForestFocus {
  forestId: string
  name: string
  minutes: number
  pomodoros: number
  trees: number
}

export function summarizeStats(
  sessions: readonly FocusRecord[],
  trees: readonly Tree[],
  now = Date.now(),
  forestId?: string,
): StatsSummary {
  const todayKey = localDayKey(now)
  const summary: StatsSummary = {
    todayPomodoros: 0,
    todayMinutes: 0,
    totalPomodoros: 0,
    totalMinutes: 0,
    matureTrees: 0,
    growingTrees: 0,
    witheredTrees: 0,
  }

  for (const session of sessions) {
    if (session.status !== 'completed' || (forestId && session.forestId !== forestId)) {
      continue
    }

    summary.totalPomodoros += 1
    summary.totalMinutes += session.durationMin

    if (localDayKey(session.endedAt) === todayKey) {
      summary.todayPomodoros += 1
      summary.todayMinutes += session.durationMin
    }
  }

  for (const tree of trees) {
    if (forestId && tree.forestId !== forestId) {
      continue
    }

    if (tree.state === 'mature') {
      summary.matureTrees += 1
    } else if (tree.state === 'growing') {
      summary.growingTrees += 1
    } else {
      summary.witheredTrees += 1
    }
  }

  return summary
}

/** Minutos de enfoque por día local. Solo cuenta los pomodoros completados. */
export function dailyFocus(
  sessions: readonly FocusRecord[],
  forestId?: string,
): Map<number, DayFocus> {
  const days = new Map<number, DayFocus>()

  for (const session of sessions) {
    if (session.status !== 'completed' || (forestId && session.forestId !== forestId)) {
      continue
    }

    const day = localDayNumber(session.endedAt)
    const entry = days.get(day) ?? { minutes: 0, pomodoros: 0 }
    entry.minutes += session.durationMin
    entry.pomodoros += 1
    days.set(day, entry)
  }

  return days
}

/**
 * Racha de días estudiando.
 *
 * Si hoy todavía no hay enfoques, la racha sigue viva hasta que termina el
 * día: se cuenta desde ayer.
 */
export function studyStreak(
  days: ReadonlyMap<number, DayFocus>,
  today: number,
): StudyStreak {
  let current = 0
  let cursor = days.has(today) ? today : today - 1

  while (days.has(cursor)) {
    current += 1
    cursor -= 1
  }

  const sorted = [...days.keys()].sort((a, b) => a - b)
  let best = 0
  let run = 0
  let previous: number | null = null

  for (const day of sorted) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }

  return { current, best, studiedDays: sorted.length }
}

/** Promedio de minutos por día estudiado en la ventana que termina hoy. */
export function studyAverage(
  days: ReadonlyMap<number, DayFocus>,
  today: number,
  windowDays = 30,
): StudyAverage {
  const start = today - windowDays + 1
  let minutes = 0
  let activeDays = 0

  for (const [day, entry] of days) {
    if (day >= start && day <= today && entry.minutes > 0) {
      minutes += entry.minutes
      activeDays += 1
    }
  }

  return {
    averageMin: activeDays > 0 ? Math.round(minutes / activeDays) : 0,
    activeDays,
    windowDays,
  }
}

function periodDay(
  day: number,
  days: ReadonlyMap<number, DayFocus>,
  today: number,
): PeriodDay {
  const entry = days.get(day)

  return {
    day,
    minutes: entry?.minutes ?? 0,
    pomodoros: entry?.pomodoros ?? 0,
    future: day > today,
  }
}

/** Los siete días (lunes a domingo) de la semana que contiene la ancla. */
export function weekDays(
  anchor: number,
  days: ReadonlyMap<number, DayFocus>,
  today: number,
): PeriodDay[] {
  const start = startOfWeek(anchor)

  return Array.from({ length: 7 }, (_, index) => periodDay(start + index, days, today))
}

/** Todos los días del mes, del 1 al último. */
export function monthDays(
  year: number,
  monthIndex: number,
  days: ReadonlyMap<number, DayFocus>,
  today: number,
): PeriodDay[] {
  const count = daysInMonth(year, monthIndex)

  return Array.from({ length: count }, (_, index) =>
    periodDay(dayNumberOf(year, monthIndex, index + 1), days, today),
  )
}

/**
 * Columnas semanales (lunes a domingo) del mapa de calor del año en curso.
 *
 * Cubre desde la semana que contiene el 1 de enero hasta la que contiene el
 * 31 de diciembre, así que los meses se ven en orden de enero a diciembre.
 */
export function heatmapWeeks(
  days: ReadonlyMap<number, DayFocus>,
  today: number,
): PeriodDay[][] {
  const year = new Date(today * DAY_MS).getUTCFullYear()
  const jan1 = dayNumberOf(year, 0, 1)
  const dec31 = dayNumberOf(year, 11, 31)
  const firstMonday = startOfWeek(jan1)
  const lastMonday = startOfWeek(dec31)
  const weekCount = (lastMonday - firstMonday) / 7 + 1

  return Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: 7 }, (_, index) =>
      periodDay(firstMonday + week * 7 + index, days, today),
    ),
  )
}

/** Pomodoros completados y abandonados del alcance. */
export function statusCounts(
  sessions: readonly FocusRecord[],
  forestId?: string,
): StatusCounts {
  const counts: StatusCounts = { completed: 0, abandoned: 0 }

  for (const session of sessions) {
    if (forestId && session.forestId !== forestId) {
      continue
    }

    if (session.status === 'completed') {
      counts.completed += 1
    } else if (session.status === 'abandoned') {
      counts.abandoned += 1
    }
  }

  return counts
}

/** Minutos, pomodoros y árboles de cada bosque, ordenados por enfoque. */
export function forestFocus(
  sessions: readonly FocusRecord[],
  trees: readonly Tree[],
  forests: readonly Forest[],
): ForestFocus[] {
  const byForest = new Map<string, ForestFocus>(
    forests.map((forest) => [
      forest.id,
      {
        forestId: forest.id,
        name: forest.name,
        minutes: 0,
        pomodoros: 0,
        trees: 0,
      },
    ]),
  )

  for (const session of sessions) {
    if (session.status !== 'completed') {
      continue
    }

    const entry = byForest.get(session.forestId)
    if (entry) {
      entry.minutes += session.durationMin
      entry.pomodoros += 1
    }
  }

  for (const tree of trees) {
    const entry = byForest.get(tree.forestId)
    if (entry) {
      entry.trees += 1
    }
  }

  return [...byForest.values()].sort(
    (a, b) =>
      b.minutes - a.minutes ||
      b.trees - a.trees ||
      a.name.localeCompare(b.name, 'es'),
  )
}

/** "45 min", "1 h 20 min" o "2 h". */
export function formatFocusMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))

  if (total < 60) {
    return `${total} min`
  }

  const hours = Math.floor(total / 60)
  const rest = total % 60

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** Versión corta para el centro de un anillo: "45 min" u "194 h". */
export function formatFocusHours(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))

  return total < 60 ? `${total} min` : `${Math.round(total / 60)} h`
}
