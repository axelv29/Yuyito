import { describe, expect, it } from 'vitest'
import { clampPan, PAN_TRAVEL_RATIO, panLimit } from '@/logic/pan'

describe('arrastre de la pradera', () => {
  it('usa el 80 % del trayecto máximo hasta el borde de la pantalla', () => {
    // 8×8 a 100 %: media isla 240×136 CSS. El trayecto máximo es media
    // pantalla más media isla; se recorre el 80 % desde el centro.
    expect(panLimit(1024, 1000, 240, 136)).toEqual({ x: 602, y: 509 })
  })

  it('se adapta al tamaño de la ventana sin cambiar la sensación', () => {
    // La misma isla en una pantalla más chica recorre menos píxeles, pero
    // mantiene la misma fracción del trayecto.
    expect(panLimit(800, 550, 240, 136)).toEqual({ x: 512, y: 329 })

    for (const [width, height, halfWidth, halfHeight] of [
      [800, 600, 120, 80],
      [1600, 1200, 240, 160],
      [3200, 2400, 480, 320],
    ] as const) {
      const limit = panLimit(width, height, halfWidth, halfHeight)
      expect(limit.x / (width / 2 + halfWidth)).toBeCloseTo(PAN_TRAVEL_RATIO, 2)
      expect(limit.y / (height / 2 + halfHeight)).toBeCloseTo(PAN_TRAVEL_RATIO, 2)
    }
  })

  it('amplía el recorrido con el zoom porque la isla también crece', () => {
    const base = panLimit(1024, 1000, 240, 136)
    const zoomed = panLimit(1024, 1000, 480, 272)

    expect(zoomed.x).toBeGreaterThan(base.x)
    expect(zoomed.y).toBeGreaterThan(base.y)
    expect(zoomed).toEqual({ x: 794, y: 618 })
  })

  it('usa un límite simétrico desde el centro', () => {
    const limit = panLimit(1024, 1000, 240, 136)

    expect(clampPan({ x: 5000, y: 5000 }, limit)).toEqual({ x: 602, y: 509 })
    expect(clampPan({ x: -5000, y: -5000 }, limit)).toEqual({ x: -602, y: -509 })
  })

  it('deja al menos 48 px de isla asomando en pantallas diminutas', () => {
    // 200×100 con isla de 20×20: el 80 % daría 88/48, pero el tope deja 62/12.
    expect(panLimit(200, 100, 10, 10)).toEqual({ x: 62, y: 12 })
  })

  it('redondea a píxeles enteros y tolera valores inválidos', () => {
    expect(clampPan({ x: 12.4, y: -8.6 }, panLimit(1024, 1000, 240, 136))).toEqual({
      x: 12,
      y: -9,
    })
    expect(
      clampPan({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, panLimit(1024, 1000, 240, 136)),
    ).toEqual({ x: 0, y: 0 })
    expect(panLimit(0, 0, 0, 0)).toEqual({ x: 0, y: 0 })
  })
})
