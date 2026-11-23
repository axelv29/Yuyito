import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import {
  SESSION_BREAK_STEP,
  SESSION_FOCUS_STEP,
  SESSION_LONG_BREAK_STEP,
  SESSION_MAX_BREAK_MIN,
  SESSION_MAX_FOCUS_MIN,
  SESSION_MAX_LONG_BREAK_MIN,
  SESSION_MAX_POMODOROS,
  SESSION_MIN_BREAK_MIN,
  SESSION_MIN_FOCUS_MIN,
  SESSION_MIN_LONG_BREAK_MIN,
} from '@/config/session'
import { availableFocusMinutes } from '@/config/species'
import { sessionTimeline, type SessionRhythm, type SessionTimelineSegment } from '@/logic/session'
import { InfoTip } from './InfoTip'
import { MinusIcon, PencilIcon, PlusIcon } from './icons'

const PRESETS: readonly { focus: number; brk: number }[] = [
  { focus: 25, brk: 5 },
  { focus: 50, brk: 10 },
  { focus: 90, brk: 20 },
]

const CUSTOM_INDEX = PRESETS.length

const WHEEL_RADIUS = 40
const WHEEL_CIRCUMFERENCE = 2 * Math.PI * WHEEL_RADIUS

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Total legible: "85 min" o "1 h 25 min" a partir de una hora. */
function formatTotal(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }

  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

interface SessionTimesProps {
  focusMin: number
  breakMin: number
  rhythm: SessionRhythm
  /** Modo con pausas: el switch "Repetir en ciclos" está activo. */
  cyclesActive: boolean
  cycles: number
  longBreaks: boolean
  longBreakEvery: number
  longBreakMin: number
  strictPause: boolean
  openEnded: boolean
  onOpenEndedChange: (enabled: boolean) => void
  onPreset: (preset: { focus: number; brk: number }) => void
  onFocusChange: (value: number) => void
  onBreakChange: (value: number) => void
  onCyclesToggle: (enabled: boolean) => void
  onCyclesChange: (value: number) => void
  onLongBreaksToggle: (enabled: boolean) => void
  onLongBreakEveryChange: (value: number) => void
  onLongBreakMinChange: (value: number) => void
  onStrictPauseToggle: (enabled: boolean) => void
}

