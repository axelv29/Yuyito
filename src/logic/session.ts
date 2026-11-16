import type { FocusRecord, SessionKind, TaskStatus } from '@/state/types'
import { localDayKey } from './day'

/** Ciclo de un objetivo: neutral → completado → no completado → neutral. */
export const TASK_STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  neutral: 'done',
  done: 'missed',
  missed: 'neutral',
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  neutral: 'Sin marcar',
  done: 'Completado',
  missed: 'No completado',
}

export function nextTaskStatus(status: TaskStatus): TaskStatus {
  return TASK_STATUS_CYCLE[status]
}

/**
 * Nombre visible de la sesión. Se deriva de los datos existentes: el próximo
 * pomodoro del día. Cuando exista el nombre editable (v0.2), esta función
 * devuelve ese valor y no cambia la interfaz.
 */
export function sessionName(kind: SessionKind | null, todayPomodoros: number): string {
  if (kind === 'break') {
    return 'Descanso · Hoy'
  }

  return `Pomodoro ${todayPomodoros + 1} · Hoy`
}

/** Número de la próxima sesión del día en curso (1-based). */
export function todaySessionNumber(sessions: readonly FocusRecord[], now: number): number {
  const day = localDayKey(now)
  const startedToday = sessions.filter((session) => localDayKey(session.startedAt) === day).length

  return startedToday + 1
}

/** Nombre por defecto para sesiones sin título: "Sesión N" del día. */
export function defaultSessionName(sessions: readonly FocusRecord[], now: number): string {
  return `Sesión ${todaySessionNumber(sessions, now)}`
}

/** Tipo de bloque dentro de una sesión planificada. */
export type SessionSegmentKind = 'focus' | 'shortBreak' | 'longBreak'

export interface SessionSegment {
  kind: SessionSegmentKind
  minutes: number
}

/** Ritmo de una sesión: enfoques, pausas y ciclos. */
export interface SessionRhythm {
  focusMin: number
  breakMin: number
  cycles: number
  longBreakMin?: number
  longBreakEvery?: number
}

/**
 * Bloques de una sesión en orden: cada enfoque seguido de su pausa, que es
 * larga cada `longBreakEvery` bloques. La última pausa no se incluye.
 */
export function sessionSegments(rhythm: SessionRhythm): SessionSegment[] {
  const cycles = Math.max(1, Math.round(rhythm.cycles))
  const every = Math.max(0, Math.round(rhythm.longBreakEvery ?? 0))
  const longBreakMin = Math.max(0, Math.round(rhythm.longBreakMin ?? 0))
  const breakMin = Math.max(0, Math.round(rhythm.breakMin))
  const segments: SessionSegment[] = []

  for (let index = 0; index < cycles; index += 1) {
    segments.push({ kind: 'focus', minutes: Math.max(0, Math.round(rhythm.focusMin)) })
    if (index === cycles - 1) {
      continue
    }

    const afterCycle = index + 1
    if (every > 0 && longBreakMin > 0 && afterCycle % every === 0) {
      segments.push({ kind: 'longBreak', minutes: longBreakMin })
    } else if (breakMin > 0) {
      segments.push({ kind: 'shortBreak', minutes: breakMin })
    }
  }

  return segments
}

/** Duración total de la sesión, pausas incluidas. */
export function sessionTotalMinutes(rhythm: SessionRhythm): number {
  return sessionSegments(rhythm).reduce((sum, segment) => sum + segment.minutes, 0)
}

/** Día y hora de inicio, con el formato corto de la tarjeta de sesión. */
export function formatSessionStart(timestamp: number): string {
  const date = new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(timestamp))
    .replace(',', '')
  const time = new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))

  return `${date.charAt(0).toUpperCase()}${date.slice(1)}, ${time}`
}
