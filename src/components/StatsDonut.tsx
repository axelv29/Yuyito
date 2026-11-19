export interface DonutSegment {
  key: string
  label: string
  /** Valor que define el tamaño de la porción. */
  value: number
  /** Texto ya formateado que se muestra en la leyenda y el tooltip. */
  display: string
  /** Color de la serie: 1 a 6. */
  series: number
}

interface StatsDonutProps {
  segments: readonly DonutSegment[]
  centerValue: string
  centerUnit: string
  ariaLabel: string
  emptyText: string
}

const VIEWBOX = 80
const CENTER = VIEWBOX / 2
const RADIUS = 33
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const SEGMENT_GAP = 3.5

/** Anillo de estadísticas: porciones con separación fina y tooltip propio. */
export function StatsDonut({
  segments,
  centerValue,
  centerUnit,
  ariaLabel,
  emptyText,
}: StatsDonutProps) {
  const visible = segments.filter((segment) => segment.value > 0)
  const total = visible.reduce((sum, segment) => sum + segment.value, 0)
  const values = visible.map((segment) => segment.value)

  const arcs = visible.map((segment, index) => {
    const length = (segment.value / total) * CIRCUMFERENCE
    const before = values.slice(0, index).reduce((sum, value) => sum + value, 0)
    const offset = (before / total) * CIRCUMFERENCE

    return {
      segment,
      dash: `${Math.max(1.5, length - SEGMENT_GAP)} ${CIRCUMFERENCE}`,
      offset: -offset,
    }
  })

  return (
    <div className="stats-donut" role="img" aria-label={ariaLabel} tabIndex={0}>
      <div className="stats-donut__chart">
        <svg className="stats-donut__svg" viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} aria-hidden="true">
          <circle
            className="stats-donut__track"
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            strokeWidth={6}
          />
          {total > 0 && (
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              {arcs.map(({ segment, dash, offset }) => (
                <circle
                  key={segment.key}
                  className={`stats-donut__arc stats-donut__arc--${segment.series}`}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  strokeWidth={6}
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                />
              ))}
            </g>
          )}
        </svg>

        <span className="stats-donut__center">
          <span className="stats-donut__total">{total > 0 ? centerValue : '—'}</span>
          <span className="stats-donut__unit">{total > 0 ? centerUnit : 'sin datos'}</span>
        </span>

        {total > 0 && (
          <span className="stats-donut__tip" aria-hidden="true">
            {visible.map((segment) => (
              <span className="stats-donut__tip-row" key={segment.key}>
                <span className={`stats-donut__dot stats-donut__dot--${segment.series}`} />
                <span className="stats-donut__tip-label">{segment.label}</span>
                <span className="stats-donut__tip-value">{segment.display}</span>
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="stats-donut__legend">
        {total > 0 ? (
          visible.map((segment) => (
            <span className="stats-donut__legend-row" key={segment.key}>
              <span className={`stats-donut__dot stats-donut__dot--${segment.series}`} />
              <span className="stats-donut__legend-label">{segment.label}</span>
              <span className="stats-donut__legend-value">{segment.display}</span>
            </span>
          ))
        ) : (
          <p className="type-caption type-muted">{emptyText}</p>
        )}
      </div>
    </div>
  )
}
