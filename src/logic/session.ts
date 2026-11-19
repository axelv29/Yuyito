import type {
  FocusRecord,
  PomodoroSettings,
  SessionKind,
  SessionMode,
  SessionPlan,
  TaskStatus,
} from '@/state/types'
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

/** Tramo de la línea de tiempo del diálogo: enfoque, descanso corto o pausa larga. */
export type SessionTimelineKind = 'enfoque' | 'descanso' | 'descansoLargo'

export interface SessionTimelineSegment {
  tipo: SessionTimelineKind
  minutos: number
}

/**
 * Tramos de la sesión para la rueda y la línea de tiempo: enfoque, descanso
 * y pausa larga alternados, terminando siempre en enfoque. Reutiliza
 * `sessionSegments` para no duplicar la regla de las pausas largas; el tramo
 * de pausa larga lleva su propio tipo para poder pintarlo distinto.
 */
export function sessionTimeline(rhythm: SessionRhythm): SessionTimelineSegment[] {
  return sessionSegments(rhythm).map((segment) => ({
    tipo: segment.kind === 'focus' ? 'enfoque' : segment.kind === 'longBreak' ? 'descansoLargo' : 'descanso',
    minutos: segment.minutes,
  }))
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

/** Ritmo con el que abre el diálogo de nueva sesión. */
export interface NewSessionDefaults {
  mode: SessionMode
  focusMin: number
  breakMin: number
  targetPomodoros: number
  longBreaks: boolean
  longBreakEvery: number
  longBreakMin: number
  strictPause: boolean
}

/**
 * Repite el ritmo de la última sesión para no volver a cargarlo a mano. La
 * primera vez no hay de dónde copiar: arranca sin ciclos, y los árboles son
 * siempre elección de cada sesión.
 */
export function newSessionDefaults(
  plans: readonly SessionPlan[],
  settings: PomodoroSettings,
): NewSessionDefaults {
  let last: SessionPlan | null = null
  for (const plan of plans) {
    if (!last || plan.createdAt >= last.createdAt) {
      last = plan
    }
  }

  if (!last) {
    return {
      mode: 'continuous',
      focusMin: settings.focusMin,
      breakMin: settings.breakMin,
      targetPomodoros: 1,
      longBreaks: false,
      longBreakEvery: settings.longBreakEvery,
      longBreakMin: settings.longBreakMin,
      strictPause: settings.strictPause,
    }
  }

  const longBreakEvery = last.longBreakEvery ?? 0
  const longBreakMin = last.longBreakMin ?? 0

  return {
    mode: last.mode,
    focusMin: last.focusMin,
    breakMin: last.breakMin,
    targetPomodoros: Math.max(1, last.targetPomodoros),
    longBreaks: longBreakEvery > 0 && longBreakMin > 0,
    longBreakEvery: longBreakEvery > 0 ? longBreakEvery : settings.longBreakEvery,
    longBreakMin: longBreakMin > 0 ? longBreakMin : settings.longBreakMin,
    strictPause: last.strictPause ?? settings.strictPause,
  }
}
