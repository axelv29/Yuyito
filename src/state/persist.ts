import { createJSONStorage, type StateStorage } from 'zustand/middleware'
import { DEFAULT_FOREST_NAME, DEFAULT_FOREST_SIZE, FOREST_SIZES } from '@/config/forest'
import { GRID_COLS, GRID_ROWS } from '@/config/grid'
import { SESSION_MAX_POMODOROS, SESSION_MAX_TREES } from '@/config/session'
import { speciesConfig, speciesForFocusMin, speciesFromKind } from '@/config/species'
import { cellKey, cellOrder } from '@/logic/placement'
import { reportStorageIssue, useStorageStatus, type StorageIssue } from './storageStatus'
import type {
  ActiveSession,
  Cell,
  DisplaySettings,
  FocusRecord,
  Forest,
  LegacySessionPlan,
  LegacyTree,
  PersistedV6,
  PlantingItem,
  PomodoroSettings,
  SessionMode,
  SessionPlan,
  SessionTask,
  TaskStatus,
  Tree,
  TreeSpecies,
  TreeStage,
} from './types'
import { DEFAULT_DISPLAY_SETTINGS, DEFAULT_POMODORO_SETTINGS } from './types'

export const STORAGE_KEY = 'focus-forest'
export const PERSIST_VERSION = 6

export const DEFAULT_FOREST_ID = 'forest-default'

/** Bosque con el que arranca la app la primera vez. */
export function createDefaultForest(createdAt = 0): Forest {
  return {
    id: DEFAULT_FOREST_ID,
    name: DEFAULT_FOREST_NAME,
    description: null,
    size: DEFAULT_FOREST_SIZE,
    createdAt,
    endsOn: null,
    goalHours: null,
    archivedAt: null,
  }
}

export function emptyState(): PersistedV6 {
  return {
    version: 6,
    forests: [createDefaultForest()],
    activeForestId: DEFAULT_FOREST_ID,
    trees: [],
    sessions: [],
    plans: [],
    active: null,
    activePlanId: null,
    settings: { ...DEFAULT_POMODORO_SETTINGS },
    display: { ...DEFAULT_DISPLAY_SETTINGS },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCell(value: unknown): value is Cell {
  return (
    isRecord(value) &&
    typeof value.col === 'number' &&
    typeof value.row === 'number' &&
    Number.isInteger(value.col) &&
    Number.isInteger(value.row) &&
    value.col >= 0 &&
    value.col < GRID_COLS &&
    value.row >= 0 &&
    value.row < GRID_ROWS
  )
}

function isStage(value: unknown): value is TreeStage {
  return (
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6 ||
    value === 7
  )
}

function isForestSize(value: unknown): value is Forest['size'] {
  return typeof value === 'number' && (FOREST_SIZES as readonly number[]).includes(value)
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string'
}

function isOptionalPositiveInt(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value > 0)
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'neutral' || value === 'done' || value === 'missed'
}

function isSessionTask(value: unknown): value is SessionTask {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    isTaskStatus(value.status)
  )
}

function isTaskList(value: unknown): value is SessionTask[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(isSessionTask))
}

/** Acepta objetivos viejos (texto) y actuales (con estado). */
function isStoredTaskList(value: unknown): value is Array<string | SessionTask> | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((task) => typeof task === 'string' || isSessionTask(task)))
  )
}

/** Normaliza objetivos de cualquier versión a la forma actual. */
function toTaskList(value: unknown): SessionTask[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((task, index) => {
    if (typeof task === 'string') {
      return [{ id: `task-${index + 1}`, text: task, status: 'neutral' as const }]
    }

    return isSessionTask(task) ? [{ id: task.id, text: task.text, status: task.status }] : []
  })
}

function isLegacyTreeBase(value: unknown): value is LegacyTree {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    isCell(value.cell) &&
    isStage(value.stage) &&
    (value.state === 'mature' || value.state === 'withered') &&
    typeof value.createdAt === 'number'
  )
}

