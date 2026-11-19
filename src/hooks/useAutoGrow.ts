import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

function growToContent(element: HTMLTextAreaElement) {
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

/**
 * Ajusta la altura de un textarea a su contenido: el texto largo sigue en la
 * línea siguiente y la tarjeta crece en vez de cortarlo. Se recalcula tras
 * cada render y también cuando cambia el ancho del elemento (ventana o
 * columna), porque ahí el texto se vuelve a acomodar.
 */
export function useAutoGrow(): RefObject<HTMLTextAreaElement | null> {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (ref.current) {
      growToContent(ref.current)
    }
  })

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver(() => growToContent(element))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return ref
}
