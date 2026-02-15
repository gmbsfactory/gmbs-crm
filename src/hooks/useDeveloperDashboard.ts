"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Manages developer dashboard open/close state with keyboard shortcuts.
 * - Alt+R: toggle open/close
 * - Escape: close
 * - Click outside: close
 */
export function useDeveloperDashboard() {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'Escape' && isOpen) {
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, toggle, close])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close()
      }
    }

    // Delay listener to avoid closing on the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, close])

  return { isOpen, toggle, close, panelRef }
}