function isTreeBase(value: unknown): value is Omit<Tree, 'forestId'> {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    isCell(value.cell) &&
    isStage(value.stage) &&
    (value.state === 'growing' || value.state === 'mature' || value.state === 'withered') &&
    typeof value.requiredFocusMin === 'number' &&
    Number.isFinite(value.requiredFocusMin) &&
    value.requiredFocusMin > 0 &&
    typeof value.accumulatedFocusMin === 'number' &&
    Number.isFinite(value.accumulatedFocusMin) &&
    value.accumulatedFocusMin >= 0 &&
    (value.planId === undefined || value.planId === null || typeof value.planId === 'string') &&
    typeof value.createdAt === 'number'
  )
}

function isTree(value: unknown): value is Tree {
  return isRecord(value) && typeof value.forestId === 'string' && isTreeBase(value)
}

function isCredits(value: unknown): value is FocusRecord['credits'] {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (credit) =>
          isRecord(credit) &&
          typeof credit.treeId === 'string' &&
          typeof credit.minutes === 'number' &&
          Number.isFinite(credit.minutes) &&
          credit.minutes > 0,
      ))
  )
}

function isFocusRecordBase(value: unknown): value is Omit<FocusRecord, 'forestId'> {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.startedAt === 'number' &&
    typeof value.endedAt === 'number' &&
    typeof value.durationMin === 'number' &&
    value.durationMin > 0 &&
    (value.status === 'completed' || value.status === 'abandoned') &&
    typeof value.treeId === 'string' &&
    isOptionalString(value.title) &&
    isOptionalString(value.description) &&
    isTaskList(value.tasks) &&
    (value.planId === undefined || value.planId === null || typeof value.planId === 'string') &&
    isOptionalPositiveInt(value.pomoIndex) &&
    isOptionalPositiveInt(value.pomoTotal) &&
    isCredits(value.credits)
  )
}

function isFocusRecord(value: unknown): value is FocusRecord {
  return isRecord(value) && typeof value.forestId === 'string' && isFocusRecordBase(value)
}

/** Igual que `isFocusRecordBase`, pero acepta objetivos viejos de texto. */
function isStoredFocusRecordBase(value: unknown): value is Omit<
  FocusRecord,
  'forestId' | 'tasks'
> & {
  tasks?: Array<string | SessionTask>
} {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.startedAt === 'number' &&
    typeof value.endedAt === 'number' &&
    typeof value.durationMin === 'number' &&
    value.durationMin > 0 &&
    (value.status === 'completed' || value.status === 'abandoned') &&
    typeof value.treeId === 'string' &&
    isOptionalString(value.title) &&
    isOptionalString(value.description) &&
    isStoredTaskList(value.tasks) &&
    (value.planId === undefined || value.planId === null || typeof value.planId === 'string') &&
    isOptionalPositiveInt(value.pomoIndex) &&
    isOptionalPositiveInt(value.pomoTotal) &&
    isCredits(value.credits)
  )
}

function isSessionMode(value: unknown): value is SessionMode {
  return value === 'breaks' || value === 'continuous'
}

function isActiveSessionBase(value: unknown): value is Omit<ActiveSession, 'forestId'> {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.kind === 'focus' || value.kind === 'break') &&
    typeof value.startedAt === 'number' &&
    typeof value.endsAt === 'number' &&
    typeof value.durationMin === 'number' &&
    value.durationMin > 0 &&
    (value.pausedAt === null || typeof value.pausedAt === 'number') &&
    typeof value.pausedMs === 'number' &&
    (value.cell === null || isCell(value.cell)) &&
    (value.planId === undefined || value.planId === null || typeof value.planId === 'string') &&
    isOptionalPositiveInt(value.pomoIndex) &&
    isOptionalPositiveInt(value.pomoTotal) &&
    (value.mode === undefined || isSessionMode(value.mode)) &&
    (value.treeId === undefined || value.treeId === null || typeof value.treeId === 'string') &&
    isOptionalString(value.title) &&
    isOptionalString(value.description) &&
    isTaskList(value.tasks)
  )
}

function isActiveSession(value: unknown): value is ActiveSession {
  return (
    isRecord(value) &&
    (value.forestId === null || typeof value.forestId === 'string') &&
    isActiveSessionBase(value)
  )
}

/** Igual que `isActiveSessionBase`, pero acepta objetivos viejos de texto. */
function isStoredActiveSessionBase(value: unknown): value is Omit<
  ActiveSession,
  'forestId' | 'tasks'
