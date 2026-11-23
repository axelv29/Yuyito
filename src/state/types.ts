import type { ForestSize } from '@/config/forest'

export type TreeStage = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type TreeSpecies = 'pino' | 'abedul' | 'roble' | 'ceibo'
export type TreeState = 'growing' | 'mature' | 'withered'
export type SessionKind = 'focus' | 'break'
export type SessionMode = 'breaks' | 'continuous'
export type FocusStatus = 'completed' | 'abandoned' | 'running'
export type TreeKind = string
export type AlarmTone = 'bell' | 'chime' | 'pulse'
/** Estado de un objetivo: sin marcar, logrado o no logrado. */
export type TaskStatus = 'neutral' | 'done' | 'missed'

/** Objetivo de una sesión. El usuario decide si lo logró o no. */
export interface SessionTask {
  id: string
  text: string
  status: TaskStatus
}

export interface Cell {
  col: number
  row: number
}

/** Un bosque es un objetivo con vida propia: un semestre, una materia, un examen. */
export interface Forest {
  id: string
  name: string
  description: string | null
  size: ForestSize
  createdAt: number
  /** Fecha local YYYY-MM-DD; null si el bosque no tiene plazo. */
  endsOn: string | null
  /** Objetivo opcional en horas de enfoque. */
  goalHours: number | null
  /** Se completará en una próxima versión; null mientras esté activo. */
  archivedAt: number | null
}

export interface NewForestInput {
  name: string
  description: string | null
  size: ForestSize
  endsOn: string | null
  goalHours: number | null
}

/** Un árbol reservado dentro de una sesión. La celda se elige al planificar. */
export interface PlantingItem {
  species: TreeSpecies
  cell: Cell
  /** Se completa cuando el árbol empieza a crecer. */
  treeId: string | null
}

export interface Tree {
  id: string
  forestId: string
  sessionId: string
  cell: Cell
  kind?: TreeKind
  stage: TreeStage
  state: TreeState
  /** Minutos de enfoque que necesita esta especie para madurar. */
  requiredFocusMin: number
  /** Minutos de enfoque acumulados entre bloques. */
  accumulatedFocusMin: number
  /** Plan al que pertenece el árbol, si nació de una sesión planificada. */
  planId?: string | null
  createdAt: number
}

/** Sesión planificada: un ritmo de bloques y una cola de árboles. */
export interface SessionPlan {
  id: string
  forestId: string
  title: string
  description: string | null
  tasks: SessionTask[]
  /** Minutos de cada bloque de enfoque. */
  focusMin: number
  /** Minutos de cada pausa (solo en modo con descansos). */
  breakMin: number
  /** Minutos del descanso largo al cerrar un ciclo de bloques. */
  longBreakMin?: number
  /** Cada cuántos bloques va el descanso largo. `0` = sin pausa larga. */
  longBreakEvery?: number
  /** Pausa estricta de esta sesión; si falta, se usan los ajustes. */
  strictPause?: boolean
  /** Cantidad de bloques de enfoque (1–8). En ciclos indefinidos se ignora. */
  targetPomodoros: number
  /** true = ciclos indefinidos; no hay objetivo y el usuario decide cuándo terminar. */
  openEnded?: boolean
  completedPomodoros: number
  mode: SessionMode
  /** Árboles en orden, con su celda reservada. */
  planting: PlantingItem[]
  /** Minutos de enfoque ya acreditados al plan. */
  focusElapsedMin: number
  createdAt: number
  /** Se cierra al completar el objetivo o al abandonar la sesión. */
  finishedAt: number | null
}

export interface NewSessionInput {
  /** Opcional: si se deja vacío, la sesión arranca con "Sesión N" del día. */
  title?: string
  description: string | null
  tasks: string[]
  focusMin: number
  breakMin: number
  longBreakMin: number
  /** Cada cuántos bloques va la pausa larga. `0` = sin pausa larga. */
  longBreakEvery?: number
  /** Pausa estricta; si falta, se usan los ajustes. */
  strictPause?: boolean
  targetPomodoros: number
  mode: SessionMode
  planting: TreeSpecies[]
  /** true = ciclos indefinidos. */
  openEnded?: boolean
}

export interface ActiveSession {
  id: string
  /** Solo los enfoques pertenecen a un bosque; los descansos no. */
  forestId: string | null
  kind: SessionKind
  startedAt: number
  endsAt: number
  durationMin: number
  pausedAt: number | null
  pausedMs: number
  /** Solo las sesiones de enfoque reservan una celda. */
  cell: Cell | null
  /** v2: pausa estricta. */
  strictPause?: boolean
  /** v2: tolerancia acumulada de pausa (minutos). */
  pauseToleranceMin?: number
  /** v2: true para los descansos largos (distinto color en el anillo). */
  longBreak?: boolean
  /** Sesión a la que pertenece este pomodoro. */
  planId?: string | null
  /** Posición del pomodoro dentro de la sesión (1-based). */
  pomoIndex?: number
  pomoTotal?: number
  /** Modo de la sesión planificada. */
  mode?: SessionMode
  /** Árbol que está creciendo durante este bloque. */
  treeId?: string | null
  title?: string | null
  description?: string | null
  tasks?: SessionTask[]
}

export interface FocusRecord {
  id: string
  forestId: string
  startedAt: number
  endedAt: number
  durationMin: number
  status: FocusStatus
  treeId: string
  /** v2: título de la sesión. */
  title?: string | null
  /** v2: descripción de la sesión. */
  description?: string | null
  /** v2: objetivos con estado propio. */
  tasks?: SessionTask[]
  /** Sesión planificada a la que pertenece el pomodoro. */
  planId?: string | null
  pomoIndex?: number
  pomoTotal?: number
  /** Minutos acreditados a cada árbol durante este bloque. */
  credits?: Array<{ treeId: string; minutes: number }>
}

