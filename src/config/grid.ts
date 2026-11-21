/**
 * Geometría de la pradera.
 *
 * La celda lógica mide 60×30 (proporción 2:1). La grilla de 8×8 ocupa
 * 480×240 px lógicos; se suma un margen superior para que el árbol más
 * alto (128 px) no se corte. El render usa una escala entera según el
 * tamaño disponible.
 */
export const TILE_WIDTH = 60
export const TILE_HEIGHT = 30
export const GRID_COLS = 8
export const GRID_ROWS = 8

export const GRID_PIXEL_WIDTH = (GRID_COLS + GRID_ROWS) * (TILE_WIDTH / 2)
export const GRID_PIXEL_HEIGHT = (GRID_COLS + GRID_ROWS) * (TILE_HEIGHT / 2)

export const TREE_SPRITE_WIDTH = 64
export const TREE_SPRITE_HEIGHT = 128

/** Tamaño del bosque por defecto: 8×8. */
export const DEFAULT_GARDEN_SIZE = GRID_COLS

/** Espacio sobre la grilla para que el árbol de la fila de atrás no se corte. */
export const TOP_PADDING = TREE_SPRITE_HEIGHT

/**
 * Aire a los costados del lienzo de dibujo. Las copas no quedan dentro del
 * rombo: el ceibo adulto mide 107 px de ancho y la celda de la punta está a
 * 30 px del borde, así que sobresale ~25 px. Con 30 px por lado no se corta
 * ninguna copa en las puntas izquierda y derecha.
 */
export const SCENE_SIDE_AIR = 30

/** Espesor de tierra visible debajo de la isla. */
export const ISLAND_DEPTH = 32

export const SCENE_WIDTH = GRID_PIXEL_WIDTH
export const SCENE_HEIGHT = TOP_PADDING + GRID_PIXEL_HEIGHT + ISLAND_DEPTH

/** Ancho del canvas del jardín: escena + aire de copas + 2 px de suelo por lado. */
export const SCENE_CANVAS_WIDTH = SCENE_WIDTH + SCENE_SIDE_AIR * 2 + 4

/** Centro de la celda (0, 0) dentro de la escena lógica. */
export const ORIGIN_X = GRID_PIXEL_WIDTH / 2
export const ORIGIN_Y = TOP_PADDING + TILE_HEIGHT / 2
