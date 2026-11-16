import { sessionSegments, type SessionRhythm } from '@/logic/session'

interface SessionTimeRingProps {
  rhythm: SessionRhythm
  totalMin: number
}

const VIEWBOX = 80
const CENTER = VIEWBOX / 2
const RADIUS = 33
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Separación entre bloques; deja ver dónde empieza y termina la vuelta. */
const SEGMENT_GAP = 3.5

/**
 * Anillo pequeño con la composición de la sesión: cada bloque de enfoque y
 * cada pausa ocupan un arco proporcional a sus minutos. En el centro va el
 * total de la sesión, sin competir con el reloj del timer. Al pasar el puntero
 * muestra un tooltip propio con el detalle de cada tiempo.
 */
export function SessionTimeRing({ rhythm, totalMin }: SessionTimeRingProps) {
  const total = Math.max(1, totalMin)
  const segments = sessionSegments(rhythm)
  const focusCount = segments.filter((segment) => segment.kind === 'focus').length
  const shortCount = segments.filter((segment) => segment.kind === 'shortBreak').length
  const longCount = segments.filter((segment) => segment.kind === 'longBreak').length

  const arcs = segments.map((segment, index) => {
    const startMin = segments.slice(0, index).reduce((sum, item) => sum + item.minutes, 0)
    const length = (segment.minutes / total) * CIRCUMFERENCE

    return {
      key: `${segment.kind}-${index}`,
      kind: segment.kind,
      length: Math.max(1.5, length - SEGMENT_GAP),
      offset: -(startMin / total) * CIRCUMFERENCE,
    }
  })

  const parts = [
    `${focusCount} ${focusCount === 1 ? 'bloque' : 'bloques'} de ${rhythm.focusMin} min`,
    shortCount > 0
      ? `${shortCount} ${shortCount === 1 ? 'pausa' : 'pausas'} de ${rhythm.breakMin} min`
      : null,
    longCount > 0
      ? `${longCount === 1 ? 'una pausa larga' : `${longCount} pausas largas`} de ${rhythm.longBreakMin} min`
      : null,
  ].filter(Boolean)
  const label = `${parts.join(', ')}: ${total} min en total`

  return (
    <div className="session-time-ring" role="img" aria-label={label} tabIndex={0}>
      <svg
        className="session-time-ring__svg"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="session-time-ring-gradient"
            x1="12"
            y1="68"
            x2="68"
            y2="12"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="var(--ring-from)" />
            <stop offset="1" stopColor="var(--ring-to)" />
          </linearGradient>
        </defs>

        <circle className="session-time-ring__track" cx={CENTER} cy={CENTER} r={RADIUS} />

        <g className="session-time-ring__segments">
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              className={`session-time-ring__arc session-time-ring__arc--${
                arc.kind === 'shortBreak'
                  ? 'short-break'
                  : arc.kind === 'longBreak'
                    ? 'long-break'
                    : 'focus'
              }`}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`}
              strokeDashoffset={arc.offset}
            />
          ))}
        </g>

        {/* Marca del punto 0: sin ella el primer y el último bloque parecen uno solo. */}
        <line className="session-time-ring__start" x1={CENTER} y1={1.6} x2={CENTER} y2={5.6} />
      </svg>

      <span className="session-time-ring__center">
        <span className="session-time-ring__total">{total}</span>
        <span className="session-time-ring__unit">min</span>
      </span>

      <span className="session-time-ring__tip" aria-hidden="true">
        <span className="session-time-ring__tip-row">
          <span className="session-time-ring__dot session-time-ring__dot--focus" />
          <span className="session-time-ring__tip-label">Enfoque</span>
          <span className="session-time-ring__tip-value">
            {rhythm.focusMin} min × {focusCount}
          </span>
        </span>

        {shortCount > 0 && (
          <span className="session-time-ring__tip-row">
            <span className="session-time-ring__dot session-time-ring__dot--short-break" />
            <span className="session-time-ring__tip-label">Pausa</span>
            <span className="session-time-ring__tip-value">
              {rhythm.breakMin} min × {shortCount}
            </span>
          </span>
        )}

        {longCount > 0 && (
          <span className="session-time-ring__tip-row">
            <span className="session-time-ring__dot session-time-ring__dot--long-break" />
            <span className="session-time-ring__tip-label">Pausa larga</span>
            <span className="session-time-ring__tip-value">
              {rhythm.longBreakMin} min × {longCount}
            </span>
          </span>
        )}

        <span className="session-time-ring__tip-row session-time-ring__tip-row--total">
          <span className="session-time-ring__tip-label">Total</span>
          <span className="session-time-ring__tip-value">{total} min</span>
        </span>
      </span>
    </div>
  )
}