> & {
  tasks?: Array<string | SessionTask>
} {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.kind === 'focus' || value.kind === 'break') &&
    typeof value.startedAt === 'number' &&
    typeof value.endsAt === 'number' &&
    typeof value.durationMin === 'number' &&
    value.durationMin > 0 &&
    (value.pausedAt === null || typeof value.pausedAt === 'number') &&
    typeof value.pausedMs === 'number' &&
    (value.cell === null || isCell(value.cell)) &&
    (value.planId === undefined || value.planId === null || typeof value.planId === 'string') &&
    isOptionalPositiveInt(value.pomoIndex) &&
    isOptionalPositiveInt(value.pomoTotal) &&
    (value.mode === undefined || isSessionMode(value.mode)) &&
    (value.treeId === undefined || value.treeId === null || typeof value.treeId === 'string') &&
    isOptionalString(value.title) &&
    isOptionalString(value.description) &&
    isStoredTaskList(value.tasks)
  )
}

function isForest(value: unknown): value is Forest {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    (value.description === null || typeof value.description === 'string') &&
    isForestSize(value.size) &&
    typeof value.createdAt === 'number' &&
    (value.endsOn === null || isDateKey(value.endsOn)) &&
    (value.goalHours === null ||
      (typeof value.goalHours === 'number' &&
        Number.isFinite(value.goalHours) &&
        value.goalHours > 0)) &&
    (value.archivedAt === null || typeof value.archivedAt === 'number')
  )
}

function isSpecies(value: unknown): value is TreeSpecies {
  return value === 'pino' || value === 'abedul' || value === 'roble' || value === 'ceibo'
}

function isPlantingItem(value: unknown): value is PlantingItem {
  return (
    isRecord(value) &&
    isSpecies(value.species) &&
    isCell(value.cell) &&
    (value.treeId === null || typeof value.treeId === 'string')
  )
}

function isSessionPlan(value: unknown): value is SessionPlan {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.forestId === 'string' &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    (value.description === null || typeof value.description === 'string') &&
    Array.isArray(value.tasks) &&
    value.tasks.every((task) => typeof task === 'string') &&
    typeof value.focusMin === 'number' &&
    Number.isFinite(value.focusMin) &&
    value.focusMin > 0 &&
    typeof value.breakMin === 'number' &&
    Number.isFinite(value.breakMin) &&
    value.breakMin >= 0 &&
    (value.longBreakMin === undefined ||
      (typeof value.longBreakMin === 'number' &&
        Number.isFinite(value.longBreakMin) &&
        value.longBreakMin >= 0)) &&
    typeof value.targetPomodoros === 'number' &&
    Number.isInteger(value.targetPomodoros) &&
    value.targetPomodoros >= 1 &&
    value.targetPomodoros <= SESSION_MAX_POMODOROS &&
    typeof value.completedPomodoros === 'number' &&
    Number.isInteger(value.completedPomodoros) &&
    value.completedPomodoros >= 0 &&
    value.completedPomodoros <= value.targetPomodoros &&
    isSessionMode(value.mode) &&
    Array.isArray(value.planting) &&
    value.planting.length >= 1 &&
    value.planting.length <= SESSION_MAX_TREES &&
    value.planting.every(isPlantingItem) &&
    typeof value.focusElapsedMin === 'number' &&
    Number.isFinite(value.focusElapsedMin) &&
    value.focusElapsedMin >= 0 &&
    typeof value.createdAt === 'number' &&
    (value.finishedAt === null || typeof value.finishedAt === 'number')
  )
}

