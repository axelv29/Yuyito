# Recuperar un guardado dañado

Cuando la app no puede leer el guardado, **no lo borra**: lo copia a otra clave
de localStorage y arranca de cero. La copia sigue ahí.

| Clave | Qué contiene |
| --- | --- |
| `focus-forest` | El guardado en uso. |
| `focus-forest.broken` | La primera copia del guardado dañado. |
| `focus-forest.broken.<timestamp>` | Copias de incidentes posteriores. |
| `focus-forest.antes-de-recuperar.<timestamp>` | Lo que había antes de restaurar una copia. |

Código: `src/state/persist.ts` → `backupState()`.

## Incidente del 2026-11-16

El guardado era válido. Lo que fallaba era el validador: `isSessionPlan()`
exigía `tasks` de texto (`typeof task === 'string'`) mientras la app ya guardaba
objetivos con estado (`{ id, text, status }`). Un plan con objetivos hacía
fallar `isPersistedState()`, que rechaza el estado **completo**, y la app
empezaba de cero.

Arreglado en `src/state/persist.ts`: `isSessionPlan()` ahora usa `isSessionTask`,
igual que `isStoredSessionPlan()` y `isFocusRecordBase()`.

## Restaurar la copia

1. Serví la build con el arreglo **en el mismo origen** donde se dañó el
   guardado (`localhost:5173`, `localhost:4173` y el dominio de Vercel son
   orígenes distintos, con su propio localStorage). Si no, al recargar se vuelve
   a rechazar.
2. Abrí la consola del navegador (F12 → Console) y pegá:

```js
(() => {
  const raw = localStorage.getItem('focus-forest.broken')
  if (!raw) return console.error('No hay focus-forest.broken en este origen.')
  const current = localStorage.getItem('focus-forest')
  if (current) {
    localStorage.setItem(`focus-forest.antes-de-recuperar.${Date.now()}`, current)
  }
  localStorage.setItem('focus-forest', raw)
  console.log('Restaurado. Recargá la página.')
})()
```

3. Recargá. El guardado actual queda en `focus-forest.antes-de-recuperar.<ts>`
   por si hace falta volver atrás.

## Exportar todo

Si hace falta revisar el contenido fuera del navegador:

```js
(() => {
  const out = {}
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('focus-forest')) out[k] = localStorage.getItem(k)
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }))
  a.download = 'focus-forest-respaldo.json'
  a.click()
})()
```

## Regla para no repetirlo

`isPersistedState()` es todo o nada: un solo elemento inválido descarta el
estado completo. Al cambiar la forma de lo que se guarda hay que actualizar
**el validador y su versión** en el mismo commit, y agregar un caso en
`src/tests/persist.test.ts` con el dato nuevo. Los tests existentes no lo
detectaron porque el plan de prueba tenía `tasks: []`.
