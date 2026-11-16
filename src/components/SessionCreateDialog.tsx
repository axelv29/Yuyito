import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { finalStage, speciesConfig } from '@/config/species'
import {
  SESSION_BREAK_STEP,
  SESSION_DESCRIPTION_MAX_LENGTH,
  SESSION_FOCUS_STEP,
  SESSION_LONG_BREAK_STEP,
  SESSION_MAX_BREAK_MIN,
  SESSION_MAX_FOCUS_MIN,
  SESSION_MAX_LONG_BREAK_MIN,
  SESSION_MAX_POMODOROS,
  SESSION_MAX_TASKS,
  SESSION_MAX_TREES,
  SESSION_MIN_BREAK_MIN,
  SESSION_MIN_FOCUS_MIN,
  SESSION_MIN_LONG_BREAK_MIN,
  SESSION_TASK_MAX_LENGTH,
  SESSION_TITLE_MAX_LENGTH,
} from '@/config/session'
import { useEdgeScrollbar } from '@/hooks/useEdgeScrollbar'
import { suggestPlanting, validatePlanting } from '@/logic/planting'
import { sessionTotalMinutes } from '@/logic/session'
import { useStore } from '@/state/store'
import type { NewSessionInput, SessionMode, TreeSpecies } from '@/state/types'
import { CloseIcon, MinusIcon, PineIcon, PlusIcon } from './icons'
import { InfoTip } from './InfoTip'
import { SessionTimeRing } from './SessionTimeRing'
import { TreePreview } from './TreePreview'

interface SessionCreateDialogProps {
  open: boolean
  forestName: string
  onClose: () => void
  onStart: (input: NewSessionInput) => void
}

const SPECIES_ORDER: readonly TreeSpecies[] = ['pino', 'abedul', 'roble', 'ceibo']

