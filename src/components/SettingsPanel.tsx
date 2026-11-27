import { useState } from 'react'
import { playTone } from '@/logic/alarm'
import { getNotificationPermission, requestNotificationPermission } from '@/logic/notifications'
import { useEdgeScrollbar } from '@/hooks/useEdgeScrollbar'
import type { AlarmTone, PomodoroSettings } from '@/state/types'
import { BackIcon, VolumeIcon } from './icons'
import { Select } from './Select'

interface SettingsPanelProps {
  settings: PomodoroSettings
  onChange: (patch: Partial<PomodoroSettings>) => void
  onBack: () => void
}

const TONE_LABELS: Record<AlarmTone, string> = {
  bell: 'Campana',
  chime: 'Campanilla',
  pulse: 'Pulso',
}

const TONE_OPTIONS = (Object.keys(TONE_LABELS) as AlarmTone[]).map((tone) => ({
  value: tone,
  label: TONE_LABELS[tone],
}))

/** Cuando el mouse entra en la zona del borde, el scrollbar se hace visible. */
export function SettingsPanel({ settings, onChange, onBack }: SettingsPanelProps) {
  const [permission, setPermission] = useState(getNotificationPermission())
  const scrollbar = useEdgeScrollbar<HTMLDivElement>()

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission()
    setPermission(result)
  }

  // Activar el switch es un gesto del usuario: es el mejor momento para
  // pedir el permiso, en vez de dejarlo para una sesión que ya terminó.
  const handleNotificationChange = async (enabled: boolean) => {
    onChange({ notification: enabled })
    if (enabled && permission === 'default') {
      const result = await requestNotificationPermission()
      setPermission(result)
    }
  }

  const handleReset = () => {
    onChange({
      alarmTone: 'bell',
      notification: true,
      alarmVolume: 0.6,
      autoStartBreak: false,
      autoStartFocus: false,
    })
  }

  return (
    <div
      onPointerMove={scrollbar.onPointerMove}
      onPointerLeave={scrollbar.onPointerLeave}
      className={`settings-panel edge-scrollbar flex flex-col gap-4${scrollbar.nearEdge ? ' is-scrollbar-visible' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="icon-button"
          onClick={onBack}
          aria-label="Volver al temporizador"
          title="Volver"
        >
          <BackIcon />
        </button>
        <h2 className="type-title">Ajustes generales</h2>
      </div>

      <section className="flex flex-col gap-2">
        <p className="eyebrow">Alarma</p>
        <div className="flex items-center justify-between gap-3">
          <span className="type-body">Tono</span>
          <div className="flex items-center gap-1">
            <Select
              value={settings.alarmTone}
              options={TONE_OPTIONS}
              onChange={(value) => onChange({ alarmTone: value as AlarmTone })}
              ariaLabel="Tono de la alarma"
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => playTone(settings.alarmTone, settings.alarmVolume)}
              aria-label="Probar tono"
              title="Probar tono"
            >
              <VolumeIcon />
            </button>
          </div>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="type-body">Volumen</span>
          <input
            type="range"
            className="settings-range"
            min={0}
            max={1}
            step={0.1}
            value={settings.alarmVolume}
            onChange={(e) => onChange({ alarmVolume: Number(e.target.value) })}
            aria-label="Volumen de la alarma"
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="type-body">Notificación del navegador</span>
          <input
            type="checkbox"
            className="settings-check"
            aria-label="Notificación del navegador"
            checked={settings.notification}
            onChange={(e) => void handleNotificationChange(e.target.checked)}
          />
        </label>
        {settings.notification && permission !== 'granted' && (
          <button type="button" className="btn btn-secondary" onClick={handleRequestPermission}>
            Permitir notificaciones
          </button>
        )}
        {permission === 'denied' && (
          <p className="type-body type-muted">Notificaciones bloqueadas en el navegador.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <p className="eyebrow">Automático</p>
        <label className="flex items-center justify-between gap-3">
          <span className="type-body">Auto-iniciar descanso</span>
          <input
            type="checkbox"
            className="settings-check"
            aria-label="Auto-iniciar descanso"
            checked={settings.autoStartBreak}
            onChange={(e) => onChange({ autoStartBreak: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="type-body">Auto-iniciar pomodoro</span>
          <input
            type="checkbox"
            className="settings-check"
            aria-label="Auto-iniciar pomodoro"
            checked={settings.autoStartFocus}
            onChange={(e) => onChange({ autoStartFocus: e.target.checked })}
          />
        </label>
      </section>

      <button type="button" className="settings-reset" onClick={handleReset}>
        Restablecer valores
      </button>
    </div>
  )
}
