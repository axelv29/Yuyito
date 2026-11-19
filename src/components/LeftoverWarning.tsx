import { useEffect, useRef } from 'react'

interface LeftoverWarningProps {
  /** Minutos de enfoque que ningún árbol va a aprovechar. */
  leftoverMin: number
  /** Minutos que suman los árboles elegidos. */
  totalCost: number
  /** Minutos de enfoque que dura la sesión. */
  budget: number
  /** Vuelve al diálogo para cambiar los árboles o el tiempo. */
  onAdjust: () => void
  /** Empieza igual, con el tramo final sin árboles. */
  onStart: () => void
}

/**
 * Card previa al inicio cuando los árboles no cubren el tiempo de enfoque.
 * Explica que ese tramo no hace crecer nada y qué le pasa al último árbol si
 * la sesión se abandona: se marchita aunque ya haya crecido del todo.
 */
export function LeftoverWarning({
  leftoverMin,
  totalCost,
  budget,
  onAdjust,
  onStart,
}: LeftoverWarningProps) {
  const adjustRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    adjustRef.current?.focus()
  }, [])

  const plantedPct = budget > 0 ? Math.min(100, (totalCost / budget) * 100) : 0

  return (
    <div
      className="dialog-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onAdjust()
        }
      }}
    >
      <div
        className="card card--roomy w-full max-w-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leftover-title"
        aria-describedby="leftover-body"
      >
        <p className="eyebrow">Antes de empezar</p>
        <h2 id="leftover-title" className="type-title mt-1">
          Quedan {leftoverMin} min sin plantar
        </h2>

        <div className="alloc mt-3">
          <div className="alloc__bar" aria-hidden="true">
            <div className="alloc__fill" style={{ width: `${plantedPct}%` }} />
          </div>
          <div className="alloc__meta">
            <span>
              <strong>{totalCost}</strong> de {budget} min con árboles
            </span>
            <span className="alloc__state">
              <strong>{leftoverMin}</strong> min sin plantar
            </span>
          </div>
        </div>

        <div id="leftover-body">
          <p className="type-body type-muted mt-3">
            La sesión no se acorta: el reloj sigue hasta el final del enfoque y ese tramo no hace
            crecer ningún árbol.
          </p>
          <p className="type-body mt-2">
            Si la abandonás durante ese tramo, el último árbol se marchita aunque ya haya crecido del
            todo. Los anteriores quedan intactos.
          </p>
          <p className="type-caption type-muted mt-2">
            Podés sumar árboles o acortar el enfoque para aprovecharlo.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button ref={adjustRef} type="button" className="btn btn-secondary" onClick={onAdjust}>
            Ajustar árboles
          </button>
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Empezar igual
          </button>
        </div>
      </div>
    </div>
  )
}
