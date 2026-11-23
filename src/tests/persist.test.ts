import { describe, expect, it } from 'vitest'
import {
  createSafeStorage,
  DEFAULT_FOREST_ID,
  emptyState,
  isPersistedState,
  migrate,
} from '@/state/persist'
import type { StorageIssue } from '@/state/storageStatus'
import type {
  ActiveSession,
  FocusRecord,
  Forest,
  PersistedV9,
  SessionPlan,
  Tree,
} from '@/state/types'
import { DEFAULT_DISPLAY_SETTINGS, DEFAULT_POMODORO_SETTINGS } from '@/state/types'

const FOREST: Forest = {
  id: DEFAULT_FOREST_ID,
  name: 'Mi bosque',
  description: null,
  size: 8,
  createdAt: 0,
  endsOn: null,
  goalHours: null,
  archivedAt: null,
}

const TREE: Tree = {
  id: 'tree-1',
  sessionId: 'session-1',
  forestId: DEFAULT_FOREST_ID,
  cell: { col: 0, row: 0 },
  stage: 4,
  state: 'mature',
  requiredFocusMin: 25,
  accumulatedFocusMin: 25,
  createdAt: 1_000,
}

const SESSION: FocusRecord = {
  id: 'session-1',
  forestId: DEFAULT_FOREST_ID,
  startedAt: 0,
  endedAt: 1_500_000,
  durationMin: 25,
  status: 'completed',
  treeId: 'tree-1',
}

const ACTIVE: ActiveSession = {
  id: 'session-2',
  kind: 'focus',
  forestId: DEFAULT_FOREST_ID,
  startedAt: 2_000,
  endsAt: 1_502_000,
  durationMin: 25,
  pausedAt: null,
  pausedMs: 0,
  cell: { col: 1, row: 1 },
  planId: null,
  mode: 'breaks',
  treeId: 'tree-1',
}

const PLAN: SessionPlan = {
  id: 'plan-1',
  forestId: DEFAULT_FOREST_ID,
  title: 'Terminar el TP',
  description: null,
  tasks: [],
  focusMin: 25,
  breakMin: 5,
  targetPomodoros: 2,
  openEnded: false,
  completedPomodoros: 1,
  mode: 'breaks',
  planting: [
    { species: 'pino', cell: { col: 0, row: 0 }, treeId: 'tree-1' },
    { species: 'pino', cell: { col: 1, row: 1 }, treeId: null },
  ],
  focusElapsedMin: 25,
  createdAt: 0,
  finishedAt: null,
}

const STATE: PersistedV9 = {
  version: 9,
  forests: [FOREST],
  activeForestId: FOREST.id,
  trees: [TREE],
  sessions: [SESSION],
  plans: [PLAN],
  active: ACTIVE,
  activePlanId: PLAN.id,
  settings: { ...DEFAULT_POMODORO_SETTINGS },
  display: { ...DEFAULT_DISPLAY_SETTINGS },
  streakIntroShownOn: null,
}

const LEGACY_TREE = {
  id: 'tree-1',
  sessionId: 'session-1',
  cell: { col: 0, row: 0 },
  stage: 4,
  state: 'mature',
  createdAt: 1_000,
}

const LEGACY_SESSION = {
  id: 'session-1',
  startedAt: 0,
  endedAt: 1_500_000,
  durationMin: 25,
  status: 'completed',
  treeId: 'tree-1',
}

const LEGACY_ACTIVE = {
  id: 'session-2',
  kind: 'focus',
  startedAt: 2_000,
  endsAt: 1_502_000,
  durationMin: 25,
  pausedAt: null,
  pausedMs: 0,
  cell: { col: 1, row: 1 },
}

function envelope(state: unknown, version: unknown): string {
  return JSON.stringify({ state, version })
}

function makeStorage(): { storage: Storage; data: Map<string, string> } {
  const data = new Map<string, string>()
  const storage = {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }

  return { storage: storage as Storage, data }
}