const PRESETS: readonly { focus: number; brk: number }[] = [
  { focus: 25, brk: 5 },
  { focus: 50, brk: 10 },
  { focus: 90, brk: 20 },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
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

export function SessionCreateDialog({
  open,
  forestName,
  onClose,
  onStart,
}: SessionCreateDialogProps) {
  const titleRef = useRef<HTMLInputElement>(null)
  const taskRefs = useRef<Array<HTMLInputElement | null>>([])
  const bodyScrollbar = useEdgeScrollbar<HTMLFormElement>()
  const settings = useStore((state) => state.settings)
  // El diálogo se monta solo cuando abre (render condicional en App),
  // así que el estado inicial nace de los ajustes y no hace falta resetear.
  const initialFocus = clamp(settings.focusMin, SESSION_MIN_FOCUS_MIN, SESSION_MAX_FOCUS_MIN)
  const initialBreak = clamp(settings.breakMin, SESSION_MIN_BREAK_MIN, SESSION_MAX_BREAK_MIN)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tasks, setTasks] = useState<string[]>([])
  const [mode, setMode] = useState<SessionMode>('breaks')
  const [focusMin, setFocusMin] = useState(initialFocus)
  const [breakMin, setBreakMin] = useState(initialBreak)
  // Personalizado se activa solo si los ajustes no caen en ningún preset.
  const [custom, setCustom] = useState(
    () => !PRESETS.some((preset) => preset.focus === initialFocus && preset.brk === initialBreak),
  )
  const [targetPomodoros, setTargetPomodoros] = useState(3)
  const [longBreaks, setLongBreaks] = useState(false)
  const [strictPause, setStrictPause] = useState(settings.strictPause)
  const [longBreakEvery, setLongBreakEvery] = useState(() =>
    clamp(settings.longBreakEvery, 1, SESSION_MAX_POMODOROS),
  )
  const [longBreakMin, setLongBreakMin] = useState(() =>
    clamp(settings.longBreakMin, SESSION_MIN_LONG_BREAK_MIN, SESSION_MAX_LONG_BREAK_MIN),
  )
  const [queue, setQueue] = useState<TreeSpecies[]>(() => suggestPlanting(initialFocus * 3))

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  const budget = focusMin * targetPomodoros
  const rhythm = useMemo(
    () => ({
      focusMin,
      breakMin: mode === 'breaks' ? breakMin : 0,
      cycles: targetPomodoros,
      longBreakMin: mode === 'breaks' && longBreaks ? longBreakMin : 0,
      longBreakEvery: mode === 'breaks' && longBreaks ? longBreakEvery : 0,
    }),
    [breakMin, focusMin, longBreakEvery, longBreakMin, longBreaks, mode, targetPomodoros],
  )
  const totalClock = useMemo(() => sessionTotalMinutes(rhythm), [rhythm])

  const totalCost = useMemo(
    () => queue.reduce((sum, species) => sum + speciesConfig(species).minutes, 0),
    [queue],
  )
  const validation = useMemo(
    () =>
      validatePlanting({
        focusMin,
        targetPomodoros,
        planting: queue,
      }),
    [focusMin, queue, targetPomodoros],
  )

  const activePreset = useMemo(
    () => PRESETS.find((preset) => preset.focus === focusMin && preset.brk === breakMin) ?? null,
    [breakMin, focusMin],
  )

  const sobra = Math.max(0, budget - totalCost)
  const falta = Math.max(0, totalCost - budget)
  const barPct = budget > 0 ? Math.min(1, totalCost / budget) : 0
  const canStart = queue.length > 0 && totalCost <= budget
  // El tiempo sobrante se explica en el tooltip de la barra, no en un párrafo.
  const messages = validation.warnings.filter((warning) => !warning.startsWith('Sobran '))

  if (!open) {
    return null
  }

  const updateTask = (index: number, value: string) => {
    setTasks((current) => current.map((task, itemIndex) => (itemIndex === index ? value : task)))
  }

  const addTask = () => {
    setTasks((current) => (current.length >= SESSION_MAX_TASKS ? current : [...current, '']))
  }

  const removeTask = (index: number) => {
    setTasks((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const addSpecies = (species: TreeSpecies) => {
    const cost = speciesConfig(species).minutes
    if (queue.length >= SESSION_MAX_TREES || totalCost + cost > budget) {
      return
    }
    setQueue((current) => [...current, species])
  }

  const removeSpecies = (species: TreeSpecies) => {
    setQueue((current) => {
      const index = current.lastIndexOf(species)
      if (index === -1) {
        return current
      }
      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const handleCyclesToggle = (enabled: boolean) => {
    if (enabled) {
      const nextTarget = 3
      setMode('breaks')
      setTargetPomodoros(nextTarget)
      setQueue(suggestPlanting(focusMin * nextTarget))
      return
    }

    setMode('continuous')
    setTargetPomodoros(1)
    setQueue(suggestPlanting(focusMin))
  }

  const handlePreset = (preset: { focus: number; brk: number }) => {
    setCustom(false)
    setFocusMin(preset.focus)
    setBreakMin(preset.brk)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canStart) {
      return
    }

    onStart({
      title: title.trim() || undefined,
      description: description.trim() || null,
      tasks: tasks.map((task) => task.trim()).filter(Boolean),
      focusMin,
      breakMin,
      longBreakMin,
      longBreakEvery: mode === 'breaks' && longBreaks ? longBreakEvery : 0,
      strictPause,
      targetPomodoros,
      mode,
      planting: queue,
    })
    handleClose()
  }

  return (
    <div
      className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className="card card--roomy forest-dialog session-dialog my-auto w-full max-w-[30rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-dialog-title"
      >
        <div className="forest-dialog__head">
          <div className="flex min-w-0 items-start gap-3">
            <span className="session-icon forest-dialog__icon">
              <PineIcon />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">{forestName}</p>
              <h2 id="session-dialog-title" className="type-title-lg">
                Nueva sesión
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="icon-button forest-dialog__close"
            onClick={handleClose}
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>

        <form
          id="session-form"
          className={`session-dialog__body edge-scrollbar${bodyScrollbar.nearEdge ? ' is-scrollbar-visible' : ''}`}
          onSubmit={handleSubmit}
          onPointerMove={bodyScrollbar.onPointerMove}
          onPointerLeave={bodyScrollbar.onPointerLeave}
        >
          <section className="session-section" aria-label="Datos de la sesión">
            <div className="forest-field">
              <label className="settings-label" htmlFor="session-title">
                <span className="type-body">Nombre de la sesión</span>
              </label>
              <input
                ref={titleRef}
                id="session-title"
                className="field-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={SESSION_TITLE_MAX_LENGTH}
                placeholder="Terminar el TP, estudiar para el final…"
                autoComplete="off"
              />
            </div>

            <div className="forest-field">
              <div className="forest-field__label-row">
                <label className="settings-label" htmlFor="session-description">
                  <span className="type-body">Descripción</span>
                </label>
                <span className="type-micro type-muted">
                  {description.length}/{SESSION_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="session-description"
                className="field-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={SESSION_DESCRIPTION_MAX_LENGTH}
                placeholder="Qué querés tener claro al terminar."
              />
            </div>

            <div className="forest-field">
              <span className="settings-label">
                <span className="type-body">Objetivos</span>
              </span>

              {tasks.length > 0 && (
                <ul className="session-objectives">
                  {tasks.map((task, index) => (
                    <li key={`objective-${index}`} className="session-objective">
                      <span className="session-objective__mark" aria-hidden="true" />
                      <input
                        ref={(element) => {
                          taskRefs.current[index] = element
                        }}
                        className="field-input session-objective__input"
                        value={task}
                        onChange={(event) => updateTask(index, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') {
                            return
                          }
                          // Mientras se escribe un objetivo, Enter agrega otro
                          // en vez de empezar la sesión; sin texto escrito el
                          // comportamiento sigue siendo el de siempre.
                          if (tasks[index].trim().length === 0) {
                            return
                          }
                          event.preventDefault()
                          if (tasks.length >= SESSION_MAX_TASKS) {
                            return
                          }
                          const nextIndex = tasks.length
                          setTasks((current) => [...current, ''])
                          window.requestAnimationFrame(() => taskRefs.current[nextIndex]?.focus())
                        }}
                        maxLength={SESSION_TASK_MAX_LENGTH}
                        placeholder="Un paso concreto"
                        aria-label={`Objetivo ${index + 1}`}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="icon-button session-objective__remove"
                        onClick={() => removeTask(index)}
                        aria-label={`Quitar objetivo ${index + 1}`}
                      >
                        <CloseIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {tasks.length < SESSION_MAX_TASKS && (
                <button
                  type="button"
                  className="btn btn-secondary btn--sm session-add-task"
                  onClick={addTask}
                >
                  <PlusIcon />
                  Agregar objetivo
                </button>
              )}
            </div>
          </section>

          <section className="session-section" aria-label="Tiempos">
            <div className="session-section__head">
              <h3 className="type-title">Tiempos</h3>
            </div>

            <div className="session-time">
              <div className="session-time__main">
                <div className="session-presets" aria-label="Ritmos rápidos">
                  {PRESETS.map((preset) => (
                    <button
                      key={`${preset.focus}-${preset.brk}`}
                      type="button"
                      className="session-preset"
                      aria-pressed={!custom && activePreset === preset}
                      onClick={() => handlePreset(preset)}
                    >
                      {preset.focus} / {preset.brk}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="session-preset"
                    aria-pressed={custom}
                    onClick={() => setCustom(true)}
                  >
                    Personalizado
                  </button>
                </div>

                {/* Enfoque y pausa a mano: solo con el preset Personalizado. */}
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
                        onChange={setFocusMin}
                      />
                    </div>

                    {mode === 'breaks' && (
                      <div className="time-field">
                        <span className="time-field__label">Pausa</span>
                        <NumberField
                          label="Minutos de pausa"
                          value={breakMin}
                          min={SESSION_MIN_BREAK_MIN}
                          max={SESSION_MAX_BREAK_MIN}
                          step={SESSION_BREAK_STEP}
                          unit="min"
                          onChange={setBreakMin}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="session-time__row">
                  <span className="session-switch">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={mode === 'breaks'}
                      className="session-toggle"
                      onClick={() => handleCyclesToggle(mode !== 'breaks')}
                    >
                      <span className="session-toggle__track" aria-hidden="true">
                        <span className="session-toggle__knob" />
                      </span>
                      <span className="session-toggle__label">Activar ciclos</span>
                    </button>
                    <InfoTip
                      label="Más información sobre los ciclos"
                      text="Con ciclos, la sesión alterna bloques de enfoque y pausas, y podés retomarla desde un descanso. Sin ciclos es un solo bloque: si salís, la sesión se cierra."
                    />
                  </span>
                </div>

                {mode === 'breaks' && (
                  <>
                    <div className="session-time__row session-time__row--sub">
                      <div className="session-cycles">
                        <span className="session-cycles__label">Ciclos</span>
                        <NumberField
                          label="Ciclos"
                          value={targetPomodoros}
                          min={1}
                          max={SESSION_MAX_POMODOROS}
                          onChange={setTargetPomodoros}
                        />
                      </div>
                    </div>

                    <div className="session-time__row">
                      <span className="session-switch">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={longBreaks}
                          className="session-toggle"
                          onClick={() => setLongBreaks((value) => !value)}
                        >
                          <span className="session-toggle__track" aria-hidden="true">
                            <span className="session-toggle__knob" />
                          </span>
                          <span className="session-toggle__label">Pausas largas</span>
                        </button>
                        <InfoTip
                          label="Más información sobre las pausas largas"
                          text="Una pausa más larga cada cierta cantidad de bloques. Elegí cada cuántos bloques va y cuánto dura."
                        />
                      </span>
                    </div>

                    {longBreaks && (
                      <div className="session-time__row session-time__row--sub">
                        <div className="session-cycles">
                          <NumberField
                            label="Cada cuántos bloques"
                            value={longBreakEvery}
                            min={1}
                            max={SESSION_MAX_POMODOROS}
                            unit="ciclos"
                            onChange={setLongBreakEvery}
                          />
                          <NumberField
                            label="Minutos de pausa larga"
                            value={longBreakMin}
                            min={SESSION_MIN_LONG_BREAK_MIN}
                            max={SESSION_MAX_LONG_BREAK_MIN}
                            step={SESSION_LONG_BREAK_STEP}
                            unit="min"
                            onChange={setLongBreakMin}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Ajuste básico de pomodoro; el detalle vive en Ajustes. */}
                <div className="session-time__row">
                  <span className="session-switch">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={strictPause}
                      className="session-toggle"
                      onClick={() => setStrictPause((value) => !value)}
                    >
                      <span className="session-toggle__track" aria-hidden="true">
                        <span className="session-toggle__knob" />
                      </span>
                      <span className="session-toggle__label">Pausa estricta</span>
                    </button>
                    <InfoTip
                      label="Más información sobre la pausa estricta"
                      text="Si la activás, pausar equivale a abandonar: se pide confirmación y, si aceptás, el árbol se marchita y el pomodoro no suma minutos."
                    />
                  </span>
                </div>

                <div className="session-summary">
                  <span>
                    <strong>{budget}</strong> min de enfoque
                  </span>
                  {totalClock !== budget && (
                    <span>
                      <strong>{totalClock}</strong> min en total
                    </span>
                  )}
                </div>
              </div>

              <SessionTimeRing rhythm={rhythm} totalMin={totalClock} />
            </div>
          </section>

          <section className="session-section" aria-label="Árboles">
            <div className="session-section__head">
              <h3 className="type-title">Árboles</h3>
              <button
                type="button"
                className="btn btn-secondary btn--sm"
                onClick={() => setQueue(suggestPlanting(budget))}
                disabled={budget <= 0}
              >
                Sugerir
              </button>
            </div>

            <div className="tree-grid">
              {SPECIES_ORDER.map((species) => {
                const config = speciesConfig(species)
                const count = queue.filter((item) => item === species).length
                const cost = config.minutes
                const blocked = totalCost + cost > budget || queue.length >= SESSION_MAX_TREES
                return (
                  <div
                    key={species}
                    className={`tree-card${count > 0 ? ' tree-card--active' : ''}`}
                  >
                    <button
                      type="button"
                      className="tree-card__main"
                      onClick={() => addSpecies(species)}
                      disabled={blocked}
                    >
                      <span className="tree-card__tree">
                        <TreePreview species={species} stage={finalStage(species)} />
                      </span>
                      <span className="tree-card__name">{config.name}</span>
                      <span className="tree-card__cost">{cost} min</span>
                    </button>
                    <div className="tree-card__counter">
                      <button
                        type="button"
                        className="stepper__btn"
                        onClick={() => removeSpecies(species)}
                        disabled={count === 0}
                        aria-label={`Quitar ${config.name}`}
                      >
                        <MinusIcon />
                      </button>
                      <span className="tree-card__count">{count}</span>
                      <button
                        type="button"
                        className="stepper__btn"
                        onClick={() => addSpecies(species)}
                        disabled={blocked}
                        aria-label={`Agregar ${config.name}`}
                      >
                        <PlusIcon />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="alloc">
              <div className="alloc__bar" aria-hidden="true">
                <div
                  className={`alloc__fill${falta > 0 ? ' alloc__fill--over' : ''}`}
                  style={{ width: `${barPct * 100}%` }}
                />
              </div>
              <div className="alloc__meta">
                <span>
                  <strong>{totalCost}</strong> / {budget} min
                </span>
                <span className="alloc__state">
                  {sobra > 0 ? `Sobran ${sobra} min` : falta > 0 ? `Faltan ${falta} min` : 'Justo'}
                  {sobra > 0 && (
                    <InfoTip
                      label="Más información sobre los minutos que sobran"
                      text={`Quedan ${sobra} min de enfoque sin plantar. Podés empezar igual; si abandonás antes de tiempo, el último árbol se marchita.`}
                    />
                  )}
                </span>
              </div>
            </div>

            <div className="session-messages">
              {validation.errors.map((error) => (
                <p key={error} className="session-message session-message--error">
                  {error}
                </p>
              ))}
              {messages.map((warning) => (
                <p key={warning} className="session-message session-message--warning">
                  {warning}
                </p>
              ))}
            </div>
          </section>
        </form>

        <div className="forest-dialog__actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="session-form"
            className="btn btn-primary"
            disabled={!canStart}
          >
            Plantar y empezar
          </button>
        </div>
      </div>
    </div>
  )
}