/** Igual que `isSessionPlan`, pero acepta objetivos viejos de texto. */
function isStoredSessionPlan(
  value: unknown,
): value is Omit<SessionPlan, 'tasks'> & { tasks: Array<string | SessionTask> } {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.forestId === 'string' &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    (value.description === null || typeof value.description === 'string') &&
    Array.isArray(value.tasks) &&
    value.tasks.every((task) => typeof task === 'string' || isSessionTask(task)) &&
    typeof value.focusMin === 'number' &&
    Number.isFinite(value.focusMin) &&
    value.focusMin > 0 &&
    typeof value.breakMin === 'number' &&
    Number.isFinite(value.breakMin) &&
    value.breakMin >= 0 &&
    (value.longBreakMin === undefined ||
      (typeof value.longBreakMin === 'number' &&
        Number.isFinite(value.longBreakMin) &&
        value.longBreakMin >= 0)) &&
    typeof value.targetPomodoros === 'number' &&
    Number.isInteger(value.targetPomodoros) &&
    value.targetPomodoros >= 1 &&
    value.targetPomodoros <= SESSION_MAX_POMODOROS &&
    typeof value.completedPomodoros === 'number' &&
    Number.isInteger(value.completedPomodoros) &&
    value.completedPomodoros >= 0 &&
    value.completedPomodoros <= value.targetPomodoros &&
    isSessionMode(value.mode) &&
    Array.isArray(value.planting) &&
    value.planting.length >= 1 &&
    value.planting.length <= SESSION_MAX_TREES &&
    value.planting.every(isPlantingItem) &&
    typeof value.focusElapsedMin === 'number' &&
    Number.isFinite(value.focusElapsedMin) &&
    value.focusElapsedMin >= 0 &&
    typeof value.createdAt === 'number' &&
    (value.finishedAt === null || typeof value.finishedAt === 'number')
  )
}

function isLegacySessionPlan(value: unknown): value is LegacySessionPlan {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.forestId === 'string' &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    (value.description === null || typeof value.description === 'string') &&
    Array.isArray(value.tasks) &&
    value.tasks.every((task) => typeof task === 'string') &&
    typeof value.targetPomodoros === 'number' &&
    Number.isInteger(value.targetPomodoros) &&
    value.targetPomodoros >= 1 &&
    value.targetPomodoros <= SESSION_MAX_POMODOROS &&
    typeof value.completedPomodoros === 'number' &&
    Number.isInteger(value.completedPomodoros) &&
    value.completedPomodoros >= 0 &&
    value.completedPomodoros <= value.targetPomodoros &&
    typeof value.createdAt === 'number' &&
    (value.finishedAt === null || typeof value.finishedAt === 'number')
  )
}

function isDisplaySettings(value: unknown): value is DisplaySettings {
  return (
    isRecord(value) &&
    typeof value.showForestName === 'boolean' &&
    typeof value.showCountdown === 'boolean'
  )
}

function isPomodoroSettings(value: unknown): value is PomodoroSettings {
  if (!isRecord(value)) {
    return false
  }
  if (
    typeof value.focusMin !== 'number' ||
    value.focusMin <= 0 ||
    typeof value.breakMin !== 'number' ||
    value.breakMin <= 0 ||
    typeof value.longBreakMin !== 'number' ||
    value.longBreakMin <= 0 ||
    typeof value.longBreakEvery !== 'number' ||
    value.longBreakEvery <= 0 ||
    (value.alarmTone !== 'bell' && value.alarmTone !== 'chime' && value.alarmTone !== 'pulse') ||
    typeof value.notification !== 'boolean'
  ) {
    return false
  }
  return true
}

/** Valida el estado completo; se usa al leer la versión actual. */
export function isPersistedState(value: unknown): value is PersistedV6 {
  return (
    isRecord(value) &&
    value.version === PERSIST_VERSION &&
    Array.isArray(value.forests) &&
    value.forests.every(isForest) &&
    (value.activeForestId === null || typeof value.activeForestId === 'string') &&
    Array.isArray(value.trees) &&
    value.trees.every(isTree) &&
    Array.isArray(value.sessions) &&
    value.sessions.every(isFocusRecord) &&
    Array.isArray(value.plans) &&
    value.plans.every(isSessionPlan) &&
    (value.active === null || isActiveSession(value.active)) &&
    (value.activePlanId === null || typeof value.activePlanId === 'string') &&
    isPomodoroSettings(value.settings) &&
    isDisplaySettings(value.display)
  )
}

interface PersistedEnvelope {
  state: unknown
  version: unknown
}

function parseEnvelope(raw: string): PersistedEnvelope | null {
  try {
    const value: unknown = JSON.parse(raw)

    if (!isRecord(value) || !('state' in value) || !('version' in value)) {
      return null
    }

    return { state: value.state, version: value.version }
  } catch {
    return null
  }
}

function rawForestId(value: unknown): string | null {
  return isRecord(value) && typeof value.forestId === 'string' ? value.forestId : null
}

