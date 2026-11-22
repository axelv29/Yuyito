import { describe, expect, it } from 'vitest'
import { GRID_COLS, TILE_HEIGHT, TOP_PADDING } from '@/config/grid'
import { sunlightRange, treeTint } from '@/render/sunlight'

describe('treeTint', () => {
  const range = { backY: 100, frontY: 200 }

  it('no tiñe el árbol más de adelante', () => {
    expect(treeTint(200, range)).toBeNull()
  })

  it('oscurece más el árbol más de atrás', () => {
    const tint = treeTint(100, range)

    expect(tint).not.toBeNull()
    expect(tint?.color).toEqual([0, 0, 0])
    expect(tint?.alpha).toBeGreaterThan(0)
  })

  it('aumenta la oscuridad de adelante hacia atrás', () => {
    const frontMid = treeTint(175, range)
    const backMid = treeTint(125, range)
    const back = treeTint(100, range)

    expect(frontMid?.color).toEqual([0, 0, 0])
    expect(backMid?.alpha ?? 0).toBeGreaterThan(frontMid?.alpha ?? 0)
    expect(back?.alpha ?? 0).toBeGreaterThan(backMid?.alpha ?? 0)
  })
})

describe('sunlightRange', () => {
  it('cubre el rombo del bosque de atrás a adelante', () => {
    const meadowTop = TOP_PADDING

    expect(sunlightRange(meadowTop, GRID_COLS)).toEqual({
      backY: meadowTop,
      frontY: meadowTop + GRID_COLS * TILE_HEIGHT,
    })
  })

  it('ancla los bosques chicos abajo: el frente cae en la misma fila', () => {
    for (let size = 4; size <= GRID_COLS; size += 1) {
      const meadowTop = TOP_PADDING + (GRID_COLS - size) * TILE_HEIGHT

      expect(sunlightRange(meadowTop, size).frontY).toBe(TOP_PADDING + GRID_COLS * TILE_HEIGHT)
    }
  })
})
