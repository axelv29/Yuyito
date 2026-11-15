import { useId, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from './icons'

/**
 * Datos extra de la sesión, plegables para no saturar la tarjeta. Los
 * objetivos y las etapas de crecimiento nunca se pliegan.
 */
export function SessionDetails({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <div className="session-details">
      <button
        type="button"
        className="session-details__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="session-details__label">
          {open ? 'Ocultar datos' : 'Más datos'}
        </span>
        <ChevronDownIcon className="session-details__chevron" />
      </button>
      {open && (
        <dl className="session-data" id={id}>
          {children}
        </dl>
      )}
    </div>
  )
}
