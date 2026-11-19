import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { SESSION_TITLE_MAX_LENGTH } from '@/config/session'
import { useAutoGrow } from '@/hooks/useAutoGrow'

interface SessionTitleProps {
  /** Nombre que se muestra: dos renglones como máximo, con puntos suspensivos. */
  text: string
  /** Texto con el que arranca la edición. */
  editText: string
  /** Sin plan guardado no hay dónde dejar el nombre nuevo. */
  editable: boolean
  onSave: (text: string) => void
}

/** Nombre de la sesión: se lee como el título, se edita en el lugar y, si no
 * entra en dos renglones, el nombre completo aparece en un tooltip al pasar el
 * cursor. */
export function SessionTitle({ text, editText, editable, onSave }: SessionTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const textareaRef = useAutoGrow()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const cancelled = useRef(false)

  // El tooltip solo tiene sentido cuando el recorte se está comiendo texto: se
  // mide renglón a renglón y se vuelve a medir si cambia el ancho.
  useLayoutEffect(() => {
    const element = textRef.current
    const wrap = wrapRef.current
    if (!element || !wrap) {
      return
    }

    const sync = () => {
      wrap.toggleAttribute('data-truncated', element.scrollHeight > element.clientHeight + 1)
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text, editing])

  // Al entrar en edición se enfoca el texto completo, con el cursor al final.
  useEffect(() => {
    if (!editing) {
      return
    }

    const element = textareaRef.current
    if (!element) {
      return
    }

    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  }, [editing, textareaRef])

  const startEditing = () => {
    if (!editable) {
      return
    }

    cancelled.current = false
    setDraft(editText)
    setEditing(true)
  }

  const commit = () => {
    const next = draft.replace(/\r?\n/g, ' ').trim()
    if (next) {
      onSave(next)
    }
    setEditing(false)
  }

  const handleBlur = () => {
    if (cancelled.current) {
      cancelled.current = false
      setEditing(false)
      return
    }

    commit()
  }

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelled.current = true
      event.currentTarget.blur()
    }
  }

  const handleTextKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      startEditing()
    }
  }

  if (editing) {
    return (
      <span ref={wrapRef} className="session-title">
        <textarea
          ref={textareaRef}
          className="session-title-input"
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleDraftKeyDown}
          maxLength={SESSION_TITLE_MAX_LENGTH}
          aria-label="Nombre de la sesión"
        />
      </span>
    )
  }

  return (
    <span ref={wrapRef} className="session-title">
      <span
        ref={textRef}
        className="session-title__text"
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        onClick={editable ? startEditing : undefined}
        onKeyDown={editable ? handleTextKeyDown : undefined}
      >
        {text}
      </span>
      <span className="session-title__tip" aria-hidden="true">
        {text}
      </span>
    </span>
  )
}
