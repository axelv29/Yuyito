import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  FOREST_DESCRIPTION_MAX_LENGTH,
  FOREST_GOAL_HOURS_MAX,
  FOREST_NAME_MAX_LENGTH,
} from '@/config/forest'
import { finalStage, speciesConfig, speciesForFocusMin } from '@/config/species'
import { DEFAULT_GARDEN_SIZE } from '@/config/grid'
import {
  SESSION_DESCRIPTION_MAX_LENGTH,
  SESSION_MAX_BREAK_MIN,
  SESSION_MAX_FOCUS_MIN,
  SESSION_MAX_LONG_BREAK_MIN,
  SESSION_MAX_POMODOROS,
  SESSION_MAX_TASKS,
  SESSION_MAX_TREES,
  SESSION_MIN_BREAK_MIN,
  SESSION_MIN_FOCUS_MIN,
  SESSION_MIN_LONG_BREAK_MIN,
  SESSION_TASK_MAX_LENGTH,
  SESSION_TITLE_MAX_LENGTH,
} from '@/config/session'
import { stageForElapsedMs } from '@/logic/growth'
import { choosePlacement } from '@/logic/placement'
import { defaultSessionName, nextTaskStatus } from '@/logic/session'
import {
  projectPlanting,
  suggestPlanting,
  validatePlanting,
  type PlantingProjection,
} from '@/logic/planting'
import {
  createBreakSession,
  createFocusSession,
  elapsedMs,
  isExpired,
  pauseSession,
  resumeSession,
} from '@/logic/timer'
import type {
  ActiveSession,
  Cell,
  DisplaySettings,
  FocusRecord,
  Forest,
  NewForestInput,
  NewSessionInput,
  PersistedV7,
  PlantingItem,
  PomodoroSettings,
  SessionPlan,
  SessionTask,
  Tree,
  TreeSpecies,
} from './types'
import { DEFAULT_DISPLAY_SETTINGS, DEFAULT_POMODORO_SETTINGS } from './types'
import {
  createDefaultForest,
  migrate,
  PERSIST_VERSION,
  persistStorage,
  STORAGE_KEY,
} from './persist'

export type NoticeKind = 'info' | 'success' | 'warning'

export interface Notice {
  kind: NoticeKind
  text: string
}

