import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePWAInstall } from '@/hooks/usePWAInstall'

describe('usePWAInstall', () => {
  beforeEach(() => {
    // Reset localStorage mock
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    vi.mocked(localStorage.setItem).mockClear()
  })

  it('returns initial state', () => {
    const { result } = renderHook(() => usePWAInstall())

    expect(result.current.isInstallable).toBe(false)
    expect(result.current.hasPrompted).toBe(false)
    expect(result.current.shouldShowPrompt).toBe(false)
  })

  it('captures beforeinstallprompt event', () => {
    const { result } = renderHook(() => usePWAInstall())

    // Simulate beforeinstallprompt event
    const mockEvent = new Event('beforeinstallprompt')
    Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    expect(result.current.isInstallable).toBe(true)
    expect(result.current.shouldShowPrompt).toBe(true)
  })

  // Test 8.18: PWA install prompt shows after successful login
  it('shows install prompt when installable and not previously prompted', () => {
    const { result } = renderHook(() => usePWAInstall())

    // Simulate beforeinstallprompt event
    const mockEvent = new Event('beforeinstallprompt')
    Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    expect(result.current.shouldShowPrompt).toBe(true)
  })

  // Test 8.19: PWA install prompt not shown if already prompted (localStorage)
  it('does not show prompt if already prompted', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('true')

    const { result } = renderHook(() => usePWAInstall())

    // Even with beforeinstallprompt, shouldn't show
    const mockEvent = new Event('beforeinstallprompt')
    Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    expect(result.current.hasPrompted).toBe(true)
    expect(result.current.shouldShowPrompt).toBe(false)
  })

  it('dismissPrompt stores flag in localStorage', () => {
    const { result } = renderHook(() => usePWAInstall())

    // Simulate install prompt available
    const mockEvent = new Event('beforeinstallprompt')
    Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    // Dismiss the prompt
    act(() => {
      result.current.dismissPrompt()
    })

    expect(localStorage.setItem).toHaveBeenCalledWith('hasPromptedInstall', 'true')
    expect(result.current.hasPrompted).toBe(true)
    expect(result.current.shouldShowPrompt).toBe(false)
  })

  it('handles appinstalled event', () => {
    const { result } = renderHook(() => usePWAInstall())

    // First, capture the beforeinstallprompt
    const mockEvent = new Event('beforeinstallprompt')
    Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() })

    act(() => {
      window.dispatchEvent(mockEvent)
    })

    expect(result.current.isInstallable).toBe(true)

    // Then, app gets installed
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(result.current.isInstallable).toBe(false)
    expect(result.current.hasPrompted).toBe(true)
    expect(localStorage.setItem).toHaveBeenCalledWith('hasPromptedInstall', 'true')
  })

  it('promptInstall calls native prompt', async () => {
    const { result } = renderHook(() => usePWAInstall())

    const mockPrompt = vi.fn().mockResolvedValue(undefined)
    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    }

    act(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent))
    })

    let accepted: boolean = false
    await act(async () => {
      accepted = await result.current.promptInstall()
    })

    expect(mockPrompt).toHaveBeenCalled()
    expect(accepted).toBe(true)
    expect(localStorage.setItem).toHaveBeenCalledWith('hasPromptedInstall', 'true')
  })

  it('promptInstall returns false when no prompt available', async () => {
    const { result } = renderHook(() => usePWAInstall())

    let returnValue: boolean = true
    await act(async () => {
      returnValue = await result.current.promptInstall()
    })

    expect(returnValue).toBe(false)
  })

  it('cleans up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => usePWAInstall())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function))

    removeEventListenerSpy.mockRestore()
  })
})
