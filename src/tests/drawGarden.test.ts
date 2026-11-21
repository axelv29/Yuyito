import { describe, expect, it } from 'vitest'
import { SCENE_CANVAS_WIDTH, SCENE_HEIGHT, SCENE_WIDTH } from '@/config/grid'
import { drawGarden, scenePointFromCanvas, type ActiveTreePreview } from '@/render/drawGarden'
import { treeFlipped } from '@/render/orientation'
import type { Atlas, AtlasFrame } from '@/render/sprites'
import type { Cell, Tree, TreeStage } from '@/state/types'

interface DrawnFrame {
  sheet: string
  stage: number
  flipped: boolean
}

const STAGE_OFFSET = 100

function makeAtlas(stages: readonly TreeStage[]): Atlas {
  const frames: Record<string, AtlasFrame> = {}
  for (const stage of stages) {
    frames[`pino.${stage}.mature`] = {
      x: stage * STAGE_OFFSET,
      y: 0,
      w: 10,
      h: 10,
      anchorX: 5,
      anchorY: 10,
      sheet: 'pino',
    }
  }

  return {
    images: { pino: {} as HTMLImageElement },
    frames,
  }
}

/** Contexto mínimo: solo lo que usa drawGarden con atlas y sheet de suelo. */
function makeContext(drawn: DrawnFrame[]): CanvasRenderingContext2D {
  const mirrorStack: boolean[] = []
  let mirrored = false

  const ctx = {
    canvas: { width: 480, height: 400 },
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    setTransform: () => {},
    clearRect: () => {},
    save: () => {
      mirrorStack.push(mirrored)
    },
    restore: () => {
      mirrored = mirrorStack.pop() ?? false
    },
    translate: () => {},
    scale: (x: number) => {
      if (x < 0) {
        mirrored = !mirrored
      }
    },
    fillRect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    drawImage: (...args: unknown[]) => {
      // Los frames se dibujan con 9 argumentos; el suelo, con 4.
      if (args.length !== 9) {
        return
      }

      drawn.push({
        sheet: 'pino',
        stage: Math.floor(Number(args[1]) / STAGE_OFFSET),
        flipped: mirrored,
      })
    },
  }

  return ctx as unknown as CanvasRenderingContext2D
}

const CELL: Cell = { col: 2, row: 2 }

function makeTree(overrides: Partial<Tree> = {}): Tree {
  return {
    id: 'tree-1',
    forestId: 'forest-1',
    sessionId: 'session-1',
    cell: CELL,
    kind: 'pino',
    stage: 1,
    state: 'growing',
    requiredFocusMin: 25,
    accumulatedFocusMin: 0,
    planId: 'plan-1',
    createdAt: 0,
    ...overrides,
  }
}

function activePreview(overrides: Partial<ActiveTreePreview> = {}): ActiveTreePreview {
  return {
    cell: CELL,
    species: 'pino',
    stage: 2,
    treeId: 'tree-1',
    sessionId: 'session-1',
    ...overrides,
  }
}

function draw(trees: readonly Tree[], active: ActiveTreePreview | null): DrawnFrame[] {
  const drawn: DrawnFrame[] = []
  const groundTile = { width: 487, height: 270 } as HTMLImageElement
  drawGarden(makeContext(drawn), {
    trees,
    active,
    atlas: makeAtlas([1, 2, 3, 4]),
    groundTile,
  })

  return drawn
}

describe('scenePointFromCanvas', () => {
  it('mapea el centro del canvas al centro de la escena', () => {
    expect(scenePointFromCanvas(0.5, 0.5)).toEqual({
      x: SCENE_WIDTH / 2,
      y: SCENE_HEIGHT / 2,
    })
  })

  it('deja aire a los costados para las copas anchas', () => {
    const left = scenePointFromCanvas(0, 0)
    const right = scenePointFromCanvas(1, 1)

    expect(left.x).toBeLessThan(0)
    expect(right.x).toBeGreaterThan(SCENE_WIDTH)
    expect(left.x + right.x).toBe(SCENE_WIDTH)
    expect(SCENE_CANVAS_WIDTH).toBeGreaterThan(SCENE_WIDTH + 40)
  })
})

describe('drawGarden · árbol activo', () => {
  it('dibuja el árbol en crecimiento una sola vez, con la etapa viva', () => {
    const drawn = draw([makeTree({ stage: 1 })], activePreview({ stage: 3 }))

    expect(drawn).toHaveLength(1)
    expect(drawn[0].stage).toBe(3)
  })

  it('avanza la etapa del mismo árbol sin superponer sprites', () => {
    for (const stage of [1, 2, 3, 4] as TreeStage[]) {
      const drawn = draw([makeTree({ stage: 1 })], activePreview({ stage }))

      expect(drawn).toHaveLength(1)
      expect(drawn[0].stage).toBe(stage)
    }
  })

  it('empareja por treeId aunque el árbol conserve el sessionId de otro bloque', () => {
    const drawn = draw(
      [makeTree({ sessionId: 'bloque-anterior', stage: 1 })],
      activePreview({ sessionId: 'bloque-actual', stage: 3 }),
    )

    expect(drawn).toHaveLength(1)
    expect(drawn[0].stage).toBe(3)
  })

  it('dibuja el árbol activo cuando todavía no está en el bosque', () => {
    const drawn = draw([], activePreview({ treeId: null, stage: 2 }))

    expect(drawn).toHaveLength(1)
    expect(drawn[0].stage).toBe(2)
  })
})

describe('drawGarden · orientación', () => {
  const ids = ['tree-1', 'tree-2', 'tree-3', 'tree-4', 'tree-5', 'tree-6']
  const flippedId = ids.find((id) => treeFlipped(id))!
  const normalId = ids.find((id) => !treeFlipped(id))!

  it('espeja solo los árboles cuyo id lo pide', () => {
    expect(draw([makeTree({ id: flippedId })], null)[0].flipped).toBe(true)
    expect(draw([makeTree({ id: normalId })], null)[0].flipped).toBe(false)
  })

  it('conserva el lado mientras el árbol activo avanza de etapa', () => {
    const drawn = draw(
      [makeTree({ id: flippedId, stage: 1 })],
      activePreview({ treeId: flippedId, stage: 3 }),
    )

    expect(drawn).toHaveLength(1)
    expect(drawn[0].flipped).toBe(true)
  })
})