interface StoreState extends PersistedV7 {
  pendingBreak: boolean
  notice: Notice | null
  /** Dev: tamaño del bosque en celdas por lado para el preview del panel. */
  devGardenSize: number
  /** Dev: corre la racha diaria N días para probar el cambio de día. */
  devDayOffset: number
  createForest: (input: NewForestInput, now: number) => string | null
  selectForest: (id: string) => void
  updateForest: (id: string, input: NewForestInput) => void
  archiveForest: (id: string, now: number) => void
  unarchiveForest: (id: string) => void
  deleteForest: (id: string) => void
  updateDisplay: (patch: Partial<DisplaySettings>) => void
  /** Avanza un objetivo: neutral → completado → no completado. */
  cycleTaskStatus: (entryKey: string, taskId: string) => void
  /** Crea una sesión planificada y empieza su primer pomodoro. */
  startSession: (input: NewSessionInput, now: number) => void
  /** Renombra una sesión planificada (tarjeta activa o del historial). */
  renamePlanTitle: (planId: string, title: string) => void
  /** Continúa la sesión pendiente con el siguiente pomodoro. */
  continuePlan: (now: number) => void
  /** Cierra una sesión pendiente sin empezar otro pomodoro. */
  cancelPlan: (now: number) => void
  startFocus: (now: number) => void
  startBreak: (now: number) => void
  pause: (now: number) => void
  resume: (now: number) => void
  abandon: (now: number) => void
  skipBreak: () => void
  reconcile: (now: number) => void
  dismissNotice: () => void
  dismissBreak: () => void
  updateSettings: (patch: Partial<PomodoroSettings>) => void
  /** Marca el día local en que se mostró la card de racha (una vez por día). */
  markStreakIntroShown: (dayKey: string) => void
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function treeFromProjection(
  forestId: string,
  sessionId: string,
  planId: string,
  item: PlantingProjection['items'][number],
  now: number,
): Tree {
  return {
    id: makeId(),
    forestId,
    sessionId,
    cell: item.cell,
    kind: item.species,
    stage: item.stage,
    state: item.complete ? 'mature' : 'growing',
    requiredFocusMin: item.requiredMin,
    accumulatedFocusMin: item.creditedMin,
    planId,
    createdAt: now,
  }
}

/**
 * Crea o actualiza los árboles de una proyección. Los árboles completos pasan
 * a maduros; los parciales quedan en crecimiento. Devuelve también la cola con
 * los ids ya enlazados.
 */
function applyProjection(
  trees: readonly Tree[],
  plan: SessionPlan,
  projection: PlantingProjection,
  now: number,
  sessionId: string,
): { trees: Tree[]; planting: PlantingItem[] } {
  const next = [...trees]
  const indexById = new Map(next.map((tree, index) => [tree.id, index]))

  const planting = plan.planting.map((item, index) => {
    const projected = projection.items[index]
    if (!projected) {
      return item
    }

    let treeId = projected.treeId
    if (treeId && !indexById.has(treeId)) {
      treeId = null
    }

    if (!treeId && projected.creditedMin > 0) {
      const tree = treeFromProjection(plan.forestId, sessionId, plan.id, projected, now)
      next.push(tree)
      indexById.set(tree.id, next.length - 1)
      treeId = tree.id
    }

    if (treeId) {
      const treeIndex = indexById.get(treeId)
      if (treeIndex !== undefined) {
        const existing = next[treeIndex]
        next[treeIndex] = {
          ...existing,
          kind: projected.species,
          stage: projected.stage,
          state: projected.complete ? 'mature' : 'growing',
          requiredFocusMin: projected.requiredMin,
          accumulatedFocusMin: projected.creditedMin,
          planId: plan.id,
        }
      }
    }

    return { ...item, treeId }
  })

  return { trees: next, planting }
}

function reservePlantingCells(
  forestId: string,
  forestSize: number,
  trees: readonly Tree[],
  species: readonly TreeSpecies[],
  now: number,
): { cells: Cell[]; replacedTreeIds: string[] } | null {
  const virtual = trees.filter((tree) => tree.forestId === forestId).map((tree) => ({ ...tree }))
  const cells: Cell[] = []
  const replacedTreeIds: string[] = []

  for (let index = 0; index < species.length; index += 1) {
    const placement = choosePlacement(virtual, Math.random, forestSize, forestSize)
    if (!placement) {
      return null
    }

    if (placement.replacedTreeId) {
      replacedTreeIds.push(placement.replacedTreeId)
      const index = virtual.findIndex((tree) => tree.id === placement.replacedTreeId)
      if (index >= 0) {
        virtual.splice(index, 1)
      }
    }

    cells.push(placement.cell)
    virtual.push({
      id: `reserved-${cells.length}`,
      forestId,
      sessionId: 'reserved',
      cell: placement.cell,
      stage: 1,
      state: 'mature',
      requiredFocusMin: 25,
      accumulatedFocusMin: 25,
      createdAt: now,
    })
  }

  return { cells, replacedTreeIds }
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      /**
       * Empieza un pomodoro de una sesión planificada. La celda se elige con
       * el mismo criterio que cualquier otro pomodoro: sin adyacencia forzada.
       */
      const startPlanPomodoro = (plan: SessionPlan, now: number): boolean => {
        const state = get()
        const forest = state.forests.find((item) => item.id === plan.forestId)
        if (!forest || forest.archivedAt !== null) {
          set({
            activePlanId: null,
            plans: state.plans.map((item) =>
              item.id === plan.id ? { ...item, finishedAt: now } : item,
            ),
            notice: {
              kind: 'warning',
              text: 'El bosque de esa sesión ya no está disponible.',
            },
          })
          return false
        }

        const projection = projectPlanting(plan, plan.focusElapsedMin)
        // Con tiempo sobrante la cola ya está completa: el bloque corre sobre
        // el último árbol plantado, sin acreditar minutos nuevos.
        const current =
          projection.current ?? [...projection.items].reverse().find((item) => item.treeId) ?? null
        if (!current) {
          set({
            activePlanId: null,
            plans: state.plans.map((item) =>
              item.id === plan.id ? { ...item, finishedAt: now } : item,
            ),
            notice: {
              kind: 'success',
              text: `Sesión completada: ${plan.title}.`,
            },
          })
          return false
        }

        const sessionId = makeId()
        const trees = [...state.trees]
        const planting = [...plan.planting]
        let treeId = current.treeId

        if (!treeId || !trees.some((tree) => tree.id === treeId)) {
          const tree = treeFromProjection(
            plan.forestId,
            sessionId,
            plan.id,
            { ...current, complete: false },
            now,
          )
          trees.push(tree)
          treeId = tree.id
          planting[current.index] = { ...planting[current.index], treeId }
        }

        const session = createFocusSession(sessionId, now, current.cell, plan.focusMin, forest.id)
        const activeSession: ActiveSession = {
          ...session,
          // Los planes viejos sin pausa estricta propia siguen los ajustes.
          strictPause: plan.strictPause ?? state.settings.strictPause,
          pauseToleranceMin: state.settings.pauseToleranceMin,
          planId: plan.id,
          pomoIndex: plan.completedPomodoros + 1,
          pomoTotal: plan.targetPomodoros,
          mode: plan.mode,
          treeId,
          title: plan.title,
          description: plan.description,
          tasks: plan.tasks.map((task) => ({ ...task })),
        }

        set({
          trees,
          plans: state.plans.map((item) => (item.id === plan.id ? { ...item, planting } : item)),
          active: activeSession,
          activeForestId: forest.id,
          activePlanId: plan.id,
          pendingBreak: false,
          notice: null,
        })
        return true
      }

      const completeFocus = (active: ActiveSession, now: number) => {
        if (!active.cell || !active.forestId) {
          set({
            active: null,
            pendingBreak: false,
            notice: {
              kind: 'warning',
              text: 'La sesión no tenía una celda o un bosque. Se cerró sin plantar.',
            },
          })
          return
        }

        // Si la pestaña estuvo cerrada, la sesión terminó en `endsAt`,
        // no cuando se reabrió: así cae en el día correcto.
        const endedAt = Math.min(now, active.endsAt)
        const state = get()
        const plan = active.planId
          ? state.plans.find((item) => item.id === active.planId)
          : undefined

        if (!plan) {
          const species = speciesForFocusMin(active.durationMin)
          const requiredFocusMin = speciesConfig(species).minutes
          const tree: Tree = {
            id: makeId(),
            forestId: active.forestId,
            sessionId: active.id,
            cell: active.cell,
            kind: species,
            stage: finalStage(species),
            state: 'mature',
            requiredFocusMin,
            accumulatedFocusMin: requiredFocusMin,
            planId: null,
            createdAt: endedAt,
          }
          const record: FocusRecord = {
            id: active.id,
            forestId: active.forestId,
            startedAt: active.startedAt,
            endedAt,
            durationMin: active.durationMin,
            status: 'completed',
            treeId: tree.id,
            title: active.title ?? null,
            description: active.description ?? null,
            tasks: active.tasks ? active.tasks.map((task) => ({ ...task })) : [],
            planId: null,
            pomoIndex: active.pomoIndex,
            pomoTotal: active.pomoTotal,
            credits: [{ treeId: tree.id, minutes: requiredFocusMin }],
          }

          set((currentState) => ({
            trees: [...currentState.trees, tree],
            sessions: [...currentState.sessions, record],
            active: null,
            pendingBreak: true,
            notice: {
              kind: 'success',
              text: '¡Pomodoro completado! El árbol quedó en la pradera.',
            },
          }))
          return
        }

        const focusMin = active.durationMin
        const before = projectPlanting(plan, plan.focusElapsedMin)
        const focusElapsedMin = plan.focusElapsedMin + focusMin
        const after = projectPlanting(plan, focusElapsedMin)
        const { trees, planting } = applyProjection(state.trees, plan, after, endedAt, active.id)
        const completedPomodoros = Math.min(plan.targetPomodoros, plan.completedPomodoros + 1)
        // El plan corre hasta el último bloque aunque la cola ya esté completa
        // (tiempo sobrante): así el usuario puede terminar el tiempo y, si se
        // va antes, el último árbol plantado se marchita.
        const planFinished = completedPomodoros >= plan.targetPomodoros
        const credits = after.items.flatMap((item, index) => {
          const previous = before.items[index]?.creditedMin ?? 0
          const minutes = item.creditedMin - previous
          const treeId = planting[index]?.treeId
          return minutes > 0 && treeId ? [{ treeId, minutes }] : []
        })
        const treeId = credits[0]?.treeId ?? active.treeId ?? ''

        const record: FocusRecord = {
          id: active.id,
          forestId: active.forestId,
          startedAt: active.startedAt,
          endedAt,
          durationMin: focusMin,
          status: 'completed',
          treeId,
          title: active.title ?? null,
          description: active.description ?? null,
          tasks: active.tasks ? [...active.tasks] : [],
          planId: plan.id,
          pomoIndex: active.pomoIndex,
          pomoTotal: active.pomoTotal,
          credits,
        }
        const updatedPlan: SessionPlan = {
          ...plan,
          planting,
          focusElapsedMin,
          completedPomodoros,
          finishedAt: planFinished ? endedAt : null,
        }

        set({
          trees,
          sessions: [...state.sessions, record],
          plans: state.plans.map((item) => (item.id === plan.id ? updatedPlan : item)),
          activePlanId: planFinished ? null : plan.id,
          active: null,
          pendingBreak: plan.mode === 'breaks' && !planFinished,
          notice: planFinished
            ? {
                kind: 'success',
                text: `Sesión completada: ${plan.title}.`,
              }
            : after.currentIndex === null
              ? {
                  kind: 'success',
                  text: `Bloque ${completedPomodoros} de ${plan.targetPomodoros}. Los árboles ya están listos: queda terminar el tiempo.`,
                }
              : {
                  kind: 'success',
                  text: `Bloque ${completedPomodoros} de ${plan.targetPomodoros} completado. El árbol sigue creciendo.`,
                },
        })
      }

      const initialForest = createDefaultForest()

      return {
        version: PERSIST_VERSION,
        forests: [initialForest],
        activeForestId: initialForest.id,
        trees: [],
        sessions: [],
        plans: [],
        active: null,
        activePlanId: null,
        settings: { ...DEFAULT_POMODORO_SETTINGS },
        display: { ...DEFAULT_DISPLAY_SETTINGS },
        streakIntroShownOn: null,
        pendingBreak: false,
        notice: null,
        devGardenSize: DEFAULT_GARDEN_SIZE,
        devDayOffset: 0,

        createForest: (input, now) => {
          const name = input.name.trim().slice(0, FOREST_NAME_MAX_LENGTH)
          if (!name) {
            return null
          }

          const description =
            input.description?.trim().slice(0, FOREST_DESCRIPTION_MAX_LENGTH) || null
          const goalHours =
            typeof input.goalHours === 'number' && input.goalHours > 0
              ? Math.min(Math.round(input.goalHours), FOREST_GOAL_HOURS_MAX)
              : null
          const forest: Forest = {
            id: makeId(),
            name,
            description,
            size: input.size,
            createdAt: now,
            endsOn: input.endsOn,
            goalHours,
            archivedAt: null,
          }

          set((state) => ({
            forests: [...state.forests, forest],
            // Durante una sesión no se cambia de bosque.
            activeForestId: state.active ? state.activeForestId : forest.id,
            notice: {
              kind: 'success',
              text: 'Bosque creado. Ya podés empezar a plantar.',
            },
          }))

          return forest.id
        },

        updateForest: (id, input) => {
          const name = input.name.trim().slice(0, FOREST_NAME_MAX_LENGTH)
          if (!name) {
            return
          }

          const description =
            input.description?.trim().slice(0, FOREST_DESCRIPTION_MAX_LENGTH) || null
          const goalHours =
            typeof input.goalHours === 'number' && input.goalHours > 0
              ? Math.min(Math.round(input.goalHours), FOREST_GOAL_HOURS_MAX)
              : null

          set((state) => ({
            forests: state.forests.map((forest) =>
              forest.id === id
                ? {
                    ...forest,
                    name,
                    description,
                    // El tamaño se define al crear el bosque y no se puede cambiar.
                    size: forest.size,
                    endsOn: input.endsOn,
                    goalHours,
                  }
                : forest,
            ),
          }))
        },

        archiveForest: (id, now) => {
          set((state) => {
            const forests = state.forests.map((forest) =>
              forest.id === id ? { ...forest, archivedAt: now } : forest,
            )
            const fallback =
              forests.find((forest) => forest.id !== id && forest.archivedAt === null)?.id ?? null

            return {
              forests,
              // Si el bosque archivado era el activo, pasamos al primero disponible.
              activeForestId: state.activeForestId === id ? fallback : state.activeForestId,
            }
          })
        },

        unarchiveForest: (id) => {
          set((state) => {
            const forests = state.forests.map((forest) =>
              forest.id === id ? { ...forest, archivedAt: null } : forest,
            )
            const hasActive =
              state.activeForestId !== null &&
              forests.some(
                (forest) => forest.id === state.activeForestId && forest.archivedAt === null,
              )

            return {
              forests,
              activeForestId: hasActive ? state.activeForestId : id,
            }
          })
        },

        deleteForest: (id) => {
          set((state) => {
            const forests = state.forests.filter((forest) => forest.id !== id)
            const fallback =
              forests.find((forest) => forest.archivedAt === null)?.id ?? forests[0]?.id ?? null

            const removedPlanIds = new Set(
              state.plans.filter((plan) => plan.forestId === id).map((plan) => plan.id),
            )

            return {
              forests,
              trees: state.trees.filter((tree) => tree.forestId !== id),
              sessions: state.sessions.filter((session) => session.forestId !== id),
              plans: state.plans.filter((plan) => plan.forestId !== id),
              active: state.active && state.active.forestId === id ? null : state.active,
              activePlanId:
                state.activePlanId && removedPlanIds.has(state.activePlanId)
                  ? null
                  : state.activePlanId,
              activeForestId: state.activeForestId === id ? fallback : state.activeForestId,
            }
          })
        },

        selectForest: (id) => {
          if (get().active) {
            return
          }
          if (!get().forests.some((forest) => forest.id === id)) {
            return
          }

          set({ activeForestId: id, notice: null })
        },

        updateDisplay: (patch) => set((state) => ({ display: { ...state.display, ...patch } })),

        cycleTaskStatus: (entryKey, taskId) => {
          const cycle = (tasks: SessionTask[]): SessionTask[] =>
            tasks.map((task) =>
              task.id === taskId ? { ...task, status: nextTaskStatus(task.status) } : task,
            )

          set((state) => {
            const plan = state.plans.find((item) => item.id === entryKey)
            if (plan) {
              return {
                plans: state.plans.map((item) =>
                  item.id === plan.id ? { ...item, tasks: cycle(item.tasks) } : item,
                ),
                active:
                  state.active?.planId === plan.id && state.active.tasks
                    ? { ...state.active, tasks: cycle(state.active.tasks) }
                    : state.active,
              }
            }

            if (state.active?.id === entryKey && state.active.tasks) {
              return { active: { ...state.active, tasks: cycle(state.active.tasks) } }
            }

            return {
              sessions: state.sessions.map((record) =>
                record.id === entryKey && record.tasks
                  ? { ...record, tasks: cycle(record.tasks) }
                  : record,
              ),
            }
          })
        },

        startSession: (input, now) => {
          if (get().active) {
            return
          }

          const state = get()
          const forest = state.forests.find((item) => item.id === state.activeForestId)
          if (!forest) {
            set({
              notice: {
                kind: 'info',
                text: 'Primero creá un bosque para empezar a plantar.',
              },
            })
            return
          }
          if (forest.archivedAt !== null) {
            set({
              notice: {
                kind: 'warning',
                text: 'Ese bosque está archivado. Elegí otro para empezar.',
              },
            })
            return
          }

          const title =
            (input.title ?? '').trim().slice(0, SESSION_TITLE_MAX_LENGTH) ||
            defaultSessionName(state.sessions, now)
          const description =
            input.description?.trim().slice(0, SESSION_DESCRIPTION_MAX_LENGTH) || null
          const tasks: SessionTask[] = input.tasks
            .map((task) => task.trim().slice(0, SESSION_TASK_MAX_LENGTH))
            .filter((task) => task.length > 0)
            .slice(0, SESSION_MAX_TASKS)
            .map((text) => ({ id: makeId(), text, status: 'neutral' }))
          const mode = input.mode === 'continuous' ? 'continuous' : 'breaks'
          const focusMin = clamp(
            Number.isFinite(input.focusMin) ? input.focusMin : state.settings.focusMin,
            SESSION_MIN_FOCUS_MIN,
            SESSION_MAX_FOCUS_MIN,
          )
          const breakMin = clamp(
            Number.isFinite(input.breakMin) ? input.breakMin : state.settings.breakMin,
            SESSION_MIN_BREAK_MIN,
            SESSION_MAX_BREAK_MIN,
          )
          const longBreakMin = clamp(
            Number.isFinite(input.longBreakMin) ? input.longBreakMin : state.settings.longBreakMin,
            SESSION_MIN_LONG_BREAK_MIN,
            SESSION_MAX_LONG_BREAK_MIN,
          )
          // `0` desactiva la pausa larga; cualquier otro valor es cada cuántos bloques.
          const longBreakEvery = clamp(
            Number.isFinite(input.longBreakEvery) ? (input.longBreakEvery as number) : 0,
            0,
            SESSION_MAX_POMODOROS,
          )
          // La pausa estricta nace de los ajustes salvo que la sesión la defina.
          const strictPause =
            typeof input.strictPause === 'boolean' ? input.strictPause : state.settings.strictPause
          const targetPomodoros =
            mode === 'continuous' ? 1 : clamp(input.targetPomodoros, 1, SESSION_MAX_POMODOROS)
          const plantingSpecies = input.planting.slice(0, SESSION_MAX_TREES)
          const validation = validatePlanting({
            focusMin,
            targetPomodoros,
            planting: plantingSpecies,
          })

          if (!validation.ok) {
            set({
              notice: {
                kind: 'warning',
                text: validation.errors[0] ?? 'La sesión no es válida.',
              },
            })
            return
          }

          const reservation = reservePlantingCells(
            forest.id,
            forest.size,
            state.trees,
            plantingSpecies,
            now,
          )
          if (!reservation) {
            set({
              notice: {
                kind: 'warning',
                text: 'La pradera está llena. Las parcelas nuevas llegan en la próxima versión.',
              },
            })
            return
          }

          const replaced = new Set(reservation.replacedTreeIds)
          const trees = state.trees.filter((tree) => !replaced.has(tree.id))
          const sessions = state.sessions.filter(
            (session) =>
              !replaced.has(session.treeId) &&
              !(session.credits ?? []).some((credit) => replaced.has(credit.treeId)),
          )
          const planting: PlantingItem[] = plantingSpecies.map((species, index) => ({
            species,
            cell: reservation.cells[index],
            treeId: null,
          }))
          const plan: SessionPlan = {
            id: makeId(),
            forestId: forest.id,
            title,
            description,
            tasks,
            focusMin,
            breakMin,
            longBreakMin,
            longBreakEvery,
            strictPause,
            targetPomodoros,
            completedPomodoros: 0,
            mode,
            planting,
            focusElapsedMin: 0,
            createdAt: now,
            finishedAt: null,
          }
          // Una sesión nueva reemplaza a la que haya quedado pendiente.
          const plans = state.plans.map((item) =>
            item.id === state.activePlanId && item.finishedAt === null
              ? { ...item, finishedAt: now }
              : item,
          )

          set({
            trees,
            sessions,
            plans: [...plans, plan],
            activePlanId: plan.id,
            notice: null,
          })
          startPlanPomodoro(plan, now)
        },

        continuePlan: (now) => {
          if (get().active) {
            return
          }

          const state = get()
          const plan = state.plans.find(
            (item) => item.id === state.activePlanId && item.finishedAt === null,
          )
          if (!plan) {
            set({ activePlanId: null })
            return
          }

          startPlanPomodoro(plan, now)
        },

        cancelPlan: (now) => {
          if (get().active) {
            return
          }

          const state = get()
          const planId = state.activePlanId
          if (!planId) {
            return
          }

          set({
            plans: state.plans.map((plan) =>
              plan.id === planId && plan.finishedAt === null ? { ...plan, finishedAt: now } : plan,
            ),
            activePlanId: null,
            notice: { kind: 'info', text: 'La sesión pendiente se cerró.' },
          })
        },

        renamePlanTitle: (planId, title) => {
          const nextTitle = title.trim().slice(0, SESSION_TITLE_MAX_LENGTH)
          set((state) => ({
            plans: state.plans.map((plan) =>
              plan.id === planId ? { ...plan, title: nextTitle || plan.title } : plan,
            ),
            ...(state.active?.planId === planId
              ? {
                  active: state.active
                    ? { ...state.active, title: nextTitle || state.active.title }
                    : state.active,
                }
              : {}),
          }))
        },

        /** Compatibilidad con el auto-inicio: retoma la sesión o empieza una simple. */
        startFocus: (now) => {
          if (get().active) {
            return
          }

          const state = get()
          const openPlan = state.plans.find(
            (plan) => plan.id === state.activePlanId && plan.finishedAt === null,
          )
          if (openPlan) {
            startPlanPomodoro(openPlan, now)
            return
          }

          const focusMin = state.settings.focusMin
          get().startSession(
            {
              title: 'Pomodoro',
              description: null,
              tasks: [],
              focusMin,
              breakMin: state.settings.breakMin,
              longBreakMin: state.settings.longBreakMin,
              targetPomodoros: 1,
              mode: 'continuous',
              planting: suggestPlanting(focusMin, 1),
            },
            now,
          )
        },

        startBreak: (now) => {
          if (get().active) {
            return
          }

          const state = get()
          const plan = state.plans.find(
            (item) => item.id === state.activePlanId && item.finishedAt === null,
          )
          const settings = state.settings
          const completed = state.sessions.filter((s) => s.status === 'completed').length
          // Los planes viejos sin pausa larga declarada siguen usando los ajustes.
          const every = plan?.longBreakEvery ?? settings.longBreakEvery
          const planIsLong =
            plan !== undefined &&
            plan.longBreakMin !== undefined &&
            every > 0 &&
            plan.completedPomodoros > 0 &&
            plan.completedPomodoros % every === 0
          const isLong = plan
            ? planIsLong
            : completed > 0 && completed % settings.longBreakEvery === 0
          const breakMin = plan
            ? planIsLong
              ? (plan.longBreakMin ?? plan.breakMin)
              : plan.breakMin
            : isLong
              ? settings.longBreakMin
              : settings.breakMin
          const session = createBreakSession(makeId(), now, breakMin)

          set({ active: { ...session, longBreak: isLong }, pendingBreak: false, notice: null })
        },

        pause: (now) => {
          const active = get().active
          if (!active) {
            return
          }

          // Con pausa estricta la interfaz pide confirmación antes de
          // abandonar; nunca se pausa ni se marchita en silencio.
          if (active.strictPause) {
            return
          }

          const paused = pauseSession(active, now)
          if (paused !== active) {
            set({ active: paused })
          }
        },

        resume: (now) => {
          const active = get().active
          if (!active || active.pausedAt === null) {
            return
          }

          const toleranceMin = active.pauseToleranceMin ?? 0
          const toleranceMs = toleranceMin * 60_000
          const pausedFor = now - active.pausedAt
          if (toleranceMin > 0 && active.pausedMs + pausedFor > toleranceMs) {
            get().abandon(now)
            return
          }

          const resumed = resumeSession(active, now)
          if (resumed !== active) {
            set({ active: resumed })
          }
        },

        abandon: (now) => {
          const active = get().active
          if (!active) {
            return
          }

          if (active.kind === 'break') {
            set({
              active: null,
              pendingBreak: false,
              notice: { kind: 'info', text: 'Descanso saltado.' },
            })
            return
          }

          if (isExpired(active, now)) {
            get().reconcile(now)
            return
          }

          if (!active.cell || !active.forestId) {
            set({ active: null })
            return
          }

          const state = get()
          const plan = active.planId
            ? state.plans.find((item) => item.id === active.planId)
            : undefined

          if (plan) {
            const focusMs = elapsedMs(active, now)
            const elapsedMin = Math.max(0, Math.round(focusMs / 60_000))
            const before = projectPlanting(plan, plan.focusElapsedMin)
            const focusElapsedMin = plan.focusElapsedMin + elapsedMin
            const after = projectPlanting(plan, focusElapsedMin)
            const { trees, planting } = applyProjection(state.trees, plan, after, now, active.id)

            // El árbol que se está trabajando es el actual; si el bloque ya
            // terminó la cola, el último con minutos. Nunca se marchita un
            // árbol anterior que ya quedó completo.
            let targetIndex = after.currentIndex ?? -1
            if (targetIndex === -1) {
              for (let index = 0; index < after.items.length; index += 1) {
                if (after.items[index].creditedMin > 0) {
                  targetIndex = index
                }
              }
            }

            let targetTreeId =
              (targetIndex >= 0 ? planting[targetIndex]?.treeId : null) ?? active.treeId

            if (!targetTreeId && after.current) {
              const tree = treeFromProjection(plan.forestId, active.id, plan.id, after.current, now)
              trees.push(tree)
              targetTreeId = tree.id
              planting[after.current.index] = {
                ...planting[after.current.index],
                treeId: tree.id,
              }
            }

            if (targetTreeId) {
              const treeIndex = trees.findIndex((tree) => tree.id === targetTreeId)
              if (treeIndex >= 0) {
                const itemIndex = planting.findIndex((item) => item.treeId === targetTreeId)
                const item = itemIndex >= 0 ? after.items[itemIndex] : undefined
                trees[treeIndex] = {
                  ...trees[treeIndex],
                  state: 'withered',
                  stage: item?.stage ?? trees[treeIndex].stage,
                  accumulatedFocusMin: item?.creditedMin ?? trees[treeIndex].accumulatedFocusMin,
                }
              }
            }

            const credits = after.items.flatMap((item, index) => {
              const previous = before.items[index]?.creditedMin ?? 0
              const minutes = item.creditedMin - previous
              const treeId = planting[index]?.treeId
              return minutes > 0 && treeId ? [{ treeId, minutes }] : []
            })
            const record: FocusRecord = {
              id: active.id,
              forestId: active.forestId,
              startedAt: active.startedAt,
              endedAt: now,
              durationMin: Math.max(1, elapsedMin),
              status: 'abandoned',
              treeId: targetTreeId ?? active.treeId ?? '',
              title: active.title ?? null,
              description: active.description ?? null,
              tasks: active.tasks ? active.tasks.map((task) => ({ ...task })) : [],
              planId: plan.id,
              pomoIndex: active.pomoIndex,
              pomoTotal: active.pomoTotal,
              credits,
            }
            const updatedPlan: SessionPlan = {
              ...plan,
              planting,
              focusElapsedMin,
              finishedAt: now,
            }

            set({
              trees,
              sessions: [...state.sessions, record],
              plans: state.plans.map((item) => (item.id === plan.id ? updatedPlan : item)),
              activePlanId: null,
              active: null,
              pendingBreak: false,
              notice: {
                kind: 'info',
                text:
                  plan.mode === 'continuous'
                    ? 'La sesión continua se cerró y el último árbol quedó marchito.'
                    : 'El árbol quedó marchito. La sesión se cerró; podés empezar otra cuando quieras.',
              },
            })
            return
          }

          // Compatibilidad con sesiones viejas sin plan.
          const focusMs = elapsedMs(active, now)
          const elapsedMin = Math.max(1, Math.round(focusMs / 60_000))
          const species = speciesForFocusMin(active.durationMin)
          const requiredFocusMin = speciesConfig(species).minutes
          const stage = stageForElapsedMs(species, focusMs, active.durationMin)
          const tree: Tree = {
            id: makeId(),
            forestId: active.forestId,
            sessionId: active.id,
            cell: active.cell,
            kind: species,
            stage,
            state: 'withered',
            requiredFocusMin,
            accumulatedFocusMin: Math.min(requiredFocusMin, elapsedMin),
            planId: null,
            createdAt: now,
          }
          const record: FocusRecord = {
            id: active.id,
            forestId: active.forestId,
            startedAt: active.startedAt,
            endedAt: now,
            durationMin: elapsedMin,
            status: 'abandoned',
            treeId: tree.id,
            title: active.title ?? null,
            description: active.description ?? null,
            tasks: active.tasks ? active.tasks.map((task) => ({ ...task })) : [],
            planId: null,
            pomoIndex: active.pomoIndex,
            pomoTotal: active.pomoTotal,
            credits: [{ treeId: tree.id, minutes: elapsedMin }],
          }

          set((currentState) => ({
            trees: [...currentState.trees, tree],
            sessions: [...currentState.sessions, record],
            active: null,
            pendingBreak: false,
            notice: {
              kind: 'info',
              text: 'El árbol quedó marchito. La sesión se cerró; podés empezar otra cuando quieras.',
            },
          }))
        },

        skipBreak: () => {
          if (get().active?.kind === 'break') {
            set({
              active: null,
              pendingBreak: false,
              notice: { kind: 'info', text: 'Descanso saltado.' },
            })
            return
          }

          set({ pendingBreak: false })
        },

        reconcile: (now) => {
          const active = get().active
          if (!active) {
            return
          }

          // Tolerancia de pausa agotada mientras estaba pausado.
          if (active.pausedAt !== null) {
            const toleranceMin = active.pauseToleranceMin ?? 0
            const toleranceMs = toleranceMin * 60_000
            const pausedFor = now - active.pausedAt
            if (toleranceMin > 0 && active.pausedMs + pausedFor > toleranceMs) {
              get().abandon(now)
              return
            }
            return
          }

          if (!isExpired(active, now)) {
            return
          }

          if (active.kind === 'break') {
            set({
              active: null,
              pendingBreak: false,
              notice: {
                kind: 'info',
                text: 'Descanso terminado. Cuando quieras, otro pomodoro.',
              },
            })
            return
          }

          completeFocus(active, now)
        },

        dismissNotice: () => set({ notice: null }),
        dismissBreak: () => set({ pendingBreak: false }),
        updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
        markStreakIntroShown: (dayKey) =>
          set((state) => (state.streakIntroShownOn === dayKey ? state : { streakIntroShownOn: dayKey })),
      }
    },
    {
      name: STORAGE_KEY,
      version: PERSIST_VERSION,
      storage: persistStorage,
      migrate,
      partialize: (state) => ({
        version: state.version,
        forests: state.forests,
        activeForestId: state.activeForestId,
        trees: state.trees,
        sessions: state.sessions,
        plans: state.plans,
        active: state.active,
        activePlanId: state.activePlanId,
        settings: state.settings,
        display: state.display,
        streakIntroShownOn: state.streakIntroShownOn,
      }),
    },
  ),
)
