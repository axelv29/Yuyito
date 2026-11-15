interface SessionTimeRingProps {
  focusMin: number
  breakMin: number
  cycles: number
  totalMin: number
}

const VIEWBOX = 80
const CENTER = VIEWBOX / 2
const RADIUS = 33
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Separación entre bloques, en unidades del recorrido del anillo. */
const SEGMENT_GAP = 5

/**
 * Anillo pequeño con la composición de la sesión: cada bloque de enfoque y
 * cada pausa ocupan un arco proporcional a sus minutos. En el centro va el
 * total de la sesión, sin competir con el reloj del timer.
 */
export function SessionTimeRing({ focusMin, breakMin, cycles, totalMin }: SessionTimeRingProps) {
  const total = Math.max(1, totalMin)
  const safeCycles = Math.max(1, Math.round(cycles))
  const segments: { kind: 'focus' | 'break'; minutes: number }[] = []

  for (let index = 0; index < safeCycles; index += 1) {
    segments.push({ kind: 'focus', minutes: focusMin })
    if (index < safeCycles - 1 && breakMin > 0) {
      segments.push({ kind: 'break', minutes: breakMin })
    }
  }

  let cursor = 0
  const arcs = segments.map((segment, index) => {
    const length = (segment.minutes / total) * CIRCUMFERENCE
    const start = cursor
    cursor += length

    return {
      key: `${segment.kind}-${index}`,
      kind: segment.kind,
      length: Math.max(0.5, length - SEGMENT_GAP),
      offset: -start,
    }
  })

  const label =
    safeCycles > 1
      ? `${safeCycles} bloques de ${focusMin} min${breakMin > 0 ? ` con pausas de ${breakMin} min` : ''}: ${total} min en total`
      : `Un bloque de ${focusMin} min`

  return (
    <div className="session-time-ring" role="img" aria-label={label} title={label}>
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
              className={`session-time-ring__arc session-time-ring__arc--${arc.kind}`}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`}
              strokeDashoffset={arc.offset}
            />
          ))}
        </g>
      </svg>

      <span className="session-time-ring__center">
        <span className="session-time-ring__total">{total}</span>
        <span className="session-time-ring__unit">min</span>
      </span>
    </div>
  )
}