function inferCreatedAt(
  trees: readonly { createdAt: number }[],
  sessions: readonly { startedAt: number }[],
  active: { startedAt: number } | null,
): number {
  const values = [
    ...trees.map((tree) => tree.createdAt),
    ...sessions.map((session) => session.startedAt),
    ...(active ? [active.startedAt] : []),
  ]

  return values.length > 0 ? Math.min(...values) : 0
}

function nextAvailableCell(used: Set<string>): Cell {
  const cell = cellOrder(GRID_COLS, GRID_ROWS).find((candidate) => !used.has(cellKey(candidate)))
  const resolved = cell ?? { col: 0, row: 0 }
  used.add(cellKey(resolved))
  return resolved
}

function buildLegacyPlanting(
  plan: LegacySessionPlan,
  records: readonly FocusRecord[],
  trees: readonly Tree[],
  used: Set<string>,
): PlantingItem[] {
  const treeById = new Map(trees.map((tree) => [tree.id, tree]))
  const items: PlantingItem[] = []

  for (const record of records) {
    const tree = treeById.get(record.treeId)
    const species = tree ? speciesFromKind(tree.kind) : 'pino'
    const cell = tree ? tree.cell : nextAvailableCell(used)
    if (tree) {
      used.add(cellKey(cell))
    }
    items.push({ species, cell, treeId: tree?.id ?? null })
  }

  while (items.length < plan.targetPomodoros) {
    items.push({ species: 'pino', cell: nextAvailableCell(used), treeId: null })
  }

  return items.slice(0, plan.targetPomodoros)
}

/**
 * Acepta datos de cualquier versión y conserva solo lo que tenga la forma
 * esperada. Los datos anteriores a la v3 se agrupan en un bosque inicial de
 * 8×8; los árboles huérfanos se recuperan en lugar de perderse.
 */
