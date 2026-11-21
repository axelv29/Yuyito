import { describe, expect, it } from 'vitest'
import { GRID_COLS, TILE_HEIGHT, TOP_PADDING } from '@/config/grid'
import { sunlightRange, sunlightStops } from '@/render/sunlight'

describe('sunlightStops', () => {
  it('va de la sombra del fondo al sol del frente', () => {
    const stops = sunlightStops()

    expect(stops[0].offset).toBe(0)
    expect(stops[stops.length - 1].offset).toBe(1)
    expect(stops[0].alpha).toBeGreaterThan(0)
    expect(stops[stops.length - 1].alpha).toBeGreaterThan(0)

    for (let index = 1; index < stops.length; index += 1) {
      expect(stops[index].offset).toBeGreaterThanOrEqual(stops[index - 1].offset)
    }
  })

  it('deja sin tinte la transición entre sombra y sol', () => {
    const middle = sunlightStops().filter((stop) => stop.offset === 0.6)

    expect(middle).toHaveLength(2)
    expect(middle.every((stop) => stop.alpha === 0)).toBe(true)
  })

  it('oscurece con verde profundo y aclara hacia el frente', () => {
    const stops = sunlightStops()
    const back = stops[0]
    const front = stops[stops.length - 1]
    const sum = (color: readonly [number, number, number]) => color[0] + color[1] + color[2]

    expect(back.color[1]).toBeGreaterThan(back.color[0])
    expect(sum(front.color)).toBeGreaterThan(sum(back.color))
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