describe('migrate', () => {
  it('devuelve un estado vacío si no hay datos', () => {
    expect(migrate(null, 1)).toEqual(emptyState())
    expect(migrate(undefined, 1)).toEqual(emptyState())
  })

  it('descarta datos con la forma equivocada', () => {
    expect(migrate({ trees: 'x', sessions: [{}], active: { kind: 'x' } }, 1)).toEqual(emptyState())
  })

  it('conserva lo válido y lo adjunta al bosque recuperado', () => {
    const result = migrate(
      {
        trees: [LEGACY_TREE, { nope: true }],
        sessions: [LEGACY_SESSION, null],
        active: LEGACY_ACTIVE,
      },
      1,
    )

    expect(result.forests).toHaveLength(1)
    expect(result.forests[0]).toMatchObject({
      id: DEFAULT_FOREST_ID,
      name: 'Mi bosque',
      size: 8,
    })
    expect(result.activeForestId).toBe(DEFAULT_FOREST_ID)
    expect(result.trees).toHaveLength(2)
    expect(result.trees[0]).toEqual({
      ...LEGACY_TREE,
      forestId: DEFAULT_FOREST_ID,
      requiredFocusMin: 25,
      accumulatedFocusMin: 25,
      planId: null,
    })
    expect(result.trees[1]).toMatchObject({
      id: 'migrated-active-session-2',
      state: 'growing',
      requiredFocusMin: 25,
      accumulatedFocusMin: 0,
    })
    expect(result.sessions).toEqual([{ ...LEGACY_SESSION, forestId: DEFAULT_FOREST_ID }])
    expect(result.active).toMatchObject({
      ...LEGACY_ACTIVE,
      forestId: DEFAULT_FOREST_ID,
      planId: null,
      treeId: 'migrated-active-session-2',
    })
  })

  it('no borra datos compatibles de una versión futura', () => {
    const result = migrate({ trees: [LEGACY_TREE], sessions: [LEGACY_SESSION], active: null }, 99)

    expect(result.trees).toEqual([
      {
        ...LEGACY_TREE,
        forestId: DEFAULT_FOREST_ID,
        requiredFocusMin: 25,
        accumulatedFocusMin: 25,
        planId: null,
      },
    ])
    expect(result.sessions).toEqual([{ ...LEGACY_SESSION, forestId: DEFAULT_FOREST_ID }])
  })

  it('descarta celdas fuera de la grilla', () => {
    const result = migrate(
      { trees: [{ ...LEGACY_TREE, cell: { col: 99, row: 0 } }], sessions: [], active: null },
      1,
    )

    expect(result.trees).toEqual([])
  })

  it('acepta un estado de la versión actual', () => {
    expect(migrate(STATE, 9)).toEqual(STATE)
  })

  it('un guardado v7 sin hideTimerCard migra y recibe false', () => {
    const v7 = {
      ...STATE,
      version: 7,
      display: { showForestName: true, showCountdown: false },
    }
    const result = migrate(v7, 7)

    expect(result.version).toBe(9)
    expect(result.display).toEqual({
      showForestName: true,
      showCountdown: false,
      hideTimerCard: false,
    })
  })

  it('convierte los objetivos de texto de la v5 en objetivos neutrales', () => {
    const v5 = {
      ...STATE,
      version: 5,
      plans: [{ ...PLAN, tasks: ['Leer', 'Resumir'] }],
      sessions: [{ ...SESSION, tasks: ['Leer'] }],
      active: { ...ACTIVE, tasks: ['Leer'] },
    }
    const result = migrate(v5, 5)

    expect(result.version).toBe(9)
    expect(result.plans[0].tasks).toEqual([
      { id: 'task-1', text: 'Leer', status: 'neutral' },
      { id: 'task-2', text: 'Resumir', status: 'neutral' },
    ])
    expect(result.sessions[0].tasks).toEqual([{ id: 'task-1', text: 'Leer', status: 'neutral' }])
    expect(result.active?.tasks).toEqual([{ id: 'task-1', text: 'Leer', status: 'neutral' }])
  })

  it('recupera árboles huérfanos sin perderlos', () => {
    const result = migrate(
      {
        ...STATE,
        forests: [],
        activeForestId: null,
        trees: [{ ...TREE, forestId: 'forest-que-no-existe' }],
        sessions: [],
        active: null,
      },
      5,
    )

    expect(result.forests).toHaveLength(1)
    expect(result.activeForestId).toBe(result.forests[0].id)
    expect(result.trees).toHaveLength(1)
    expect(result.trees[0].forestId).toBe(result.forests[0].id)
  })

  it('migra planes v8 a ciclos indefinidos', () => {
    const result = migrate(
      {
        ...STATE,
        version: 8,
        plans: [{ ...PLAN, openEnded: false }],
      },
      8,
    )

    expect(result.version).toBe(9)
    expect(result.plans[0].openEnded).toBe(false)
  })

  it('migra un guardado v3 a v7 sin sesiones planificadas', () => {
    const v3 = {
      version: 3,
      forests: [FOREST],
      activeForestId: FOREST.id,
      trees: [TREE],
      sessions: [SESSION],
      active: LEGACY_ACTIVE,
      settings: { ...DEFAULT_POMODORO_SETTINGS },
      display: { ...DEFAULT_DISPLAY_SETTINGS },
    }
    const result = migrate(v3, 3)

    expect(result.version).toBe(9)
    expect(result.plans).toEqual([])
    expect(result.activePlanId).toBeNull()
    expect(result.sessions).toEqual([{ ...SESSION, forestId: DEFAULT_FOREST_ID }])
  })
})