export function migrate(persisted: unknown, _version: number): PersistedV6 {
  const data = isRecord(persisted) ? persisted : {}

  const settings = isPomodoroSettings(data.settings)
    ? { ...DEFAULT_POMODORO_SETTINGS, ...data.settings }
    : { ...DEFAULT_POMODORO_SETTINGS }
  const display = isDisplaySettings(data.display)
    ? { ...DEFAULT_DISPLAY_SETTINGS, ...data.display }
    : { ...DEFAULT_DISPLAY_SETTINGS }

  const forests: Forest[] = Array.isArray(data.forests)
    ? data.forests.filter(isForest).map((forest) => ({ ...forest }))
    : []

  const rawTrees = Array.isArray(data.trees) ? data.trees : []
  const legacyTrees = rawTrees.flatMap((value) => {
    if (isTreeBase(value) || isLegacyTreeBase(value)) {
      return [{ ...value, forestId: rawForestId(value) }]
    }

    return []
  })
  const legacySessions = (Array.isArray(data.sessions) ? data.sessions : []).flatMap((value) => {
    if (!isStoredFocusRecordBase(value)) {
      return []
    }

    return [
      {
        ...value,
        tasks: value.tasks === undefined ? undefined : toTaskList(value.tasks),
        forestId: rawForestId(value),
      },
    ]
  })
  const activeRaw = isStoredActiveSessionBase(data.active) ? data.active : null
  const legacyActive = activeRaw
    ? {
        ...activeRaw,
        tasks: activeRaw.tasks === undefined ? undefined : toTaskList(activeRaw.tasks),
        forestId: rawForestId(activeRaw),
      }
    : null

  if (forests.length === 0) {
    forests.push(createDefaultForest(inferCreatedAt(legacyTrees, legacySessions, legacyActive)))
  }

  const known = new Set(forests.map((forest) => forest.id))
  const fallbackId =
    forests.find((forest) => forest.archivedAt === null)?.id ?? forests[0]?.id ?? null

  const resolveForestId = (value: string | null): string | null =>
    value !== null && known.has(value) ? value : fallbackId

  const treePlanByTreeId = new Map<string, string>()
  for (const session of legacySessions) {
    if (typeof session.planId === 'string') {
      treePlanByTreeId.set(session.treeId, session.planId)
    }
  }

  const trees: Tree[] = legacyTrees.flatMap((value) => {
    const forestId = resolveForestId(value.forestId)
    if (!forestId) {
      return []
    }

    if (isTreeBase(value)) {
      return [{ ...value, forestId }]
    }

    const species = speciesFromKind(value.kind)
    const requiredFocusMin = speciesConfig(species).minutes
    return [
      {
        id: value.id,
        forestId,
        sessionId: value.sessionId,
        cell: value.cell,
        kind: value.kind,
        stage: value.stage,
        state: value.state,
        requiredFocusMin,
        accumulatedFocusMin: requiredFocusMin,
        planId: treePlanByTreeId.get(value.id) ?? null,
        createdAt: value.createdAt,
      },
    ]
  })

  const sessions: FocusRecord[] = legacySessions.flatMap((session) => {
    const forestId = resolveForestId(session.forestId)
    return forestId ? [{ ...session, forestId }] : []
  })

  const rawPlans = Array.isArray(data.plans) ? data.plans : []
  const rawPlanIds = new Set(
    rawPlans.flatMap((value) =>
      isRecord(value) && typeof value.id === 'string' ? [value.id] : [],
    ),
  )

  const activePlanIdForTree =
    legacyActive && typeof legacyActive.planId === 'string' && rawPlanIds.has(legacyActive.planId)
      ? legacyActive.planId
      : null

  let active: ActiveSession | null = null
  if (legacyActive) {
    const forestId = legacyActive.kind === 'focus' ? resolveForestId(legacyActive.forestId) : null
    const mode: SessionMode | undefined =
      legacyActive.mode ?? (activePlanIdForTree ? 'breaks' : undefined)
    let treeId = legacyActive.treeId ?? null
    const linkedTree = treeId ? trees.find((tree) => tree.id === treeId) : undefined

    if (!linkedTree && legacyActive.kind === 'focus' && legacyActive.cell) {
      const existing = trees.find(
        (tree) =>
          tree.sessionId === legacyActive.id ||
          (tree.cell.col === legacyActive.cell?.col && tree.cell.row === legacyActive.cell?.row),
      )

      if (existing) {
        treeId = existing.id
      } else {
        const species = speciesForFocusMin(legacyActive.durationMin)
        const requiredFocusMin = speciesConfig(species).minutes
        const tree: Tree = {
          id: `migrated-active-${legacyActive.id}`,
          forestId: forestId ?? fallbackId ?? DEFAULT_FOREST_ID,
          sessionId: legacyActive.id,
          cell: legacyActive.cell,
          kind: species,
          stage: 1,
          state: 'growing',
          requiredFocusMin,
          accumulatedFocusMin: 0,
          planId: activePlanIdForTree,
          createdAt: legacyActive.startedAt,
        }
        trees.push(tree)
        treeId = tree.id
      }
    }

    active = {
      ...legacyActive,
      forestId,
      planId: activePlanIdForTree,
      mode,
      treeId,
    }
  }

  const usedCells = new Set(trees.map((tree) => cellKey(tree.cell)))
  const plans: SessionPlan[] = rawPlans.flatMap((value) => {
    if (isStoredSessionPlan(value)) {
      const forestId = resolveForestId(value.forestId)
      if (!forestId) {
        return []
      }
      value.planting.forEach((item) => usedCells.add(cellKey(item.cell)))
      return [{ ...value, tasks: toTaskList(value.tasks), forestId }]
    }

    if (!isLegacySessionPlan(value)) {
      return []
    }

    const forestId = resolveForestId(value.forestId)
    if (!forestId) {
      return []
    }

    const records = sessions
      .filter((session) => session.planId === value.id)
      .sort((a, b) => a.startedAt - b.startedAt)

    return [
      {
        ...value,
        tasks: toTaskList(value.tasks),
        forestId,
        focusMin: settings.focusMin,
        breakMin: settings.breakMin,
        longBreakMin: settings.longBreakMin,
        mode: 'breaks',
        planting: buildLegacyPlanting(value, records, trees, usedCells),
        focusElapsedMin: value.completedPomodoros * settings.focusMin,
      },
    ]
  })

  if (active?.planId && active.treeId) {
    const plan = plans.find((candidate) => candidate.id === active.planId)
    const tree = trees.find((candidate) => candidate.id === active.treeId)
    if (plan && tree && !plan.planting.some((item) => item.treeId === tree.id)) {
      const target =
        plan.planting.find((item) => item.treeId === null) ??
        plan.planting.find(
          (item) => item.cell.col === tree.cell.col && item.cell.row === tree.cell.row,
        )
      if (target) {
        target.treeId = tree.id
        target.species = speciesFromKind(tree.kind)
        target.cell = tree.cell
      }
    }
  }

  const activePlanId =
    typeof data.activePlanId === 'string' &&
    plans.some((plan) => plan.id === data.activePlanId && plan.finishedAt === null)
      ? data.activePlanId
      : active?.planId &&
          plans.some((plan) => plan.id === active.planId && plan.finishedAt === null)
        ? active.planId
        : null

  const savedActiveForestId =
    typeof data.activeForestId === 'string' && known.has(data.activeForestId)
      ? data.activeForestId
      : null
  const activeForestId = active?.forestId ?? savedActiveForestId ?? fallbackId ?? null

  return {
    version: 6,
    forests,
    activeForestId,
    trees,
    sessions,
    plans,
    active,
    activePlanId,
    settings,
    display,
  }
}