interface NumberFieldProps {
  /** Nombre accesible del campo y de sus botones. */
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

/**
 * Número compacto con −/+ discretos y edición a mano: se puede escribir el
 * entero que se quiera y se ajusta a los límites al salir del campo.
 */
function NumberField({ label, value, min, max, step = 1, unit, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value))
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) {
      setDraft(String(value))
    }
  }, [value])

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10)
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : value
    if (next !== value) {
      onChange(next)
    }
    setDraft(String(next))
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 3)
    setDraft(digits)
    if (digits !== '') {
      onChange(clamp(Number(digits), min, max))
    }
  }

  return (
    <span className="num-field">
      <button
        type="button"
        className="num-field__btn"
        onClick={() => onChange(clamp(value - step, min, max))}
        disabled={value <= min}
        aria-label={`Reducir ${label}`}
      >
        <MinusIcon />
      </button>

      <span className="num-field__value">
        <input
          className="num-field__input"
          value={draft}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={label}
          style={{ width: `${Math.max(1, draft.length)}ch` }}
          onFocus={() => {
            editing.current = true
          }}
          onChange={handleChange}
          onBlur={() => {
            editing.current = false
            commit(draft)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
        {unit && <span className="num-field__unit">{unit}</span>}
      </span>

      <button
        type="button"
        className="num-field__btn"
        onClick={() => onChange(clamp(value + step, min, max))}
        disabled={value >= max}
        aria-label={`Aumentar ${label}`}
      >
        <PlusIcon />
      </button>
    </span>
  )
}

interface SwitchProps {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function Switch({ checked, label, onChange, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="session-switch-control"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="session-switch-control__knob" aria-hidden="true" />
    </button>
  )
}

interface CycleStepperProps {
  value: number
  onChange: (value: number) => void
}

function CycleStepper({ value, onChange }: CycleStepperProps) {
  return (
    <div className="session-stepper" role="group" aria-label="Cantidad de ciclos">
      <button
        type="button"
        className="session-stepper__btn"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Reducir cantidad de ciclos"
      >
        <MinusIcon />
      </button>

      <span className="session-stepper__value" aria-live="polite">
        {value}
      </span>

      <button
        type="button"
        className="session-stepper__btn"
        onClick={() => onChange(Math.min(SESSION_MAX_POMODOROS, value + 1))}
        disabled={value >= SESSION_MAX_POMODOROS}
        aria-label="Aumentar cantidad de ciclos"
      >
        <PlusIcon />
      </button>
    </div>
  )
}

interface SessionWheelProps {
  segments: readonly SessionTimelineSegment[]
  total: number
}

/** Rueda del resumen: cada tramo ocupa un arco proporcional a sus minutos. */
function SessionWheel({ segments, total }: SessionWheelProps) {
  const safeTotal = Math.max(1, total)
  const gap = segments.length > 12 ? 1.5 : 3
  const arcs = segments.map((segment, index) => {
    const start = segments
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.minutos / safeTotal) * WHEEL_CIRCUMFERENCE, 0)
    const length = (segment.minutos / safeTotal) * WHEEL_CIRCUMFERENCE
    const visible = Math.max(0.5, length - gap)

    return {
      key: `${segment.tipo}-${index}`,
      tipo: segment.tipo,
      length: visible,
      offset: -(start + gap / 2),
    }
  })

  return (
    <div className="session-wheel" role="img" aria-label={`Total de la sesión: ${total} minutos`}>
      <svg className="session-wheel__svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="session-wheel__track" cx="50" cy="50" r={WHEEL_RADIUS} />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            className={`session-wheel__arc session-wheel__arc--${arc.tipo}`}
            cx="50"
            cy="50"
            r={WHEEL_RADIUS}
            strokeDasharray={`${arc.length} ${WHEEL_CIRCUMFERENCE - arc.length}`}
            strokeDashoffset={arc.offset}
          />
        ))}
      </svg>

      <span className="session-wheel__center" aria-hidden="true">
        <span className="session-wheel__total">{total}</span>
        <span className="session-wheel__unit">min</span>
      </span>
    </div>
  )
}

interface SessionTimelineProps {
  segments: readonly SessionTimelineSegment[]
  total: number
}

const SESSION_SEGMENT_WORDS: Record<SessionTimelineSegment['tipo'], string> = {
  enfoque: 'enfoque',
  descanso: 'descanso',
  descansoLargo: 'pausa larga',
}

