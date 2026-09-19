import type { Rect } from '../store/geometry'

export interface ImageBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Scale an image so it fills the frame completely while keeping its aspect ratio.
 * Mirrors `object-fit: cover`: the overflowing axis is cropped by the frame clip.
 */
export function coverImageRect(
  intrinsic: { width?: number; height?: number } | null | undefined,
  frame: Pick<Rect, 'minX' | 'minY' | 'width' | 'height'>,
): ImageBox | null {
  const intrinsicWidth = intrinsic?.width ?? 0
  const intrinsicHeight = intrinsic?.height ?? 0
  if (!(intrinsicWidth > 0) || !(intrinsicHeight > 0)) return null
  if (!(frame.width > 0) || !(frame.height > 0)) return null
  const scale = Math.max(frame.width / intrinsicWidth, frame.height / intrinsicHeight)
  const width = intrinsicWidth * scale
  const height = intrinsicHeight * scale
  return {
    x: frame.minX + (frame.width - width) / 2,
    y: frame.minY + (frame.height - height) / 2,
    width,
    height,
  }
}
