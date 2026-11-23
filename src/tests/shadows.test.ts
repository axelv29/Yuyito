import { describe, expect, it } from 'vitest'
import {
  drawTreeShadow,
  SHADOW_ANGLE_DEG,
  SHADOW_LENGTH_SCALE,
  SHADOW_WIDTH_SCALE,
  shadowMatrix,
} from '@/render/shadows'
import type { Atlas } from '@/render/sprites'

const BASE_X = 120
const BASE_Y = 200
const HEIGHT = 100

/** Punto del sprite relativo a la base: `x` a la derecha, `y` hacia arriba. */
function project(matrix: ReturnType<typeof shadowMatrix>, x: number, y: number) {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  }
}

describe('shadowMatrix', () => {
  it('deja la base del tronco en su lugar', () => {
    const matrix = shadowMatrix(BASE_X, BASE_Y)

    expect(matrix.e).toBe(BASE_X)
    expect(matrix.f).toBe(BASE_Y)
    expect(project(matrix, 0, 0)).toEqual({ x: BASE_X, y: BASE_Y })
  })

  it('acuesta la copa hacia atrás en diagonal a la derecha', () => {
    const matrix = shadowMatrix(BASE_X, BASE_Y)
    const crown = project(matrix, 0, -HEIGHT)
    const angle = (SHADOW_ANGLE_DEG * Math.PI) / 180

    expect(crown.x).toBeGreaterThan(BASE_X)
    expect(crown.y).toBeLessThan(BASE_Y)
    expect(crown.x - BASE_X).toBeCloseTo(Math.cos(angle) * HEIGHT * SHADOW_LENGTH_SCALE)
    expect(crown.y - BASE_Y).toBeCloseTo(Math.sin(angle) * HEIGHT * SHADOW_LENGTH_SCALE)
  })

  it('deforma el ancho y el largo con escalas distintas', () => {
    const matrix = shadowMatrix(BASE_X, BASE_Y)
    const crown = project(matrix, 0, -HEIGHT)
    const side = project(matrix, HEIGHT, 0)
    const length = Math.hypot(crown.x - BASE_X, crown.y - BASE_Y)
    const width = Math.hypot(side.x - BASE_X, side.y - BASE_Y)

    expect(SHADOW_LENGTH_SCALE).not.toBe(SHADOW_WIDTH_SCALE)
    expect(length).toBeCloseTo(HEIGHT * SHADOW_LENGTH_SCALE)
    expect(width).toBeCloseTo(HEIGHT * SHADOW_WIDTH_SCALE)
  })

  it('cambia de lado con el ángulo', () => {
    const left = shadowMatrix(BASE_X, BASE_Y, 225)
    const right = shadowMatrix(BASE_X, BASE_Y, 315)

    expect(project(left, 0, -HEIGHT).x).toBeLessThan(BASE_X)
    expect(project(right, 0, -HEIGHT).x).toBeGreaterThan(BASE_X)
  })
})

describe('drawTreeShadow', () => {
  it('no dibuja nada sin canvas disponible (tests en node)', () => {
    const atlas: Atlas = {
      images: { pino: {} as HTMLImageElement },
      frames: {
        'pino.4.mature': {
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          anchorX: 5,
          anchorY: 10,
          sheet: 'pino',
        },
      },
    }
    const context = {
      save: () => {
        throw new Error('no debería tocar el contexto')
      },
    } as unknown as CanvasRenderingContext2D

    expect(drawTreeShadow(context, atlas, 'pino.4.mature', 0, 0)).toBe(false)
  })
})