/** Línea de tiempo horizontal con un tramo proporcional por bloque. */
function SessionTimeline({ segments, total }: SessionTimelineProps) {
  const label = segments
    .map(
      (segment) =>
        `${segment.minutos} ${segment.minutos === 1 ? 'minuto' : 'minutos'} de ${SESSION_SEGMENT_WORDS[segment.tipo]}`,
    )
    .join(', ')

  return (
    <div className="session-timeline" role="img" aria-label={label}>
      {segments.map((segment, index) => {
        const share = total > 0 ? segment.minutos / total : 0
        return (
          <span
            key={`${segment.tipo}-${index}`}
            className={`session-timeline__segment session-timeline__segment--${segment.tipo}`}
            style={{ flexGrow: segment.minutos }}
          >
            {share >= 0.06 && <span className="session-timeline__value">{segment.minutos}</span>}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Sección "Tiempos" de la card de nueva sesión: presets segmentados, ajustes
 * en una card y resumen con rueda, leyenda y línea de tiempo. Todos los
 * números salen de `sessionTimeline`, la misma función que usa el ritmo.
 */
export function SessionTimes({
  focusMin,
  breakMin,
  rhythm,
  cyclesActive,
  cycles,
  longBreaks,
  longBreakEvery,
  longBreakMin,
  strictPause,
  openEnded,
  onOpenEndedChange,
  onPreset,
  onFocusChange,
  onBreakChange,
  onCyclesToggle,
  onCyclesChange,
  onLongBreaksToggle,
  onLongBreakEveryChange,
  onLongBreakMinChange,
  onStrictPauseToggle,
}: SessionTimesProps) {
  const [custom, setCustom] = useState(
    () => !PRESETS.some((preset) => preset.focus === focusMin && preset.brk === breakMin),
  )
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const canOpenEnded = focusMin >= Math.min(...availableFocusMinutes())

  const segments = sessionTimeline(rhythm)
  const total = segments.reduce((sum, segment) => sum + segment.minutos, 0)
  const focusTotal = segments
    .filter((segment) => segment.tipo === 'enfoque')
    .reduce((sum, segment) => sum + segment.minutos, 0)
  const shortBreakTotal = segments
    .filter((segment) => segment.tipo === 'descanso')
    .reduce((sum, segment) => sum + segment.minutos, 0)
  const longBreakTotal = segments
    .filter((segment) => segment.tipo === 'descansoLargo')
    .reduce((sum, segment) => sum + segment.minutos, 0)

  const presetIndex = PRESETS.findIndex(
    (preset) => preset.focus === focusMin && preset.brk === breakMin,
  )
  const selectedIndex = !custom && presetIndex >= 0 ? presetIndex : CUSTOM_INDEX

  const chooseOption = (index: number) => {
    if (index === CUSTOM_INDEX) {
      setCustom(true)
      return
    }

    onPreset(PRESETS[index])
    setCustom(false)
  }

  const handleRadioKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = PRESETS.length + 1
    let next: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (selectedIndex + 1) % count
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (selectedIndex - 1 + count) % count
    } else if (event.key === 'Home') {
      next = 0
    } else if (event.key === 'End') {
      next = count - 1
    }

    if (next === null) {
      return
    }

    event.preventDefault()
    chooseOption(next)
    optionRefs.current[next]?.focus()
  }

  return (
    <section className="session-section session-times" aria-label="Tiempos">
      <h3 className="session-times__title">Tiempos</h3>

      <div
        className="session-rhythm"
        role="radiogroup"
        aria-label="Ritmo de la sesión"
        onKeyDown={handleRadioKeyDown}
      >
        {PRESETS.map((preset, index) => (
          <button
            key={`${preset.focus}-${preset.brk}`}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={selectedIndex === index}
            tabIndex={selectedIndex === index ? 0 : -1}
            className="session-rhythm__option"
            onClick={() => chooseOption(index)}
          >
            {preset.focus} / {preset.brk}
          </button>
        ))}

        <button
          ref={(element) => {
            optionRefs.current[CUSTOM_INDEX] = element
          }}
          type="button"
          role="radio"
          aria-checked={selectedIndex === CUSTOM_INDEX}
          tabIndex={selectedIndex === CUSTOM_INDEX ? 0 : -1}
          className="session-rhythm__option"
          onClick={() => chooseOption(CUSTOM_INDEX)}
        >
          <PencilIcon className="session-rhythm__icon" />
          Otro
        </button>
      </div>

      {custom && (
        <div className="time-fields">
          <div className="time-field">
            <span className="time-field__label">Enfoque</span>
            <NumberField
              label="Minutos de enfoque"
              value={focusMin}
              min={SESSION_MIN_FOCUS_MIN}
              max={SESSION_MAX_FOCUS_MIN}
              step={SESSION_FOCUS_STEP}
              unit="min"
              onChange={onFocusChange}
            />
          </div>

          <div className="time-field">
            <span className="time-field__label">Descanso</span>
            <NumberField
              label="Minutos de descanso"
              value={breakMin}
              min={SESSION_MIN_BREAK_MIN}
              max={SESSION_MAX_BREAK_MIN}
              step={SESSION_BREAK_STEP}
              unit="min"
              onChange={onBreakChange}
            />
          </div>
        </div>
      )}

      <div className="session-settings">
        {custom && (
          <>
            <div className="session-setting">
              <span className="session-setting__label">
                Ciclos indefinidos
                <InfoTip
                  label="Más información sobre ciclos indefinidos"
                  text="No hay objetivo fijo: después de cada bloque elegís el próximo árbol o terminás la sesión."
                />
              </span>
              <Switch
                checked={openEnded}
                label="Ciclos indefinidos"
                onChange={onOpenEndedChange}
                disabled={!canOpenEnded}
              />
            </div>
            {!canOpenEnded && (
              <div className="session-setting session-setting--sub">
                <span className="session-setting__hint">
                  Necesitás al menos 25 min por ciclo para plantar un árbol.
                </span>
              </div>
            )}
          </>
        )}

        {!openEnded && (
          <div className="session-setting">
            <span className="session-setting__label">Repetir en ciclos</span>
            <Switch checked={cyclesActive} label="Repetir en ciclos" onChange={onCyclesToggle} />
          </div>
        )}

        {!openEnded && cyclesActive && (
          <div className="session-setting">
            <span className="session-setting__label">Cantidad de ciclos</span>
            <CycleStepper value={cycles} onChange={onCyclesChange} />
          </div>
        )}

        <div className="session-setting">
          <span className="session-setting__label">
            Pausas largas
            <InfoTip
              label="Más información sobre las pausas largas"
              text="Una pausa más larga cada cierta cantidad de bloques. Elegí cada cuántos bloques va y cuánto dura."
            />
          </span>
          <Switch checked={longBreaks} label="Pausas largas" onChange={onLongBreaksToggle} />
        </div>

        {cyclesActive && longBreaks && (
          <>
            <div className="session-setting session-setting--sub">
              <span className="session-setting__label">Cada cuántos ciclos</span>
              <NumberField
                label="Cada cuántos bloques"
                value={longBreakEvery}
                min={1}
                max={SESSION_MAX_POMODOROS}
                unit="ciclos"
                onChange={onLongBreakEveryChange}
              />
            </div>

            <div className="session-setting session-setting--sub">
              <span className="session-setting__label">Duración de la pausa larga</span>
              <NumberField
                label="Minutos de pausa larga"
                value={longBreakMin}
                min={SESSION_MIN_LONG_BREAK_MIN}
                max={SESSION_MAX_LONG_BREAK_MIN}
                step={SESSION_LONG_BREAK_STEP}
                unit="min"
                onChange={onLongBreakMinChange}
              />
            </div>
          </>
        )}

        <div className="session-setting">
          <span className="session-setting__label">
            Pausa estricta
            <InfoTip
              label="Más información sobre la pausa estricta"
              text="Si la activás, el botón de pausa desaparece: una vez empezado el bloque no se puede pausar."
            />
          </span>
          <Switch checked={strictPause} label="Pausa estricta" onChange={onStrictPauseToggle} />
        </div>
      </div>

      {openEnded ? (
        <div className="session-summary-card">
          <div className="session-summary-card__top">
            <SessionWheel segments={[{ tipo: 'enfoque', minutos: focusMin }]} total={focusMin} />
            <div className="session-summary-card__legend">
              <span className="session-summary-card__total">Sin límite de ciclos</span>
            </div>
          </div>
          <div className="session-summary-card__note">
            Después de cada bloque elegís el próximo árbol o terminás la sesión.
          </div>
        </div>
      ) : (
        <div className="session-summary-card">
          <div className="session-summary-card__top">
            <SessionWheel segments={segments} total={total} />

            <div className="session-summary-card__legend">
              <span className="session-summary-card__legend-row">
                <span
                  className="session-summary-card__dot session-summary-card__dot--focus"
                  aria-hidden="true"
                />
                Enfoque {focusTotal} min
              </span>

              {shortBreakTotal > 0 || longBreakTotal === 0 ? (
                <span className="session-summary-card__legend-row">
                  <span
                    className="session-summary-card__dot session-summary-card__dot--break"
                    aria-hidden="true"
                  />
                  Descanso {shortBreakTotal} min
                </span>
              ) : null}

              {longBreakTotal > 0 ? (
                <span className="session-summary-card__legend-row">
                  <span
                    className="session-summary-card__dot session-summary-card__dot--long-break"
                    aria-hidden="true"
                  />
                  Pausa larga {longBreakTotal} min
                </span>
              ) : null}

              <span className="session-summary-card__total">{formatTotal(total)} en total</span>
            </div>
          </div>

          <SessionTimeline segments={segments} total={total} />
        </div>
      )}
    </section>
  )
}