type GetStorage = () => Storage | null
type ReportIssue = (issue: StorageIssue) => void

function defaultGetStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function backupState(storage: Storage, name: string, raw: string): boolean {
  try {
    const baseKey = `${name}.broken`
    const backupKey = storage.getItem(baseKey) === null ? baseKey : `${baseKey}.${Date.now()}`

    storage.setItem(backupKey, raw)

    try {
      storage.removeItem(name)
    } catch {
      // Si no se puede borrar, la copia ya está a salvo.
    }

    return true
  } catch {
    return false
  }
}

/**
 * Envuelve localStorage con tres protecciones:
 * - datos dañados: copia en `focus-forest.broken` y reinicio;
 * - versión más nueva: aviso y escrituras bloqueadas, sin tocar el original;
 * - almacenamiento bloqueado o lleno: aviso y estado solo en memoria.
 */
export function createSafeStorage(
  getStorage: GetStorage = defaultGetStorage,
  reportIssue: ReportIssue = reportStorageIssue,
): StateStorage {
  let writesBlocked = false

  return {
    getItem: (name) => {
      let storage: Storage | null

      try {
        storage = getStorage()
      } catch {
        reportIssue({ kind: 'unavailable' })
        return null
      }

      if (!storage) {
        reportIssue({ kind: 'unavailable' })
        return null
      }

      let raw: string | null
      try {
        raw = storage.getItem(name)
      } catch {
        reportIssue({ kind: 'unavailable' })
        return null
      }

      if (raw === null) {
        return null
      }

      const resetCorrupt = (): null => {
        const backedUp = backupState(storage, name, raw)
        if (!backedUp) {
          writesBlocked = true
        }
        reportIssue(backedUp ? { kind: 'corrupt' } : { kind: 'unavailable' })
        return null
      }

      const envelope = parseEnvelope(raw)
      if (!envelope) {
        return resetCorrupt()
      }

      if (typeof envelope.version !== 'number' || !Number.isFinite(envelope.version)) {
        return resetCorrupt()
      }

      if (envelope.version > PERSIST_VERSION) {
        writesBlocked = true
        reportIssue({ kind: 'future-version', version: envelope.version })
        return null
      }

      if (envelope.version === PERSIST_VERSION && !isPersistedState(envelope.state)) {
        return resetCorrupt()
      }

      return raw
    },

    setItem: (name, value) => {
      if (writesBlocked) {
        return
      }

      let storage: Storage | null
      try {
        storage = getStorage()
      } catch {
        reportIssue({ kind: 'unavailable' })
        return
      }

      if (!storage) {
        reportIssue({ kind: 'unavailable' })
        return
      }

      try {
        storage.setItem(name, value)

        // Si el almacenamiento se recuperó, el aviso deja de aplicar.
        if (useStorageStatus.getState().issue?.kind === 'unavailable') {
          useStorageStatus.getState().dismiss()
        }
      } catch {
        reportIssue({ kind: 'unavailable' })
      }
    },

    removeItem: (name) => {
      if (writesBlocked) {
        return
      }

      try {
        const storage = getStorage()
        storage?.removeItem(name)
      } catch {
        reportIssue({ kind: 'unavailable' })
      }
    },
  }
}

export const safeStorage = createSafeStorage()
export const persistStorage = createJSONStorage<PersistedV6>(() => safeStorage)
