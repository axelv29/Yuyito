import { describe, expect, it } from 'vitest'
import { localDayNumber } from '@/logic/day'
import { dailyStreak } from '@/logic/streak'
import type { FocusRecord } from '@/state/types'

const MINUTE = 60_000
const TODAY = new Date(2026, 10, 3, 23, 0, 0).getTime()
const TODAY_DAY = localDayNumber(TODAY)

function record(
  id: string,
  endedAt: number,
  status: FocusRecord['status'] = 'completed',
  durationMin = 25,
  forestId = 'forest-test',
): FocusRecord {
  return {
    id,
    forestId,
    startedAt: endedAt - durationMin * MINUTE,
    endedAt,
    durationMin,
    status,
    treeId: `tree-${id}`,
  }
}

function day(offset: number): number {
  return new Date(2026, 10, 3 - offset, 12, 0, 0).getTime()
}

describe('dailyStreak', () => {
  it('cuenta días consecutivos con pomodoros completados', () => {
    const sessions = [record('hoy', TODAY), record('ayer', day(1)), record('anteayer', day(2))]

    const streak = dailyStreak(sessions, TODAY_DAY)

    expect(streak.current).toBe(3)
    expect(streak.plantedToday).toBe(true)
  })

  it('mantiene la racha viva si hoy todavía no hay enfoques', () => {
    const sessions = [record('ayer', day(1)), record('anteayer', day(2))]

    const streak = dailyStreak(sessions, TODAY_DAY)

    expect(streak.current).toBe(2)
    expect(streak.plantedToday).toBe(false)
  })

  it('corta la racha en un hueco de un día', () => {
    const sessions = [record('hoy', TODAY), record('anteayer', day(2))]

    expect(dailyStreak(sessions, TODAY_DAY).current).toBe(1)
  })

  it('da 0 si ayer tampoco se plantó', () => {
    const sessions = [record('anteayer', day(2))]

    const streak = dailyStreak(sessions, TODAY_DAY)

    expect(streak.current).toBe(0)
    expect(streak.plantedToday).toBe(false)
  })

  it('no cuenta un abandono corto que no llega al mínimo', () => {
    const sessions = [record('abandonada', TODAY, 'abandoned', 10)]

    const streak = dailyStreak(sessions, TODAY_DAY)

    expect(streak.current).toBe(0)
    expect(streak.plantedToday).toBe(false)
    expect(streak.recent[3]?.planted).toBe(false)
  })

  it('cuenta un abandono largo aunque el árbol quede marchito', () => {
    const sessions = [record('ceibo', TODAY, 'abandoned', 80)]

    const streak = dailyStreak(sessions, TODAY_DAY)

    expect(streak.current).toBe(1)
    expect(streak.plantedToday).toBe(true)
    expect(streak.recent[3]?.planted).toBe(true)
  })

  it('suma enfoques del mismo día hasta llegar a los 25 minutos', () => {
    const sessions = [
      record('corto', TODAY, 'abandoned', 10),
      record('completado', TODAY, 'completed', 15),
    ]

    expect(dailyStreak(sessions, TODAY_DAY).current).toBe(1)
  })

  it('cuenta justo al llegar a los 25 minutos', () => {
    const sessions = [record('justo', TODAY, 'abandoned', 25)]

    expect(dailyStreak(sessions, TODAY_DAY).current).toBe(1)
  })

  it('filtra por bosque cuando se pasa forestId', () => {
    const sessions = [
      record('propia', TODAY),
      record('otra', day(1), 'completed', 25, 'forest-otro'),
    ]

    expect(dailyStreak(sessions, TODAY_DAY).current).toBe(2)
    expect(dailyStreak(sessions, TODAY_DAY, 'forest-test').current).toBe(1)
    expect(dailyStreak(sessions, TODAY_DAY, 'forest-otro').current).toBe(1)
    expect(
      dailyStreak(
        [record('otra', day(1), 'completed', 25, 'forest-otro')],
        TODAY_DAY,
        'forest-test',
      ).current,
    ).toBe(0)
  })

  it('arma la tira de 7 días con hoy al centro y sus letras', () => {
    const streak = dailyStreak([record('hoy', TODAY)], TODAY_DAY)

    expect(streak.recent).toHaveLength(7)
    expect(streak.recent[3]?.day).toBe(TODAY_DAY)
    expect(streak.recent[3]?.isToday).toBe(true)
    expect(streak.recent.filter((entry) => entry.isToday)).toHaveLength(1)
    expect(streak.recent.map((entry) => entry.label)).toEqual([
      'S',
      'D',
      'L',
      'M',
      'X',
      'J',
      'V',
    ])
    expect(streak.recent.map((entry) => entry.planted)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ])
  })

  it('cruza el cambio de año sin cortar la racha', () => {
    const sessions = [
      record('ene1', new Date(2027, 0, 1, 12, 0, 0).getTime()),
      record('dic31', new Date(2026, 11, 31, 12, 0, 0).getTime()),
      record('dic30', new Date(2026, 11, 30, 12, 0, 0).getTime()),
    ]
    const today = localDayNumber(new Date(2027, 0, 1, 12, 0, 0).getTime())

    const streak = dailyStreak(sessions, today)

    expect(streak.current).toBe(3)
    expect(streak.plantedToday).toBe(true)
  })

  it('ignora las sesiones futuras para la racha, pero las marca en su día', () => {
    const sessions = [record('futuro', new Date(2026, 10, 4, 0, 30, 0).getTime())]

    const streak = dailyStreak(sessions, TODAY_DAY)

    expect(streak.current).toBe(0)
    expect(streak.plantedToday).toBe(false)
    expect(streak.recent).toHaveLength(7)
    expect(streak.recent[3]?.day).toBe(TODAY_DAY)
    expect(streak.recent[3]?.planted).toBe(false)
    expect(streak.recent[4]?.planted).toBe(true)
  })
})
