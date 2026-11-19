/**
 * Límites del arrastre global de la pradera.
 *
 * Se miden simétricamente desde el centro del mapa. El recorrido base crece
 * con el zoom y además se suma la parte del canvas que desborda el contenedor,
 * con un margen fijo. Así el 200 % tiene mucha más movilidad que el 50 %.
 * El recorrido vertical se acota si se pasa la mitad del alto de la isla,
 * para que nunca quede entera fuera de la pantalla.
 */
import { SCENE_HEIGHT, SCENE_WIDTH } from '@/config/grid'

const PAN_X = 150
const PAN_Y = 170
const EDGE_MARGIN = 80
/** Mínimo de isla que debe seguir asomando por la pantalla, en px. */
const MIN_ISLAND_VISIBLE = 48

export interface PanOffset {
  x: number
  y: number
}

export interface PanLimit {
  x: number
  y: number
}

function safeSize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * `islandHalfHeight` es la mitad del alto de la isla en px de escena
 * (antes de escalar). Con él, el recorrido vertical se acota para que la
 * isla nunca quede por completo fuera de la pantalla. `islandHalfWidth` hace
 * lo mismo en horizontal. Sin esos datos, el comportamiento es el de siempre.
 */
export function panLimit(
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  containerWidth: number,
  containerHeight: number,
  islandHalfHeight: number = Number.POSITIVE_INFINITY,
  islandHalfWidth: number = Number.POSITIVE_INFINITY,
): PanLimit {
  const safeZoom = Number.isFinite(zoom) ? Math.min(2, Math.max(0.5, zoom)) : 1
  const overflowX = Math.max(0, (safeSize(canvasWidth) - safeSize(containerWidth)) / 2)
  const overflowY = Math.max(0, (safeSize(canvasHeight) - safeSize(containerHeight)) / 2)
  const sceneScaleY = safeSize(canvasHeight) / SCENE_HEIGHT
  const sceneScaleX = safeSize(canvasWidth) / SCENE_WIDTH
  const yBound = Number.isFinite(islandHalfHeight)
    ? Math.max(0, safeSize(containerHeight) / 2 + safeSize(islandHalfHeight) * sceneScaleY - MIN_ISLAND_VISIBLE)
    : Number.POSITIVE_INFINITY
  const xBound = Number.isFinite(islandHalfWidth)
    ? Math.max(0, safeSize(containerWidth) / 2 + safeSize(islandHalfWidth) * sceneScaleX - MIN_ISLAND_VISIBLE)
    : Number.POSITIVE_INFINITY

  return {
    x: Math.round(Math.min(Math.max(PAN_X * safeZoom, overflowX + EDGE_MARGIN), xBound)),
    y: Math.round(Math.min(Math.max(PAN_Y * safeZoom, overflowY + EDGE_MARGIN), yBound)),
  }
}

/** Mantiene el desplazamiento dentro del límite, en píxeles enteros. */
export function clampPan(offset: PanOffset, limit: PanLimit): PanOffset {
  const x = Number.isFinite(offset.x) ? offset.x : 0
  const y = Number.isFinite(offset.y) ? offset.y : 0

  return {
    x: Math.round(Math.min(limit.x, Math.max(-limit.x, x))),
    y: Math.round(Math.min(limit.y, Math.max(-limit.y, y))),
  }
}
