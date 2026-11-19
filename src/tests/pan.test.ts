import { describe, expect, it } from 'vitest'
import { clampPan, panLimit } from '@/logic/pan'

describe('arrastre de la pradera', () => {
  it('amplía el recorrido a medida que se acerca el zoom', () => {
    expect(panLimit(0.5, 482, 400, 1024, 853)).toEqual({ x: 80, y: 85 })
    expect(panLimit(1, 962, 800, 1024, 853)).toEqual({ x: 150, y: 170 })
    expect(panLimit(1.5, 1442, 1200, 1024, 853)).toEqual({ x: 289, y: 255 })
    expect(panLimit(2, 1922, 1600, 1024, 853)).toEqual({ x: 529, y: 454 })
  })

  it('acota el recorrido vertical para que la isla no salga entera de pantalla', () => {
    // Isla 4×4 (mitad de alto 76 en escena), zoom 2x en viewport de celular:
    // sin el tope el arrastre llegaría a 340; con él asoman al menos 48 px.
    expect(panLimit(2, 960, 800, 390, 325, 76).y).toBe(267)
    // Isla grande en un lienzo holgado no se recorta: manda el límite base.
    expect(panLimit(1, 962, 800, 1024, 853, 136).y).toBe(170)
  })

  it('acota el recorrido horizontal con el mismo criterio', () => {
    // Isla 2×2 (mitad de ancho 60 en escena), zoom 2x en viewport de celular:
    // sin el tope el arrastre llegaría a 360; con él asoman al menos 48 px.
    expect(panLimit(2, 960, 800, 400, 300, 76, 60).x).toBe(272)
    // Con lienzo holgado manda el límite base.
    expect(panLimit(1, 962, 800, 1024, 853, 136, 240).x).toBe(150)
  })

  it('usa un límite simétrico desde el centro', () => {
    const limit = panLimit(1, 962, 800, 1024, 853)

    expect(clampPan({ x: 300, y: -300 }, limit)).toEqual({ x: 150, y: -170 })
    expect(clampPan({ x: -300, y: 300 }, limit)).toEqual({ x: -150, y: 170 })
  })

  it('redondea a píxeles enteros y tolera valores inválidos', () => {
    expect(clampPan({ x: 12.4, y: -8.6 }, panLimit(1, 962, 800, 1024, 853))).toEqual({
      x: 12,
      y: -9,
    })
    expect(
      clampPan({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, panLimit(1, 962, 800, 1024, 853)),
    ).toEqual({
      x: 0,
      y: 0,
    })
  })
})
