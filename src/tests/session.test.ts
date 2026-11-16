import { describe, expect, it } from 'vitest'
import { nextTaskStatus, sessionName, sessionSegments, sessionTotalMinutes } from '@/logic/session'

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
