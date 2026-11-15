import { describe, expect, it } from 'vitest'
import { FOREST_SIZES, type ForestSize } from '@/config/forest'
import {
  GRID_COLS,
  ORIGIN_X,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  TILE_HEIGHT,
  TILE_WIDTH,
  TOP_PADDING,
} from '@/config/grid'
import { PREVIEW_TREE_HEIGHT, previewFrame, type PreviewTree } from '@/render/previewFrame'
import { treeBasePoint } from '@/render/drawGarden'
import type { TreeSpecies } from '@/state/types'

const islandLeft = (size: ForestSize) => ORIGIN_X - (size * TILE_WIDTH) / 2
const islandRight = (size: ForestSize) => ORIGIN_X + (size * TILE_WIDTH) / 2
const meadowTop = (size: ForestSize) => TOP_PADDING + (GRID_COLS - size) * TILE_HEIGHT

describe('previewFrame', () => {
  it('deja la isla completa dentro del recorte, con margen a los costados', () => {
    for (const size of FOREST_SIZES) {
      const frame = previewFrame(size)

      expect(frame.x).toBeGreaterThanOrEqual(0)
      expect(frame.y).toBeGreaterThanOrEqual(0)
      expect(frame.x + frame.width).toBeLessThanOrEqual(SCENE_WIDTH)
      expect(frame.y + frame.height).toBe(SCENE_HEIGHT)

      expect(frame.x).toBeLessThanOrEqual(islandLeft(size))
      expect(frame.x + frame.width).toBeGreaterThanOrEqual(islandRight(size))
    }
  })

  it('centra el recorte en el eje horizontal', () => {
    for (const size of FOREST_SIZES) {
      const frame = previewFrame(size)

      expect(frame.x + frame.width / 2).toBe(ORIGIN_X)
    }
  })

  it('nunca corta la punta de arriba de la isla', () => {
    for (const size of FOREST_SIZES) {
      expect(previewFrame(size).y).toBeLessThanOrEqual(meadowTop(size) - 8)
    }
  })

  it('achica el recorte cuando hay una copa alta en la fila de atrás', () => {
    const empty = previewFrame(8)
    const ceibo: PreviewTree = { kind: 'ceibo', cell: { col: 0, row: 0 } }
    const withTree = previewFrame(8, [ceibo])

    expect(withTree.y).toBeLessThan(empty.y)
    expect(withTree.height).toBeGreaterThan(empty.height)
  })

  it('no corta ninguna copa de los árboles del bosque', () => {
    const species: TreeSpecies[] = ['pino', 'abedul', 'roble', 'ceibo']
    const trees = species.map<PreviewTree>((kind, index) => ({
      kind,
      cell: { col: index, row: 0 },
    }))
    const frame = previewFrame(8, trees)

    for (const [index, kind] of species.entries()) {
      const crownTop = treeBasePoint({ col: index, row: 0 }, 8).baseY - PREVIEW_TREE_HEIGHT[kind]
      expect(frame.y).toBeLessThanOrEqual(crownTop)
    }
  })

  it('ignora árboles fuera del tamaño del bosque', () => {
    const inside = previewFrame(4, [{ kind: 'ceibo', cell: { col: 0, row: 0 } }])
    const outside = previewFrame(4, [
      { kind: 'ceibo', cell: { col: 0, row: 0 } },
      { kind: 'ceibo', cell: { col: 7, row: 7 } },
    ])

    expect(outside).toEqual(inside)
  })
})
