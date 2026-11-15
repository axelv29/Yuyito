import { beforeEach, describe, expect, it } from 'vitest'
import { livePlanFocus, projectPlanting } from '@/logic/planting'
import { elapsedMs } from '@/logic/timer'
import { emptyState } from '@/state/persist'
import { useStore } from '@/state/store'
import type { NewSessionInput, TreeStage } from '@/state/types'

const START = Date.UTC(2026, 0, 1, 9, 0, 0)

function session(planting: NewSessionInput['planting']): NewSessionInput {
  return {
    title: 'Sesión de prueba',
    description: null,
    tasks: [],
    focusMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    targetPomodoros: 3,
    mode: 'breaks',
    planting,
  }
}

function finishCurrentBlock() {
  const active = useStore.getState().active
  expect(active).not.toBeNull()
  useStore.getState().reconcile(active!.endsAt)
}

beforeEach(() => {
  useStore.setState({
    ...emptyState(),
    pendingBreak: false,
    notice: null,
  })
})

describe('store: cola de árboles', () => {
  it('completa tres pinos en tres bloques y cierra la sesión', () => {
    useStore.getState().startSession(session(['pino', 'pino', 'pino']), START)

    expect(useStore.getState().active?.pomoIndex).toBe(1)
    expect(useStore.getState().trees).toHaveLength(1)

    finishCurrentBlock()
    expect(useStore.getState().pendingBreak).toBe(true)
    expect(useStore.getState().trees[0].state).toBe('mature')
    expect(useStore.getState().plans[0].completedPomodoros).toBe(1)

    useStore.getState().continuePlan(START + 30 * 60_000)
    finishCurrentBlock()
    expect(useStore.getState().trees).toHaveLength(2)

    useStore.getState().continuePlan(START + 60 * 60_000)
    finishCurrentBlock()

    const state = useStore.getState()
    expect(state.active).toBeNull()
    expect(state.pendingBreak).toBe(false)
    expect(state.activePlanId).toBeNull()
    expect(state.trees).toHaveLength(3)
    expect(state.trees.every((tree) => tree.state === 'mature')).toBe(true)
    expect(state.plans[0].completedPomodoros).toBe(3)
    expect(state.plans[0].finishedAt).not.toBeNull()
  })

  it('deja un ceibo en crecimiento cuando el presupuesto no alcanza', () => {
    useStore.getState().startSession(session(['ceibo']), START)

    finishCurrentBlock()
    useStore.getState().continuePlan(START + 30 * 60_000)
    finishCurrentBlock()
    useStore.getState().continuePlan(START + 60 * 60_000)
    finishCurrentBlock()

    const state = useStore.getState()
    const tree = state.trees[0]

    expect(state.active).toBeNull()
    expect(state.activePlanId).toBeNull()
    expect(tree.state).toBe('growing')
    expect(tree.accumulatedFocusMin).toBe(75)
    expect(tree.requiredFocusMin).toBe(90)
    expect(tree.stage).toBe(6)
  })

  it('marchita el árbol actual al abandonar y conserva los completos', () => {
    useStore.getState().startSession(session(['pino', 'pino', 'pino']), START)

    finishCurrentBlock()
    useStore.getState().continuePlan(START + 30 * 60_000)
    useStore.getState().abandon(START + 31 * 60_000)

    const state = useStore.getState()

    expect(state.active).toBeNull()
    expect(state.activePlanId).toBeNull()
    expect(state.trees).toHaveLength(2)
    expect(state.trees[0].state).toBe('mature')
    expect(state.trees[1].state).toBe('withered')
    expect(state.plans[0].finishedAt).not.toBeNull()
  })

  it('deja sobrar tiempo y marchita el último árbol si se abandona', () => {
    // 25×3 = 75 min, dos pinos = 50: sobran 25 min sin plantar.
    useStore.getState().startSession(session(['pino', 'pino']), START)

    finishCurrentBlock()
    useStore.getState().continuePlan(START + 30 * 60_000)
    finishCurrentBlock()

    // Con la cola completa el plan sigue abierto hasta el último bloque.
    const mid = useStore.getState()
    expect(mid.active).toBeNull()
    expect(mid.pendingBreak).toBe(true)
    expect(mid.plans[0].finishedAt).toBeNull()
    expect(mid.trees.every((tree) => tree.state === 'mature')).toBe(true)

    useStore.getState().continuePlan(START + 60 * 60_000)
    expect(useStore.getState().active?.pomoIndex).toBe(3)

    // Si se va antes de terminar el tiempo, el último árbol se marchita.
    useStore.getState().abandon(START + 61 * 60_000)

    const state = useStore.getState()
    expect(state.active).toBeNull()
    expect(state.activePlanId).toBeNull()
    expect(state.trees).toHaveLength(2)
    expect(state.trees[0].state).toBe('mature')
    expect(state.trees[1].state).toBe('withered')
    expect(state.plans[0].finishedAt).not.toBeNull()
  })

  it('le pone un nombre por defecto a la sesión cuando no tiene título', () => {
    useStore.getState().startSession({ ...session(['pino']), title: '' }, START)

    expect(useStore.getState().plans[0].title).toBe('Sesión 1')
    expect(useStore.getState().active?.title).toBe('Sesión 1')
  })

  it('permite renombrar la sesión desde la tarjeta activa o del historial', () => {
    useStore.getState().startSession(session(['pino']), START)
    const planId = useStore.getState().plans[0].id

    useStore.getState().renamePlanTitle(planId, '  Repaso del TP  ')

    expect(useStore.getState().plans[0].title).toBe('Repaso del TP')
    expect(useStore.getState().active?.title).toBe('Repaso del TP')
  })
})

describe('store: etapa visible del árbol activo', () => {
  /** Misma proyección que usa App para el preview del árbol que crece. */
  function previewStage(now: number): TreeStage | null {
    const state = useStore.getState()
    const active = state.active
    if (active?.kind !== 'focus') {
      return null
    }

    const plan = state.plans.find((item) => item.id === active.planId)
    if (!plan) {
      return null
    }

    const projection = projectPlanting(plan, livePlanFocus(plan, elapsedMs(active, now)))
    const item = projection.current ?? projection.items[projection.items.length - 1]

    return item?.stage ?? null
  }

  it('avanza por las etapas del pino a medida que corre el bloque', () => {
    useStore.getState().startSession(
      {
        ...session(['pino']),
        focusMin: 25,
        targetPomodoros: 1,
      },
      START,
    )

    const stages = [0, 5, 10, 15, 20].map((minute) =>
      previewStage(START + minute * 60_000),
    )

    expect(stages).toEqual([1, 2, 2, 3, 3])
    // El árbol del store sigue en la etapa con la que nació: el preview es
    // quien trae la etapa viva, y por eso drawGarden la fusiona al dibujar.
    expect(useStore.getState().trees[0].stage).toBe(1)
  })
})
