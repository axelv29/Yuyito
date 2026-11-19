import { describe, expect, it } from 'vitest'
import { SESSION_MAX_POMODOROS } from '@/config/session'
import {
  newSessionDefaults,
  nextTaskStatus,
  sessionName,
  sessionSegments,
  sessionTimeline,
  sessionTotalMinutes,
} from '@/logic/session'
import { DEFAULT_POMODORO_SETTINGS } from '@/state/types'
import type { SessionPlan } from '@/state/types'

describe('sessionName', () => {
  it('numera el próximo pomodoro del día', () => {
    expect(sessionName(null, 0)).toBe('Pomodoro 1 · Hoy')
    expect(sessionName('focus', 2)).toBe('Pomodoro 3 · Hoy')
  })

  it('nombra el descanso sin numerarlo', () => {
    expect(sessionName('break', 4)).toBe('Descanso · Hoy')
  })
})

describe('nextTaskStatus', () => {
  it('cicla neutral → completado → no completado → neutral', () => {
    expect(nextTaskStatus('neutral')).toBe('done')
    expect(nextTaskStatus('done')).toBe('missed')
    expect(nextTaskStatus('missed')).toBe('neutral')
  })
})

describe('sessionSegments', () => {
  it('alterna enfoque y pausa y no agrega pausa al final', () => {
    const segments = sessionSegments({ focusMin: 25, breakMin: 5, cycles: 3 })

    expect(segments.map((segment) => segment.kind)).toEqual([
      'focus',
      'shortBreak',
      'focus',
      'shortBreak',
      'focus',
    ])
    expect(sessionTotalMinutes({ focusMin: 25, breakMin: 5, cycles: 3 })).toBe(85)
  })

  it('cambia la pausa por la larga cada N bloques', () => {
    const rhythm = { focusMin: 25, breakMin: 5, cycles: 5, longBreakMin: 15, longBreakEvery: 2 }
    const kinds = sessionSegments(rhythm).map((segment) => segment.kind)

    expect(kinds).toEqual([
      'focus',
      'shortBreak',
      'focus',
      'longBreak',
      'focus',
      'shortBreak',
      'focus',
      'longBreak',
      'focus',
    ])
    expect(sessionTotalMinutes(rhythm)).toBe(25 * 5 + 5 * 2 + 15 * 2)
  })

  it('sin ciclos armados la sesión es un solo bloque', () => {
    const rhythm = { focusMin: 50, breakMin: 0, cycles: 1, longBreakMin: 0, longBreakEvery: 0 }

    expect(sessionSegments(rhythm)).toEqual([{ kind: 'focus', minutes: 50 }])
    expect(sessionTotalMinutes(rhythm)).toBe(50)
  })
})

describe('sessionTimeline', () => {
  it('alterna enfoque y descanso y termina en enfoque', () => {
    const segments = sessionTimeline({ focusMin: 25, breakMin: 5, cycles: 3 })

    expect(segments).toEqual([
      { tipo: 'enfoque', minutos: 25 },
      { tipo: 'descanso', minutos: 5 },
      { tipo: 'enfoque', minutos: 25 },
      { tipo: 'descanso', minutos: 5 },
      { tipo: 'enfoque', minutos: 25 },
    ])
    expect(segments.reduce((sum, segment) => sum + segment.minutos, 0)).toBe(85)
  })

  it('con un solo ciclo es un único tramo de enfoque', () => {
    expect(sessionTimeline({ focusMin: 50, breakMin: 10, cycles: 1 })).toEqual([
      { tipo: 'enfoque', minutos: 50 },
    ])
  })

  it('respeta el máximo de ciclos', () => {
    const segments = sessionTimeline({
      focusMin: 90,
      breakMin: 20,
      cycles: SESSION_MAX_POMODOROS,
    })

    expect(segments).toHaveLength(SESSION_MAX_POMODOROS * 2 - 1)
    expect(segments.reduce((sum, segment) => sum + segment.minutos, 0)).toBe(90 * 8 + 20 * 7)
    expect(segments[segments.length - 1]).toEqual({ tipo: 'enfoque', minutos: 90 })
  })

  it('muestra las pausas largas con su propio tipo', () => {
    const segments = sessionTimeline({
      focusMin: 25,
      breakMin: 5,
      cycles: 5,
      longBreakMin: 15,
      longBreakEvery: 2,
    })

    expect(segments.filter((segment) => segment.tipo === 'descanso').map((s) => s.minutos)).toEqual(
      [5, 5],
    )
    expect(
      segments.filter((segment) => segment.tipo === 'descansoLargo').map((s) => s.minutos),
    ).toEqual([15, 15])
    expect(segments.reduce((sum, segment) => sum + segment.minutos, 0)).toBe(165)
  })
})

function plan(overrides: Partial<SessionPlan> & { createdAt: number }): SessionPlan {
  return {
    id: `plan-${overrides.createdAt}`,
    forestId: 'forest-1',
    title: 'Sesión',
    description: null,
    tasks: [],
    focusMin: 25,
    breakMin: 5,
    targetPomodoros: 3,
    completedPomodoros: 0,
    mode: 'breaks',
    planting: [],
    focusElapsedMin: 0,
    finishedAt: null,
    ...overrides,
  }
}

describe('newSessionDefaults', () => {
  it('la primera sesión arranca sin ciclos y con los ajustes', () => {
    const defaults = newSessionDefaults([], DEFAULT_POMODORO_SETTINGS)

    expect(defaults.mode).toBe('continuous')
    expect(defaults.targetPomodoros).toBe(1)
    expect(defaults.longBreaks).toBe(false)
    expect(defaults.focusMin).toBe(DEFAULT_POMODORO_SETTINGS.focusMin)
    expect(defaults.breakMin).toBe(DEFAULT_POMODORO_SETTINGS.breakMin)
  })

  it('después repite el ritmo de la última sesión', () => {
    const defaults = newSessionDefaults(
      [
        plan({ createdAt: 1, mode: 'continuous', targetPomodoros: 1, focusMin: 50, breakMin: 10 }),
        plan({ createdAt: 2, focusMin: 30, breakMin: 6, targetPomodoros: 4 }),
      ],
      DEFAULT_POMODORO_SETTINGS,
    )

    expect(defaults).toMatchObject({
      mode: 'breaks',
      focusMin: 30,
      breakMin: 6,
      targetPomodoros: 4,
    })
  })

  it('toma la sesión más nueva aunque la lista llegue desordenada', () => {
    const defaults = newSessionDefaults(
      [plan({ createdAt: 9, focusMin: 90, breakMin: 20 }), plan({ createdAt: 3, focusMin: 15 })],
      DEFAULT_POMODORO_SETTINGS,
    )

    expect(defaults.focusMin).toBe(90)
    expect(defaults.breakMin).toBe(20)
  })

  it('solo hereda las pausas largas si la última sesión las usaba', () => {
    const conLargas = newSessionDefaults(
      [plan({ createdAt: 5, longBreakEvery: 2, longBreakMin: 20 })],
      DEFAULT_POMODORO_SETTINGS,
    )
    const sinLargas = newSessionDefaults(
      [plan({ createdAt: 5, longBreakEvery: 0, longBreakMin: 0 })],
      DEFAULT_POMODORO_SETTINGS,
    )

    expect(conLargas.longBreaks).toBe(true)
    expect(conLargas.longBreakEvery).toBe(2)
    expect(conLargas.longBreakMin).toBe(20)
    expect(sinLargas.longBreaks).toBe(false)
  })
})
