import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePanelResize } from '@/hooks/usePanelResize'

// ─── localStorage mock ───────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePanelResize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  afterEach(() => {
    // Clean up any dangling drag listeners left by tests that did not fire mouseup
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    vi.clearAllMocks()
  })

  // ─── Initial width ────────────────────────────────────────────────────────

  describe('initial width', () => {
    it('should use defaultWidth when storageKey is null', () => {
      const { result } = renderHook(() =>
        usePanelResize({ storageKey: null, defaultWidth: 400 })
      )

      expect(result.current.width).toBe(400)
    })

    it('should use built-in defaultWidth (320) when none provided and storageKey is null', () => {
      const { result } = renderHook(() =>
        usePanelResize({ storageKey: null })
      )

      expect(result.current.width).toBe(320)
    })

    it('should load saved width from localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('450')

      const { result } = renderHook(() =>
        usePanelResize({ storageKey: 'panel-width', defaultWidth: 320, minWidth: 250, maxWidth: 600 })
      )

      // useEffect runs after mount
      await act(async () => {})

      expect(localStorageMock.getItem).toHaveBeenCalledWith('panel-width')
      expect(result.current.width).toBe(450)
    })

    it('should fall back to defaultWidth when saved value is not a finite number', async () => {
      localStorageMock.getItem.mockReturnValue('not-a-number')

      const { result } = renderHook(() =>
        usePanelResize({ storageKey: 'panel-width', defaultWidth: 320, minWidth: 250, maxWidth: 600 })
      )

      await act(async () => {})

      expect(result.current.width).toBe(320)
    })

    it('should fall back to defaultWidth when saved value is below minWidth', async () => {
      localStorageMock.getItem.mockReturnValue('100')

      const { result } = renderHook(() =>
        usePanelResize({ storageKey: 'panel-width', defaultWidth: 320, minWidth: 250, maxWidth: 600 })
      )

      await act(async () => {})

      expect(result.current.width).toBe(320)
    })

    it('should fall back to defaultWidth when saved value exceeds maxWidth', async () => {
      localStorageMock.getItem.mockReturnValue('800')

      const { result } = renderHook(() =>
        usePanelResize({ storageKey: 'panel-width', defaultWidth: 320, minWidth: 250, maxWidth: 600 })
      )

      await act(async () => {})

      expect(result.current.width).toBe(320)
    })

    it('should fall back to defaultWidth when localStorage throws', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorageMock.getItem.mockImplementation(() => { throw new Error('storage error') })

      const { result } = renderHook(() =>
        usePanelResize({ storageKey: 'panel-width', defaultWidth: 320, minWidth: 250, maxWidth: 600 })
      )

      await act(async () => {})

      expect(result.current.width).toBe(320)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  // ─── Return value shape ───────────────────────────────────────────────────

  describe('return value', () => {
    it('should return width and handleResizeStart', () => {
      const { result } = renderHook(() =>
        usePanelResize({ storageKey: null, defaultWidth: 320 })
      )

      expect(typeof result.current.width).toBe('number')
      expect(typeof result.current.handleResizeStart).toBe('function')
    })

    it('should keep handleResizeStart referentially stable across renders', async () => {
      const { result, rerender } = renderHook(() =>
        usePanelResize({ storageKey: null, defaultWidth: 320, minWidth: 250, maxWidth: 600 })
      )

      const first = result.current.handleResizeStart
      rerender()
      const second = result.current.handleResizeStart

      // useCallback: stable as long as deps haven't changed
      expect(first).toBe(second)
    })
  })

  // ─── Mouse drag behaviour ─────────────────────────────────────────────────

  describe('handleResizeStart — mouse drag', () => {
    it('should update width as the mouse moves', () => {
      const { result } = renderHook(() =>
        usePanelResize({ storageKey: null, defaultWidth: 400, minWidth: 250, maxWidth: 600 })
      )

      act(() => {
        result.current.handleResizeStart({
          preventDefault: vi.fn(),
          clientX: 500,
        } as unknown as React.MouseEvent)
      })

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 450, bubbles: true }))
      })

      // diff = startX(500) - currentX(450) = 50 → newWidth = 400 + 50 = 450
      expect(result.current.width).toBe(450)
    })

    it('should clamp width to minWidth during drag', () => {
      const { result } = renderHook(() =>
        usePanelResize({ storageKey: null, defaultWidth: 400, minWidth: 250, maxWidth: 600 })
      )

      act(() => {
        result.current.handleResizeStart({
          preventDefault: vi.fn(),
          clientX: 500,
        } as unknown as React.MouseEvent)
      })

      act(() => {
        // diff = 500 - 700 = -200 → 400 + (-200) = 200 < 250 → clamped to 250
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 700, bubbles: true }))
      })

      expect(result.current.width).toBe(250)
    })

    it('should clamp width to maxWidth during drag', () => {
      const { result } = renderHook(() =>
        usePanelResize({ storageKey: null, defaultWidth: 400, minWidth: 250, maxWidth: 600 })
      )

      act(() => {
        result.current.handleResizeStart({
          preventDefault: vi.fn(),
          clientX: 500,
        } as unknown as React.MouseEvent)
      })

      act(() => {
        // diff = 500 - 100 = 400 → 400 + 400 = 800 > 600 → clamped to 600
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, bubbles: true }))
      })

      expect(result.current.width).toBe(600)
    })

    it('should remove event listeners on mouseup', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener')

      const { result } = renderHook(() =>
        usePanelResize({ storageKey: null, defaultWidth: 400, minWidth: 250, maxWidth: 600 })
      )

      act(() => {
        result.current.handleResizeStart({
          preventDefault: vi.fn(),
          clientX: 500,
        } as unknown as React.MouseEvent)
      })

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      })

      expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))

      removeSpy.mockRestore()
    })

    it('should persist new width to localStorage on mousemove when storageKey is set', () => {
      const { result } = renderHook(() =>
        usePanelResize({ storageKey: 'panel-width', defaultWidth: 400, minWidth: 250, maxWidth: 600 })
      )

      act(() => {
        result.current.handleResizeStart({
          preventDefault: vi.fn(),
          clientX: 500,
        } as unknown as React.MouseEvent)
      })

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 450, bubbles: true }))
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith('panel-width', '450')
    })

    it('should not persist to localStorage when storageKey is null', () => {
      const { result } = renderHook(() =>
        usePanelResize({ storageKey: null, defaultWidth: 400, minWidth: 250, maxWidth: 600 })
      )

      act(() => {
        result.current.handleResizeStart({
          preventDefault: vi.fn(),
          clientX: 500,
        } as unknown as React.MouseEvent)
      })

      localStorageMock.setItem.mockClear()

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 450, bubbles: true }))
      })

      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })
  })
})
