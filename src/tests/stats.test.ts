import { describe, expect, it } from 'vitest'
import {
  dayNumberOf,
  localDayNumber,
  startOfWeek,
  weekdayIndex,
} from '@/logic/day'
import {
  dailyFocus,
  formatFocusHours,
  formatFocusMinutes,
  forestFocus,
  heatmapWeeks,
  monthDays,
  statusCounts,
  studyAverage,
  studyStreak,
  summarizeStats,
  weekDays,
} from '@/logic/stats'
import type { DayFocus } from '@/logic/stats'
import type { FocusRecord, Forest, Tree } from '@/state/types'

const MINUTE = 60_000
const TODAY = new Date(2026, 10, 3, 23, 0, 0).getTime()
const YESTERDAY = new Date(2026, 10, 2, 23, 0, 0).getTime()
const TOMORROW = new Date(2026, 10, 4, 0, 30, 0).getTime()
const TODAY_DAY = localDayNumber(TODAY)

function record(
  id: string,
  endedAt: number,
  status: FocusRecord['status'] = 'completed',
): FocusRecord {
  return {
    id,
    forestId: 'forest-test',
    startedAt: endedAt - 25 * MINUTE,
    endedAt,
    durationMin: 25,
    status,
    treeId: `tree-${id}`,
  }
}

function tree(id: string, state: Tree['state']): Tree {
  return {
    id,
    sessionId: `session-${id}`,
    forestId: 'forest-test',
    cell: { col: 0, row: 0 },
    stage: 4,
    state,
    requiredFocusMin: 25,
    accumulatedFocusMin: 25,
    createdAt: TODAY,
  }
}

const SESSIONS = [
  record('hoy', TODAY),
  record('ayer', YESTERDAY),
  record('manana', TOMORROW),
  record('abandonada', TODAY, 'abandoned'),
]

const TREES = [tree('t1', 'mature'), tree('t2', 'withered'), tree('t3', 'growing')]

function forest(id: string, name: string): Forest {
  return {
    id,
    name,
    description: '',
    size: 4,
    createdAt: TODAY,
    endsOn: null,
    goalHours: null,
    archivedAt: null,
  }
}

function focusDays(entries: ReadonlyArray<[number, number]>): Map<number, DayFocus> {
  return new Map(
    entries.map(([day, minutes]) => [day, { minutes, pomodoros: Math.ceil(minutes / 25) }]),
  )
}

describe('summarizeStats', () => {
  it('cuenta solo los enfoques completados de hoy y los totales', () => {
    const stats = summarizeStats(SESSIONS, TREES, TODAY)

    expect(stats.todayPomodoros).toBe(1)
    expect(stats.todayMinutes).toBe(25)
    expect(stats.totalPomodoros).toBe(3)
    expect(stats.totalMinutes).toBe(75)
    expect(stats.matureTrees).toBe(1)
    expect(stats.growingTrees).toBe(1)
    expect(stats.witheredTrees).toBe(1)
  })

  it('cambia de día a la medianoche local', () => {
    const afterMidnight = new Date(2026, 10, 4, 1, 0, 0).getTime()
    const stats = summarizeStats(SESSIONS, TREES, afterMidnight)

    expect(stats.todayPomodoros).toBe(1)
    expect(stats.todayMinutes).toBe(25)
  })

  it('no cuenta los abandonos', () => {
    const stats = summarizeStats([record('abandonada', TODAY, 'abandoned')], [], TODAY)

    expect(stats.todayPomodoros).toBe(0)
    expect(stats.totalPomodoros).toBe(0)
    expect(stats.totalMinutes).toBe(0)
  })
})

describe('dailyFocus', () => {
  it('agrupa los completados por día local e ignora los abandonos', () => {
    const days = dailyFocus(SESSIONS)

    expect(days.size).toBe(3)
    expect(days.get(TODAY_DAY)).toEqual({ minutes: 25, pomodoros: 1 })
    expect(days.get(TODAY_DAY - 1)?.minutes).toBe(25)
    expect(days.get(TODAY_DAY + 1)?.minutes).toBe(25)
  })

  it('filtra por bosque', () => {
    expect(dailyFocus(SESSIONS, 'forest-test').size).toBe(3)
    expect(dailyFocus(SESSIONS, 'otro-bosque').size).toBe(0)
  })
})

describe('studyStreak', () => {
  it('cuenta los días seguidos que terminan hoy', () => {
    const streak = studyStreak(focusDays([[TODAY_DAY, 25], [TODAY_DAY - 1, 50], [TODAY_DAY - 2, 25]]), TODAY_DAY)

    expect(streak.current).toBe(3)
    expect(streak.best).toBe(3)
    expect(streak.studiedDays).toBe(3)
  })

  it('mantiene la racha viva si hoy todavía no hay enfoques', () => {
    const streak = studyStreak(focusDays([[TODAY_DAY - 1, 25], [TODAY_DAY - 2, 25]]), TODAY_DAY)

    expect(streak.current).toBe(2)
  })

  it('no cuenta como racha un hueco de un día', () => {
    const streak = studyStreak(focusDays([[TODAY_DAY, 25], [TODAY_DAY - 2, 25]]), TODAY_DAY)

    expect(streak.current).toBe(1)
    expect(streak.best).toBe(1)
  })

  it('guarda la mejor racha del historial', () => {
    const streak = studyStreak(
      focusDays([
        [TODAY_DAY - 10, 25],
        [TODAY_DAY - 9, 25],
        [TODAY_DAY - 8, 25],
        [TODAY_DAY - 7, 25],
        [TODAY_DAY - 1, 25],
      ]),
      TODAY_DAY,
    )

    expect(streak.current).toBe(1)
    expect(streak.best).toBe(4)
  })
})

