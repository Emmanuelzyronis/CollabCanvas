import type { Camera } from '../types'

export interface ScreenPoint {
  x: number
  y: number
}

export function screenToWorld(camera: Camera, sx: number, sy: number): ScreenPoint {
  return { x: sx / camera.zoom + camera.x, y: sy / camera.zoom + camera.y }
}

export function worldToScreen(camera: Camera, wx: number, wy: number): ScreenPoint {
  return { x: (wx - camera.x) * camera.zoom, y: (wy - camera.y) * camera.zoom }
}
