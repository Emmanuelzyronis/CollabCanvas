import { create } from 'zustand'

export type ViewportPreset = 'mobile' | 'tablet' | 'desktop'

export interface ViewportConfig {
  id: ViewportPreset
  label: string
  width: number | null  // null = full canvas (desktop)
  breakpointLabel: string
}

export const VIEWPORT_PRESETS: ViewportConfig[] = [
  { id: 'mobile',  label: 'Mobile',  width: 375,  breakpointLabel: '375px / Mobile' },
  { id: 'tablet',  label: 'Tablet',  width: 768,  breakpointLabel: '768px / Tablet' },
  { id: 'desktop', label: 'Desktop', width: null, breakpointLabel: 'Full / Desktop' },
]

interface ViewportState {
  preset: ViewportPreset
  setPreset: (preset: ViewportPreset) => void
}

export const useViewportStore = create<ViewportState>((set) => ({
  preset: 'desktop',
  setPreset: (preset) => set({ preset }),
}))

export function configFor(preset: ViewportPreset): ViewportConfig {
  return VIEWPORT_PRESETS.find((p) => p.id === preset) ?? VIEWPORT_PRESETS[2]
}