describe('isPersistedState', () => {
  it('acepta un estado completo de la versión actual', () => {
    expect(isPersistedState(STATE)).toBe(true)
  })

  it('acepta planes con objetivos que tienen estado', () => {
    const plan: SessionPlan = {
      ...PLAN,
      tasks: [
        { id: 'task-1', text: 'Leer', status: 'neutral' },
        { id: 'task-2', text: 'Resumir', status: 'done' },
      ],
    }

    expect(isPersistedState({ ...STATE, plans: [plan] })).toBe(true)
  })

  it('rechaza árboles con forma inválida', () => {
    expect(isPersistedState({ ...STATE, trees: [{ nope: true }] })).toBe(false)
  })

  it('rechaza una sesión activa incompleta', () => {
    expect(isPersistedState({ ...STATE, active: { kind: 'focus' } })).toBe(false)
  })

  it('rechaza una versión distinta', () => {
    expect(isPersistedState({ ...STATE, version: 5 })).toBe(false)
    expect(isPersistedState({ ...STATE, version: 4 })).toBe(false)
    expect(isPersistedState({ ...STATE, version: 2 })).toBe(false)
  })

  it('acepta ciclos indefinidos con más pomodoros completados que un límite fijo', () => {
    const openPlan: SessionPlan = {
      ...PLAN,
      openEnded: true,
      targetPomodoros: 1,
      completedPomodoros: 5,
      planting: Array.from({ length: 9 }, (_, index) => ({
        species: 'pino',
        cell: { col: index % 8, row: Math.floor(index / 8) },
        treeId: null,
      })),
    }

    expect(isPersistedState({ ...STATE, plans: [openPlan] })).toBe(true)
  })
})

