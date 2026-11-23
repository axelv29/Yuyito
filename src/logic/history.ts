import type { ActiveSession, FocusRecord, SessionPlan, SessionTask, Tree } from '@/state/types'
import { speciesConfig, speciesForFocusMin } from '@/config/species'
import { stageForElapsedMs } from '@/logic/growth'
import { livePlanFocus, projectOpenPlanting, projectPlanting } from '@/logic/planting'
import { elapsedMs } from './timer'
import { localDayKey } from './day'

export type HistoryFilter = 'all' | 'today' | 'week' | 'multi' | 'withered'
export type HistoryStatus = 'completed' | 'abandoned' | 'mixed' | 'running' | 'unfinished'

/** Una sesión del historial: uno o varios pomodoros agrupados por plan. */
export interface HistoryEntry {
  key: string
  plan: SessionPlan | null
  records: FocusRecord[]
  trees: Tree[]
  primaryRecord: FocusRecord
  primaryTree: Tree | null
  title: string
  description: string | null
  tasks: SessionTask[]
  startedAt: number
  endedAt: number
  totalDurationMin: number
  status: HistoryStatus
  withered: boolean
  completedPomodoros: number
  targetPomodoros: number
  openEnded: boolean
  isMulti: boolean
}

export const HISTORY_FILTERS: ReadonlyArray<{ value: HistoryFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'multi', label: 'Series' },
  { value: 'withered', label: 'Marchitas' },
]

function startOfLocalWeek(now: number): number {
  const date = new Date(now)
  const mondayOffset = (date.getDay() + 6) % 7

  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset).getTime()
}

function statusFor(records: readonly FocusRecord[], plan: SessionPlan | null): HistoryStatus {
  const completed = records.filter((record) => record.status === 'completed').length
  const abandoned = records.length - completed
  const latest = records[records.length - 1]

  if (latest && latest.status === 'running') {
    return 'running'
  }

  // Una sesión indefinida sigue abierta hasta que el usuario decide terminar.
  if (plan?.openEnded && plan.finishedAt === null) {
    return 'running'
  }

  if (abandoned === 0) {
    // Serie cerrada antes de tiempo: se recuerda como sesión sin terminar.
    if (plan && plan.finishedAt !== null && plan.completedPomodoros < plan.targetPomodoros) {
      return 'unfinished'
    }

    return 'completed'
  }
  if (completed === 0) {
    return 'abandoned'
  }

  return 'mixed'
}

function buildEntry(
  key: string,
  plan: SessionPlan | null,
  records: FocusRecord[],
  treesBySession: ReadonlyMap<string, Tree>,
): HistoryEntry {
  const ordered = [...records].sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))
  const primaryRecord = ordered[ordered.length - 1]
  const treeIds = new Set<string>()
  for (const record of ordered) {
    treeIds.add(record.treeId)
    for (const credit of record.credits ?? []) {
      treeIds.add(credit.treeId)
    }
  }
  const trees = [...treeIds].flatMap((id) => {
    const tree = treesBySession.get(id)
    return tree ? [tree] : []
  })
  const completed = ordered.filter((record) => record.status === 'completed')
  const openEnded = plan?.openEnded === true
  const targetPomodoros = plan?.targetPomodoros ?? primaryRecord.pomoTotal ?? ordered.length
  const latestWithTitle = [...ordered]
    .reverse()
    .find((record) => (record.title ?? '').trim().length > 0)

  return {
    key,
    plan,
    records: ordered,
    trees,
    primaryRecord,
    primaryTree: trees[trees.length - 1] ?? treesBySession.get(primaryRecord.treeId) ?? null,
    title: plan?.title ?? latestWithTitle?.title ?? 'Pomodoro',
    description: plan?.description ?? primaryRecord.description ?? null,
    tasks: plan?.tasks.length ? plan.tasks : (primaryRecord.tasks ?? []),
    startedAt: Math.min(...ordered.map((record) => record.startedAt)),
    endedAt: Math.max(...ordered.map((record) => record.endedAt)),
    // Los pomodoros completados aportan su duración planeada y los abandonados
    // los minutos reales enfocados antes de marchitarse.
    totalDurationMin: ordered.reduce((total, record) => total + record.durationMin, 0),
    status: statusFor(ordered, plan),
    withered: trees.some((tree) => tree.state === 'withered'),
    completedPomodoros: completed.length,
    targetPomodoros,
    openEnded,
    // Las sesiones indefinidas son series aunque hayan tenido un solo bloque.
    isMulti: openEnded || targetPomodoros > 1 || ordered.length > 1 || trees.length > 1,
  }
}