export interface PomodoroSettings {
  focusMin: number
  breakMin: number
  longBreakMin: number
  longBreakEvery: number
  strictPause: boolean
  pauseToleranceMin: number
  alarmTone: AlarmTone
  notification: boolean
  alarmVolume: number
  autoStartBreak: boolean
  autoStartFocus: boolean
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  strictPause: false,
  pauseToleranceMin: 0,
  alarmTone: 'bell',
  notification: true,
  alarmVolume: 0.6,
  autoStartBreak: false,
  autoStartFocus: false,
}

export interface DisplaySettings {
  showForestName: boolean
  showCountdown: boolean
  hideTimerCard: boolean
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showForestName: true,
  showCountdown: true,
  hideTimerCard: false,
}

/** Forma de un árbol antes de la v5 (sin progreso acumulado). */
export interface LegacyTree {
  id: string
  sessionId: string
  cell: Cell
  kind?: TreeKind
  stage: TreeStage
  state: 'mature' | 'withered'
  createdAt: number
}

export type LegacyForestTree = LegacyTree & { forestId: string }
export type LegacyFocusRecord = Omit<FocusRecord, 'forestId' | 'credits'>
export type LegacyForestFocusRecord = LegacyFocusRecord & { forestId: string }
export type LegacyActiveSession = Omit<ActiveSession, 'forestId' | 'mode' | 'treeId'>
export type LegacyForestActiveSession = LegacyActiveSession & { forestId: string | null }
/** Plan anterior a la v5: sin ritmo ni cola de plantación. */
export interface LegacySessionPlan {
  id: string
  forestId: string
  title: string
  description: string | null
  tasks: string[]
  targetPomodoros: number
  completedPomodoros: number
  createdAt: number
  finishedAt: number | null
}

export interface PersistedV1 {
  version: 1
  trees: LegacyTree[]
  sessions: LegacyFocusRecord[]
  active: LegacyActiveSession | null
}

export interface PersistedV2 {
  version: 2
  trees: LegacyTree[]
  sessions: LegacyFocusRecord[]
  active: LegacyActiveSession | null
  settings: PomodoroSettings
}

export interface PersistedV3 {
  version: 3
  forests: Forest[]
  activeForestId: string | null
  trees: LegacyForestTree[]
  sessions: LegacyForestFocusRecord[]
  active: LegacyForestActiveSession | null
  settings: PomodoroSettings
  display: DisplaySettings
}

/** v4: sesiones planificadas de uno o varios pomodoros. */
export interface PersistedV4 {
  version: 4
  forests: Forest[]
  activeForestId: string | null
  trees: LegacyForestTree[]
  sessions: LegacyForestFocusRecord[]
  plans: LegacySessionPlan[]
  active: LegacyForestActiveSession | null
  /** Sesión planificada que se puede continuar con el próximo pomodoro. */
  activePlanId: string | null
  settings: PomodoroSettings
  display: DisplaySettings
}

/** Forma de un guardado v5: objetivos como texto, sin estado. */
export type LegacyFocusRecordV5 = Omit<FocusRecord, 'tasks'> & { tasks?: string[] }
export type LegacyActiveSessionV5 = Omit<ActiveSession, 'tasks'> & { tasks?: string[] }
export type LegacySessionPlanV5 = Omit<SessionPlan, 'tasks'> & { tasks: string[] }

/** v5: árboles con progreso y sesiones con ritmo y cola de plantación. */
export interface PersistedV5 {
  version: 5
  forests: Forest[]
  activeForestId: string | null
  trees: Tree[]
  sessions: LegacyFocusRecordV5[]
  plans: LegacySessionPlanV5[]
  active: LegacyActiveSessionV5 | null
  activePlanId: string | null
  settings: PomodoroSettings
  display: DisplaySettings
}

/** v6: objetivos con estado propio (neutral, completado, no completado). */
export interface PersistedV6 {
  version: 6
  forests: Forest[]
  activeForestId: string | null
  trees: Tree[]
  sessions: FocusRecord[]
  plans: SessionPlan[]
  active: ActiveSession | null
  activePlanId: string | null
  settings: PomodoroSettings
  display: DisplaySettings
}

/** v7: como v6 más el día en que se mostró la card de racha diaria. */
export interface PersistedV7 {
  version: 7
  forests: Forest[]
  activeForestId: string | null
  trees: Tree[]
  sessions: FocusRecord[]
  plans: SessionPlan[]
  active: ActiveSession | null
  activePlanId: string | null
  settings: PomodoroSettings
  display: DisplaySettings
  /** Día local (YYYY-MM-DD) en que se mostró la card de racha; null si nunca. */
  streakIntroShownOn: string | null
}

/** v8: como v7 más el flag para ocultar la card del temporizador. */
export interface PersistedV8 {
  version: 8
  forests: Forest[]
  activeForestId: string | null
  trees: Tree[]
  sessions: FocusRecord[]
  plans: SessionPlan[]
  active: ActiveSession | null
  activePlanId: string | null
  settings: PomodoroSettings
  display: DisplaySettings
  /** Día local (YYYY-MM-DD) en que se mostró la card de racha; null si nunca. */
  streakIntroShownOn: string | null
}

/** v9: como v8 más las sesiones de ciclos indefinidos. */
export interface PersistedV9 {
  version: 9
  forests: Forest[]
  activeForestId: string | null
  trees: Tree[]
  sessions: FocusRecord[]
  plans: SessionPlan[]
  active: ActiveSession | null
  activePlanId: string | null
  settings: PomodoroSettings
  display: DisplaySettings
  /** Día local (YYYY-MM-DD) en que se mostró la card de racha; null si nunca. */
  streakIntroShownOn: string | null
}