describe('createSafeStorage', () => {
  it('lee un guardado válido sin avisos', () => {
    const { storage } = makeStorage()
    const raw = envelope(STATE, 5)
    storage.setItem('focus-forest', raw)
    const issues: StorageIssue[] = []
    const safe = createSafeStorage(
      () => storage,
      (issue) => issues.push(issue),
    )

    expect(safe.getItem('focus-forest')).toBe(raw)
    expect(issues).toEqual([])
  })

  it('respalda y reinicia un JSON inválido', () => {
    const { storage } = makeStorage()
    const raw = '{"state":'
    storage.setItem('focus-forest', raw)
    const issues: StorageIssue[] = []
    const safe = createSafeStorage(
      () => storage,
      (issue) => issues.push(issue),
    )

    expect(safe.getItem('focus-forest')).toBeNull()
    expect(storage.getItem('focus-forest')).toBeNull()
    expect(storage.getItem('focus-forest.broken')).toBe(raw)
    expect(issues).toEqual([{ kind: 'corrupt' }])
  })

  it('respalda y reinicia un estado con forma inválida', () => {
    const { storage } = makeStorage()
    const raw = envelope({ ...STATE, trees: 'x' }, 9)
    storage.setItem('focus-forest', raw)
    const issues: StorageIssue[] = []
    const safe = createSafeStorage(
      () => storage,
      (issue) => issues.push(issue),
    )

    expect(safe.getItem('focus-forest')).toBeNull()
    expect(storage.getItem('focus-forest.broken')).toBe(raw)
    expect(issues).toEqual([{ kind: 'corrupt' }])
  })

  it('respalda un guardado sin versión reconocible', () => {
    const { storage } = makeStorage()
    const raw = envelope(STATE, 'uno')
    storage.setItem('focus-forest', raw)
    const issues: StorageIssue[] = []
    const safe = createSafeStorage(
      () => storage,
      (issue) => issues.push(issue),
    )

    expect(safe.getItem('focus-forest')).toBeNull()
    expect(storage.getItem('focus-forest.broken')).toBe(raw)
    expect(issues).toEqual([{ kind: 'corrupt' }])
  })

  it('no toca una versión más nueva y bloquea las escrituras', () => {
    const { storage } = makeStorage()
    const raw = envelope({ ...STATE, version: 10 }, 10)
    storage.setItem('focus-forest', raw)
    const issues: StorageIssue[] = []
    const safe = createSafeStorage(
      () => storage,
      (issue) => issues.push(issue),
    )

    expect(safe.getItem('focus-forest')).toBeNull()
    expect(storage.getItem('focus-forest')).toBe(raw)
    expect(issues).toEqual([{ kind: 'future-version', version: 10 }])

    safe.setItem('focus-forest', 'nuevo')
    safe.removeItem('focus-forest')

    expect(storage.getItem('focus-forest')).toBe(raw)
  })

  it('avisa si el almacenamiento está bloqueado', () => {
    const issues: StorageIssue[] = []
    const safe = createSafeStorage(
      () => {
        throw new Error('bloqueado')
      },
      (issue) => issues.push(issue),
    )

    expect(safe.getItem('focus-forest')).toBeNull()
    expect(issues).toEqual([{ kind: 'unavailable' }])
    expect(() => safe.setItem('focus-forest', 'x')).not.toThrow()
  })

  it('avisa si no puede escribir', () => {
    const { storage } = makeStorage()
    const failing = {
      ...storage,
      setItem: () => {
        throw new Error('cuota')
      },
    } as Storage
    const issues: StorageIssue[] = []
    const safe = createSafeStorage(
      () => failing,
      (issue) => issues.push(issue),
    )

    expect(() => safe.setItem('focus-forest', 'x')).not.toThrow()
    expect(issues).toEqual([{ kind: 'unavailable' }])
  })

  it('lee un guardado actual con objetivos con estado sin marcarlo dañado', () => {
    const { storage } = makeStorage()
    const plan: SessionPlan = {
      ...PLAN,
      tasks: [{ id: 'task-1', text: 'Leer', status: 'done' }],
    }
    const raw = envelope({ ...STATE, plans: [plan] }, 9)
    storage.setItem('focus-forest', raw)
    const issues: StorageIssue[] = []
    const safe = createSafeStorage(
      () => storage,
      (issue) => issues.push(issue),
    )

    expect(safe.getItem('focus-forest')).toBe(raw)
    expect(issues).toEqual([])
    expect(storage.getItem('focus-forest.broken')).toBeNull()
  })

  it('rescata los datos válidos de un guardado con un elemento dañado', () => {
    const { storage } = makeStorage()
    const brokenTree = { ...TREE, id: 'tree-2', cell: { col: 99, row: 99 } }
    const raw = envelope({ ...STATE, trees: [TREE, brokenTree] }, 9)
    storage.setItem('focus-forest', raw)
    const issues: StorageIssue[] = []
    const safe = createSafeStorage(
      () => storage,
      (issue) => issues.push(issue),
    )

    const healed = safe.getItem('focus-forest')

    expect(healed).not.toBeNull()
    const saved = JSON.parse(healed as string) as { state: PersistedV9; version: number }
    expect(saved.version).toBe(9)
    expect(saved.state.trees.map((tree) => tree.id)).toEqual([TREE.id])
    expect(saved.state.plans).toHaveLength(1)
    expect(saved.state.sessions).toHaveLength(1)

    expect(storage.getItem('focus-forest.broken')).toBe(raw)
    expect(issues).toEqual([{ kind: 'recovered' }])
  })

  it('deja el guardado rescatado sano para la próxima lectura', () => {
    const { storage } = makeStorage()
    const raw = envelope({ ...STATE, active: { kind: 'focus' } }, 9)
    storage.setItem('focus-forest', raw)
    const first = createSafeStorage(
      () => storage,
      () => undefined,
    )

    const healed = first.getItem('focus-forest')
    expect(healed).not.toBeNull()

    const issues: StorageIssue[] = []
    const second = createSafeStorage(
      () => storage,
      (issue) => issues.push(issue),
    )

    expect(second.getItem('focus-forest')).toBe(storage.getItem('focus-forest'))
    expect(issues).toEqual([])
    expect(storage.getItem('focus-forest.broken')).toBe(raw)
  })
})
