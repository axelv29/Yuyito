import { TILE_HEIGHT } from '@/config/grid'

/**
 * Tinte de profundidad por árbol. Cada sprite recibe una capa uniforme negra
 * según su posición en el rombo: desde el árbol más de adelante (abajo) casi sin
 * oscuridad, hasta el más de atrás (arriba) con máxima oscuridad. El pasto no se
 * tiñe; el efecto se aplica sprite a sprite.
 */
const DARK_TINT = [0, 0, 0] as const
// Temporal: valor absurdo para visualizar la implementación; luego se baja.
const DARK_MAX_ALPHA = 0.45

export interface SunlightRange {
  /** Y de escena del vértice trasero del rombo. */
  backY: number
  /** Y de escena del vértice delantero del rombo. */
  frontY: number
}

export interface TreeTint {
  color: readonly [number, number, number]
  alpha: number
}

/**
 * Rango vertical del rombo en coordenadas de escena. Los bosques más chicos se
 * anclan abajo, así que el vértice delantero siempre cae en la misma fila.
 */
export function sunlightRange(meadowTop: number, size: number): SunlightRange {
  return { backY: meadowTop, frontY: meadowTop + size * TILE_HEIGHT }
}

/**
 * Tinte uniforme negro para un árbol según su base Y en la escena. El frente
 * (abajo) queda casi limpio y la oscuridad aumenta linealmente hacia el fondo.
 */
export function treeTint(baseY: number, range: SunlightRange): TreeTint | null {
  const span = range.frontY - range.backY
  if (span <= 0) {
    return null
  }

  const t = Math.min(1, Math.max(0, (baseY - range.backY) / span))
  const alpha = DARK_MAX_ALPHA * (1 - t)
  return alpha <= 0 ? null : { color: DARK_TINT, alpha }
}
