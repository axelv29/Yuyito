import { useEffect } from 'react'

/**
 * Marca el foco como "de teclado" solo cuando se navega con Tab. Así el
 * anillo de foco no aparece con el mouse, ni siquiera con shift+clic, que el
 * navegador suele tratar como interacción de teclado.
 */
export function useKeyboardFocus() {
  useEffect(() => {
    const root = document.documentElement

    const handlePointerDown = () => root.classList.remove('is-keyboard')
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        root.classList.add('is-keyboard')
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])
}
