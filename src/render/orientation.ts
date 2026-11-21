/**
 * Orientación estable de cada árbol.
 *
 * La mitad del bosque se dibuja espejada para que los sprites no se repitan.
 * La elección sale de un hash del id, que se genera al plantar: no cambia
 * entre renders, recargas ni sesiones y no hace falta guardarla en el estado.
 */
export function treeFlipped(id: string): boolean {
  let hash = 2166136261

  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  // Un bit alto reparte mejor que el bit bajo con ids que comparten prefijo.
  return ((hash >>> 8) & 1) === 1
}
