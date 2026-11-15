import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { finalStage, speciesConfig } from '@/config/species'
import {
  SESSION_BREAK_STEP,
  SESSION_DESCRIPTION_MAX_LENGTH,
  SESSION_FOCUS_STEP,
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
import { useStore } from '@/state/store'
import type { NewSessionInput, SessionMode, TreeSpecies } from '@/state/types'
import { CloseIcon, MinusIcon, PineIcon, PlusIcon } from './icons'
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

interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

function Stepper({ label, value, min, max, step, unit, onChange }: StepperProps) {
  const display = unit ? `${value} ${unit}` : String(value)
  return (
    <div className="stepper">
      <span className="stepper__label">{label}</span>
      <div className="stepper__row">
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(clamp(value - step, min, max))}
          disabled={value <= min}
          aria-label={`Reducir ${label}`}
        >
          <MinusIcon />
        </button>
        <span className="stepper__value">{display}</span>
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(clamp(value + step, min, max))}
          disabled={value >= max}
          aria-label={`Aumentar ${label}`}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  )
}

export function SessionCreateDialog({
  open,
  forestName,
  onClose,
  onStart,
}: SessionCreateDialogProps) {
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyScrollbar = useEdgeScrollbar<HTMLFormElement>()
  const settings = useStore((state) => state.settings)
  // El diálogo se monta solo cuando abre (render condicional en App),
  // así que el estado inicial nace de los ajustes y no hace falta resetear.
  const initialFocus = clamp(settings.focusMin, SESSION_MIN_FOCUS_MIN, SESSION_MAX_FOCUS_MIN)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tasks, setTasks] = useState<string[]>([])
  const [mode, setMode] = useState<SessionMode>('breaks')
  const [focusMin, setFocusMin] = useState(initialFocus)
  const [breakMin, setBreakMin] = useState(() =>
    clamp(settings.breakMin, SESSION_MIN_BREAK_MIN, SESSION_MAX_BREAK_MIN),
  )
  const [targetPomodoros, setTargetPomodoros] = useState(3)
  const [queue, setQueue] = useState<TreeSpecies[]>(() => suggestPlanting(initialFocus * 3))
  const [custom, setCustom] = useState(false)

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
  // El descanso largo no se expone en la maqueta: se toma de los ajustes.
  const longBreakMin = clamp(
    settings.longBreakMin,
    SESSION_MIN_LONG_BREAK_MIN,
    SESSION_MAX_LONG_BREAK_MIN,
  )
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
  const showFocusBreakSteppers = custom || activePreset === null

  const sobra = Math.max(0, budget - totalCost)
  const falta = Math.max(0, totalCost - budget)
  const barPct = budget > 0 ? Math.min(1, totalCost / budget) : 0
  const totalClock =
    focusMin * targetPomodoros +
    (mode === 'breaks' ? Math.max(0, targetPomodoros - 1) * breakMin : 0)
  const canStart = queue.length > 0 && totalCost <= budget

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

  const handleModeChange = (nextMode: SessionMode) => {
    const nextTarget = nextMode === 'continuous' ? 1 : targetPomodoros
    setMode(nextMode)
    setTargetPomodoros(nextTarget)

    if (nextMode === 'continuous') {
      setQueue(suggestPlanting(focusMin))
    }
  }

  const handlePreset = (preset: { focus: number; brk: number }) => {
    setFocusMin(preset.focus)
    setBreakMin(preset.brk)
    setCustom(false)
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
        className="card card--roomy forest-dialog session-dialog my-auto w-full max-w-2xl"
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
              <p className="type-micro type-muted">
                opcional · se llama “Sesión N” del día si se deja vacía
              </p>
            </div>

            <div className="forest-field">
              <div className="forest-field__label-row">
                <label className="settings-label" htmlFor="session-description">
                  <span className="type-body">Descripción</span>
                </label>
                <span className="type-micro type-muted">
                  {description.length}/{SESSION_DESCRIPTION_MAX_LENGTH} · opcional
                </span>
              </div>
              <textarea
                id="session-description"
                className="field-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={SESSION_DESCRIPTION_MAX_LENGTH}
                rows={2}
                placeholder="Qué querés tener claro al terminar."
              />
            </div>

            <div className="forest-field">
              <div className="forest-field__label-row">
                <span className="settings-label">
                  <span className="type-body">Objetivos</span>
                </span>
                <span className="type-micro type-muted">opcional</span>
              </div>

              {tasks.length > 0 && (
                <ul className="session-objectives">
                  {tasks.map((task, index) => (
                    <li key={`objective-${index}`} className="session-objective">
                      <span className="session-objective__mark" aria-hidden="true" />
                      <input
                        className="field-input session-objective__input"
                        value={task}
                        onChange={(event) => updateTask(index, event.target.value)}
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
              <div className="session-mode" role="group" aria-label="Modo de la sesión">
                <button
                  type="button"
                  className="session-mode__option"
                  aria-pressed={mode === 'breaks'}
                  onClick={() => handleModeChange('breaks')}
                >
                  Con descansos
                </button>
                <button
                  type="button"
                  className="session-mode__option"
                  aria-pressed={mode === 'continuous'}
                  onClick={() => handleModeChange('continuous')}
                >
                  Sin descansos
                </button>
              </div>
            </div>

            <div className="session-presets" aria-label="Ritmos rápidos">
              {PRESETS.map((preset) => (
                <button
                  key={`${preset.focus}-${preset.brk}`}
                  type="button"
                  className="session-preset"
                  aria-pressed={activePreset === preset}
                  onClick={() => handlePreset(preset)}
                >
                  {preset.focus} / {preset.brk}
                </button>
              ))}
              <button
                type="button"
                className="session-preset"
                aria-pressed={showFocusBreakSteppers}
                onClick={() => setCustom(true)}
              >
                Personalizado
              </button>
            </div>

            <div className="session-steppers">
              {showFocusBreakSteppers && (
                <Stepper
                  label="Enfoque"
                  value={focusMin}
                  min={SESSION_MIN_FOCUS_MIN}
                  max={SESSION_MAX_FOCUS_MIN}
                  step={SESSION_FOCUS_STEP}
                  unit="min"
                  onChange={(value) => {
                    setFocusMin(value)
                    setCustom(true)
                  }}
                />
              )}
              {showFocusBreakSteppers && mode === 'breaks' && (
                <Stepper
                  label="Pausa"
                  value={breakMin}
                  min={SESSION_MIN_BREAK_MIN}
                  max={SESSION_MAX_BREAK_MIN}
                  step={SESSION_BREAK_STEP}
                  unit="min"
                  onChange={(value) => {
                    setBreakMin(value)
                    setCustom(true)
                  }}
                />
              )}
              {mode === 'breaks' && (
                <Stepper
                  label="Ciclos"
                  value={targetPomodoros}
                  min={1}
                  max={SESSION_MAX_POMODOROS}
                  step={1}
                  onChange={setTargetPomodoros}
                />
              )}
            </div>

            {mode === 'continuous' && (
              <p className="type-caption type-muted">
                Sesión continua: un solo bloque, sin pausas.
              </p>
            )}

            <div className="session-summary">
              <span>
                <strong>{focusMin * targetPomodoros}</strong> min de enfoque
              </span>
              <span>
                <strong>{totalClock}</strong> min en total
              </span>
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
                <span>
                  {sobra > 0 ? `Sobran ${sobra} min` : falta > 0 ? `Faltan ${falta} min` : 'Justo'}
                </span>
              </div>
            </div>

            <div className="session-messages">
              {validation.errors.map((error) => (
                <p key={error} className="session-message session-message--error">
                  {error}
                </p>
              ))}
              {validation.warnings.map((warning) => (
                <p key={warning} className="session-message session-message--warning">
                  {warning}
                </p>
              ))}
              {validation.ok && validation.warnings.length === 0 && (
                <p className="session-message session-message--ok">
                  La cola entra justa en el presupuesto.
                </p>
              )}
            </div>
          </section>
        </form>

        <div className="forest-dialog__actions">
          <span className="session-dialog__hint type-micro type-muted">
            {mode === 'continuous'
              ? 'Sin descansos: la sesión no se puede retomar.'
              : 'Con descansos: podés retomar desde una pausa.'}
          </span>
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
