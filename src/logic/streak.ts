import { TREE_SPECIES } from '@/config/species'
import type { FocusRecord } from '@/state/types'
import { localDayNumber, weekdayIndex } from './day'
import { studyStreak } from './stats'

/** Un día de la tira de 7, con su letra (L M X J V S D) y si contó. */
export interface StreakDay {
  day: number
  label: string
  planted: boolean
  /** El día de hoy, que va al centro de la tira. */
  isToday: boolean
}

/** Racha diaria derivada del enfoque real de cada día. */
export interface DailyStreak {
  current: number
  plantedToday: boolean
  recent: StreakDay[]
}

/**
 * Enfoque mínimo para que un día cuente: el árbol más chico (25 min).
 *
 * No hace falta completar un árbol: dejar un ceibo casi terminado también
 * suma, porque lo que importa es el tiempo estudiado.
 */
export const STREAK_MIN_FOCUS_MIN = TREE_SPECIES.pino.minutes

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

/** Tira de 7 días locales con hoy al centro: 3 atrás y 3 adelante. */
function recentDays(today: number, planted: ReadonlySet<number>): StreakDay[] {
  const recent: StreakDay[] = []
  for (let day = today - 3; day <= today + 3; day += 1) {
    recent.push({
      day,
      label: WEEKDAY_LABELS[weekdayIndex(day)],
      planted: planted.has(day),
      isToday: day === today,
    })
  }
  return recent
}

/**
 * Días que cuentan para la racha: al menos `STREAK_MIN_FOCUS_MIN` minutos de
 * enfoque real, sean de un árbol completado o de uno marchito.
 *
 * Los minutos de un árbol abandonado son tiempo estudiado, así que suman. Los
 * descansos no dejan registros y no entran. `durationMin` ya guarda los minutos
 * reales de los abandonos.
 */
export function streakDays(sessions: readonly FocusRecord[], forestId?: string): Set<number> {
  const minutes = new Map<number, number>()

  for (const session of sessions) {
    if (session.status === 'running' || (forestId && session.forestId !== forestId)) {
      continue
    }

    if (session.durationMin <= 0) {
      continue
    }

    const day = localDayNumber(session.endedAt)
    minutes.set(day, (minutes.get(day) ?? 0) + session.durationMin)
  }

  const days = new Set<number>()
  for (const [day, total] of minutes) {
    if (total >= STREAK_MIN_FOCUS_MIN) {
      days.add(day)
    }
  }

  return days
}

/**
 * Racha diaria: días consecutivos con al menos 25 minutos de enfoque real.
 *
 * Reutiliza `streakDays` y `studyStreak`: si hoy todavía no llega al mínimo, la
 * racha sigue viva hasta que termina el día. `today` es el ordinal local
 * (`localDayNumber`) para que el componente pueda memorizar con dependencias
 * exactas.
 */
export function dailyStreak(
  sessions: readonly FocusRecord[],
  today: number,
  forestId?: string,
): DailyStreak {
  const planted = streakDays(sessions, forestId)

  return {
    current: studyStreak(planted, today).current,
    plantedToday: planted.has(today),
    recent: recentDays(today, planted),
  }
}
