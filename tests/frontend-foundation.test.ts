import { describe, expect, it } from 'vitest'
import { foundationTokens } from '../src/ui/foundation/tokens'

describe('frontend foundation tokens', () => {
  it('exposes semantic colors and preserves agent/human identity tokens', () => {
    expect(foundationTokens.colors.canvas).toBe('var(--cc-canvas)')
    expect(foundationTokens.colors.agent).toBe('var(--agent)')
    expect(foundationTokens.colors.human).toBe('var(--human)')
  })

  it('exposes the shared motion timings and easing contracts', () => {
    expect(foundationTokens.motion.fast).toBe('var(--cc-duration-fast)')
    expect(foundationTokens.motion.normal).toBe('var(--cc-duration-normal)')
    expect(foundationTokens.motion.standard).toBe('var(--cc-ease-standard)')
  })
})
