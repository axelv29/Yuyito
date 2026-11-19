import type { FocusRecord } from '@/state/types'
import { weekdayIndex } from './day'
import { dailyFocus, studyStreak } from './stats'

/** Un día de la tira de 7, con su letra (L M X J V S D) y si se plantó. */
export interface StreakDay {
  day: number
  label: string
  planted: boolean
  /** El día de hoy, que va al centro de la tira. */
  isToday: boolean
}

/** Racha diaria derivada de las sesiones completadas. */
export interface DailyStreak {
  current: number
  plantedToday: boolean
  recent: StreakDay[]
}

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
 * Racha diaria: días consecutivos con al menos un pomodoro completado.
 *
 * Reutiliza `dailyFocus` y `studyStreak`: solo los pomodoros completados
 * plantan un día y, si hoy todavía no hay, la racha sigue viva hasta que
 * termina el día. `today` es el ordinal local (`localDayNumber`) para que el
 * componente pueda memorizar con dependencias exactas.
 */
export function dailyStreak(
  sessions: readonly FocusRecord[],
  today: number,
  forestId?: string,
): DailyStreak {
  const days = dailyFocus(sessions, forestId)
  const planted = new Set(days.keys())

  return {
    current: studyStreak(days, today).current,
    plantedToday: planted.has(today),
    recent: recentDays(today, planted),
  }
}
