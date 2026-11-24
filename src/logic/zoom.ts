import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MAX_ZOOM_EXTENDED,
  MIN_ZOOM,
  WHEEL_STEP_DELTA,
} from '@/config/zoom'

function clampValue(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_ZOOM
  }

  return Math.min(max, Math.max(MIN_ZOOM, value))
}

function clampZoomTo(value: number, max: number): number {
  return Math.round(clampValue(value, max) * 100) / 100
}

/**
 * Mantiene el zoom dentro del rango visible y lo redondea a dos decimales
 * para que el slider y los botones no acumulen errores de punto flotante.
 */
export function clampZoom(value: number): number {
  return clampZoomTo(value, MAX_ZOOM)
}

/** Lleva un delta de rueda (píxeles, líneas o páginas) a una unidad común. */
export function normalizeWheelDelta(deltaY: number, deltaMode = 0): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) {
    return 0
  }

  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1
  return deltaY * unit
}

export interface WheelZoomStep {
  zoom: number
  accumulator: number
}

/**
 * Acumula la rueda y avanza un único nivel pixel-perfect cuando se alcanza el
 * umbral. Así un giro normal cambia 50→100→150→200 sin saltos intermedios y
 * los deltas chicos de un trackpad no se pierden.
 */
export function wheelZoomStep(
  zoom: number,
  basePixelScale: number,
  accumulator: number,
  deltaY: number,
  deltaMode = 0,
): WheelZoomStep {
  const delta = normalizeWheelDelta(deltaY, deltaMode)
  if (delta === 0) {
    return { zoom, accumulator }
  }

  const previous = Number.isFinite(accumulator) ? accumulator : 0
  const nextAccumulator = Math.sign(previous) === Math.sign(delta) ? previous + delta : delta

  if (Math.abs(nextAccumulator) < WHEEL_STEP_DELTA) {
    return { zoom, accumulator: nextAccumulator }
  }

  const direction: 1 | -1 = nextAccumulator < 0 ? 1 : -1
  return {
    zoom: stepPixelPerfectZoom(zoom, basePixelScale, direction),
    accumulator: 0,
  }
}

/**
 * Escala base en píxeles físicos por píxel lógico. Elige la mayor escala
 * entera (o 0.5x) que entra en el contenedor sin desbordarlo.
 */
export function fitPixelScale(ideal: number): number {
  if (!Number.isFinite(ideal) || ideal <= 0) {
    return 1
  }
  if (ideal < 1) {
    return 0.5
  }
  return Math.max(1, Math.floor(ideal))
}

/**
 * Redondea a una escala pixel-perfect: 0.5x o un múltiplo entero.
 * Evita que el pixel art se reescale con factores fraccionarios.
 */
export function snapPixelScale(ideal: number): number {
  if (!Number.isFinite(ideal) || ideal <= 0) {
    return 1
  }
  if (ideal < 0.75) {
    return 0.5
  }
  return Math.max(1, Math.round(ideal))
}

/**
 * Nivel máximo de zoom. Con una base de 2× o más se mantiene el 2× de
 * siempre; en pantallas con base 1× se extiende a 4× para que haya cuatro
 * niveles enteros (100, 200, 300 y 400 %) y no solo dos.
 */
export function maxPixelPerfectZoom(basePixelScale: number): number {
  return Math.max(0.5, basePixelScale) === 1 ? MAX_ZOOM_EXTENDED : MAX_ZOOM
}

/** Convierte un zoom continuo al nivel pixel-perfect más cercano. */
export function pixelPerfectZoom(value: number, basePixelScale: number): number {
  const base = Math.max(0.5, basePixelScale)
  const max = maxPixelPerfectZoom(base)
  const snapped = snapPixelScale(base * clampValue(value, max))
  return clampZoomTo(snapped / base, max)
}

/**
 * Nivel mínimo de zoom. Si la escala base ya es 1 o menor, el propio ajuste
 * es el mínimo; si es mayor, no baja de una escala entera para no muestrear
 * el pixel art hacia abajo.
 */
export function minPixelPerfectZoom(basePixelScale: number): number {
  const base = Math.max(0.5, basePixelScale)
  if (base <= 1) {
    return 1
  }
  return clampZoom(Math.max(1, Math.ceil(base * MIN_ZOOM)) / base)
}

/** Avanza al siguiente nivel pixel-perfect en la dirección indicada. */
export function stepPixelPerfectZoom(
  value: number,
  basePixelScale: number,
  direction: 1 | -1,
): number {
  const base = Math.max(0.5, basePixelScale)
  const max = maxPixelPerfectZoom(base)
  const current = snapPixelScale(base * clampValue(value, max))
  const next = direction > 0 ? (current < 1 ? 1 : current + 1) : current <= 1 ? 0.5 : current - 1

  return clampZoomTo(next / base, max)
}
