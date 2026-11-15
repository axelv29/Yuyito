import {
  GRID_COLS,
  ORIGIN_X,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  TILE_HEIGHT,
  TILE_WIDTH,
  TOP_PADDING,
} from '@/config/grid'
import type { ForestSize } from '@/config/forest'
import { treeBasePoint } from '@/render/drawGarden'
import type { Cell, TreeSpecies } from '@/state/types'

/**
 * Altura máxima del arte de cada especie (incluye las etapas adultas y el
 * estado marchito). Se usa para encuadrar la vista previa sin cortar copas.
 */
export const PREVIEW_TREE_HEIGHT: Record<TreeSpecies, number> = {
  pino: 90,
  abedul: 122,
  roble: 138,
  ceibo: 150,
}

/** Aire alrededor de la isla en la miniatura, en píxeles de escena. */
const SIDE_MARGIN = 24
const TOP_MARGIN = 10
const EMPTY_TOP_MARGIN = 96
/** Nunca se recorta la punta de arriba de la isla. */
const MIN_ISLAND_AIR = 8

export interface PreviewTree {
  kind?: string
  cell: Cell
}

export interface PreviewFrame {
  /** Origen del recorte dentro de la escena de 480×400. */
  x: number
  y: number
  width: number
  height: number
}

/** Especie desconocida: se usa la copa más alta para no cortar nada. */
function previewTreeHeight(kind: string | undefined): number {
  if (kind === 'pino' || kind === 'abedul' || kind === 'roble' || kind === 'ceibo') {
    return PREVIEW_TREE_HEIGHT[kind]
  }

  return PREVIEW_TREE_HEIGHT.ceibo
}

/**
 * Recorte de la escena que se usa como miniatura: muestra la isla completa con
 * margen, y sube lo justo para que ninguna copa quede cortada. El ancho crece
 * con el tamaño del bosque y nunca pasa el de la escena, así la miniatura se
 * dibuja 1:1 (sin reescalar el pixel art).
 */
export function previewFrame(size: ForestSize, trees: readonly PreviewTree[] = []): PreviewFrame {
  const width = Math.min(SCENE_WIDTH, size * TILE_WIDTH + SIDE_MARGIN * 2)
  const x = Math.round(ORIGIN_X - width / 2)
  const meadowTop = TOP_PADDING + (GRID_COLS - size) * TILE_HEIGHT

  const tops = trees
    .filter(
      (tree) =>
        tree.cell.col >= 0 && tree.cell.col < size && tree.cell.row >= 0 && tree.cell.row < size,
    )
    .map((tree) => treeBasePoint(tree.cell, size).baseY - previewTreeHeight(tree.kind))

  const highest = tops.length > 0 ? Math.min(...tops) : meadowTop - EMPTY_TOP_MARGIN
  const y = Math.max(0, Math.min(highest - TOP_MARGIN, meadowTop - MIN_ISLAND_AIR))

  return {
    x,
    y: Math.round(y),
    width,
    height: SCENE_HEIGHT - Math.round(y),
  }
}