/**
 * Agrupa los pomodoros de una misma sesión y aplica los filtros del historial.
 * Solo se consideran sesiones de enfoque; los descansos nunca se guardan.
 * Si hay un enfoque corriendo en el bosque, entra como sesión en curso.
 */
export function buildHistory(
  sessions: readonly FocusRecord[],
  plans: readonly SessionPlan[],
  trees: readonly Tree[],
  forestId: string | null,
  filter: HistoryFilter,
  now: number,
  active: ActiveSession | null = null,
): HistoryEntry[] {
  if (!forestId) {
    return []
  }

  const plansById = new Map(
    plans.filter((plan) => plan.forestId === forestId).map((plan) => [plan.id, plan]),
  )
  const treesBySession = new Map(
    trees.filter((tree) => tree.forestId === forestId).map((tree) => [tree.id, tree]),
  )
  const groups = new Map<string, FocusRecord[]>()

  const pushRecord = (record: FocusRecord) => {
    const key = record.planId ?? record.id
    const group = groups.get(key)
    if (group) {
      group.push(record)
    } else {
      groups.set(key, [record])
    }
  }

  for (const record of sessions) {
    if (record.forestId !== forestId) {
      continue
    }

    pushRecord(record)
  }

  // La sesión en curso se agrega al historial con los minutos reales enfocados
  // hasta ahora; si es una continuación de una serie, comparte su grupo.
  const runningFocus = active?.kind === 'focus' && active.forestId === forestId ? active : null
  if (runningFocus) {
    const runningPlan = runningFocus.planId ? plansById.get(runningFocus.planId) : undefined
    const runningProjection = runningPlan
      ? runningPlan.openEnded
        ? projectOpenPlanting(runningPlan, elapsedMs(runningFocus, now) / 60_000)
        : projectPlanting(runningPlan, livePlanFocus(runningPlan, elapsedMs(runningFocus, now)))
      : null
    const runningItem = runningProjection
      ? (runningProjection.current ?? runningProjection.items[runningProjection.items.length - 1])
      : null
    const runningSpecies = runningItem?.species ?? speciesForFocusMin(runningFocus.durationMin)
    const runningConfig = speciesConfig(runningSpecies)
    const runningTree = {
      id: runningFocus.treeId ?? runningFocus.id,
      forestId: runningFocus.forestId,
      sessionId: runningFocus.id,
      cell: runningItem?.cell ?? runningFocus.cell ?? { col: 0, row: 0 },
      kind: runningSpecies,
      stage:
        runningItem?.stage ??
        stageForElapsedMs(runningSpecies, elapsedMs(runningFocus, now), runningFocus.durationMin),
      state: runningItem && !runningItem.complete ? 'growing' : 'mature',
      requiredFocusMin: runningItem?.requiredMin ?? runningConfig.minutes,
      accumulatedFocusMin: runningItem?.creditedMin ?? elapsedMs(runningFocus, now) / 60_000,
      planId: runningFocus.planId ?? null,
      createdAt: runningFocus.startedAt,
    } as Tree
    treesBySession.set(runningTree.id, runningTree)
    pushRecord({
      id: runningFocus.id,
      forestId: runningFocus.forestId ?? forestId,
      startedAt: runningFocus.startedAt,
      endedAt: now,
      durationMin: Math.max(1, Math.round(elapsedMs(runningFocus, now) / 60_000)),
      status: 'running',
      treeId: runningTree.id,
      title: runningFocus.title ?? null,
      description: runningFocus.description ?? null,
      tasks: runningFocus.tasks ? runningFocus.tasks.map((task) => ({ ...task })) : [],
      planId: runningFocus.planId ?? null,
      pomoIndex: runningFocus.pomoIndex,
      pomoTotal: runningFocus.pomoTotal,
    })
  }

  const entries = [...groups.entries()]
    .map(([key, records]) => buildEntry(key, plansById.get(key) ?? null, records, treesBySession))
    .sort(
      (a, b) => b.endedAt - a.endedAt || b.startedAt - a.startedAt || a.key.localeCompare(b.key),
    )

  const weekStart = startOfLocalWeek(now)
  const todayKey = localDayKey(now)

  return entries.filter((entry) => {
    switch (filter) {
      case 'today':
        return entry.records.some((record) => localDayKey(record.endedAt) === todayKey)
      case 'week':
        return entry.records.some((record) => record.endedAt >= weekStart)
      case 'multi':
        return entry.isMulti
      case 'withered':
        return entry.withered
      case 'all':
      default:
        return true
    }
  })
}

/** Sesiones que hay que resaltar al seleccionar una entrada del historial. */
export function selectedSessionIds(entry: HistoryEntry | null): ReadonlySet<string> {
  return new Set(entry ? entry.records.map((record) => record.id) : [])
}