describe('studyAverage', () => {
  it('promedia solo los días estudiados de la ventana', () => {
    const average = studyAverage(
      focusDays([
        [TODAY_DAY - 1, 60],
        [TODAY_DAY - 2, 30],
        [TODAY_DAY - 40, 999],
      ]),
      TODAY_DAY,
    )

    expect(average.averageMin).toBe(45)
    expect(average.activeDays).toBe(2)
    expect(average.windowDays).toBe(30)
  })

  it('devuelve cero cuando no hay datos', () => {
    expect(studyAverage(focusDays([]), TODAY_DAY).averageMin).toBe(0)
  })
})

describe('weekDays', () => {
  it('arranca el lunes y devuelve siete días', () => {
    const week = weekDays(TODAY_DAY, focusDays([]), TODAY_DAY)

    expect(week).toHaveLength(7)
    expect(weekdayIndex(week[0].day)).toBe(0)
    expect(week[0].day).toBe(startOfWeek(TODAY_DAY))
  })

  it('marca los días que todavía no llegaron', () => {
    const week = weekDays(TODAY_DAY, focusDays([[TODAY_DAY, 25]]), TODAY_DAY)
    const today = week.find((day) => day.day === TODAY_DAY)

    expect(today?.minutes).toBe(25)
    expect(week.filter((day) => day.future).every((day) => day.day > TODAY_DAY)).toBe(true)
  })
})

describe('monthDays', () => {
  it('devuelve todos los días del mes', () => {
    const november = monthDays(2026, 10, focusDays([]), TODAY_DAY)

    expect(november).toHaveLength(30)
    expect(november[0].day).toBe(dayNumberOf(2026, 10, 1))
    expect(november.at(-1)?.day).toBe(dayNumberOf(2026, 10, 30))
    expect(monthDays(2026, 9, focusDays([]), TODAY_DAY)).toHaveLength(31)
    expect(monthDays(2024, 1, focusDays([]), TODAY_DAY)).toHaveLength(29)
  })
})

describe('heatmapWeeks', () => {
  it('arma 53 columnas de lunes a domingo que terminan en la semana de hoy', () => {
    const weeks = heatmapWeeks(focusDays([]), TODAY_DAY)

    expect(weeks).toHaveLength(53)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weekdayIndex(weeks[0][0].day)).toBe(0)
    expect(weeks[0][0].day).toBe(startOfWeek(TODAY_DAY) - 52 * 7)
    expect(weeks.at(-1)?.some((day) => day.day === TODAY_DAY)).toBe(true)
  })

  it('atenúa solo los días futuros de la última semana', () => {
    const weeks = heatmapWeeks(focusDays([]), TODAY_DAY)
    const future = weeks.flat().filter((day) => day.future)

    expect(future.every((day) => day.day > TODAY_DAY)).toBe(true)
    expect(future).toHaveLength(weekdayIndex(TODAY_DAY) === 6 ? 0 : 6 - weekdayIndex(TODAY_DAY))
  })
})

describe('statusCounts', () => {
  it('cuenta completados y abandonados del alcance', () => {
    expect(statusCounts(SESSIONS)).toEqual({ completed: 3, abandoned: 1 })
    expect(statusCounts(SESSIONS, 'forest-test')).toEqual({ completed: 3, abandoned: 1 })
    expect(statusCounts(SESSIONS, 'otro-bosque')).toEqual({ completed: 0, abandoned: 0 })
  })
})

describe('forestFocus', () => {
  it('ordena los bosques por minutos y suma sus árboles', () => {
    const ranking = forestFocus(SESSIONS, TREES, [
      forest('forest-test', 'Bosque Norte'),
      forest('otro', 'Bosque Sur'),
    ])

    expect(ranking[0]).toMatchObject({
      forestId: 'forest-test',
      name: 'Bosque Norte',
      minutes: 75,
      pomodoros: 3,
      trees: 3,
    })
    expect(ranking[1]).toMatchObject({ forestId: 'otro', minutes: 0, trees: 0 })
  })
})

describe('formatFocusMinutes', () => {
  it('muestra minutos u horas sin ceros de más', () => {
    expect(formatFocusMinutes(0)).toBe('0 min')
    expect(formatFocusMinutes(45)).toBe('45 min')
    expect(formatFocusMinutes(60)).toBe('1 h')
    expect(formatFocusMinutes(80)).toBe('1 h 20 min')
    expect(formatFocusMinutes(120)).toBe('2 h')
  })
})

describe('formatFocusHours', () => {
  it('redondea a horas enteras para el centro de un anillo', () => {
    expect(formatFocusHours(0)).toBe('0 min')
    expect(formatFocusHours(45)).toBe('45 min')
    expect(formatFocusHours(60)).toBe('1 h')
    expect(formatFocusHours(11650)).toBe('194 h')
    expect(formatFocusHours(90)).toBe('2 h')
  })
})
