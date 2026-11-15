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
