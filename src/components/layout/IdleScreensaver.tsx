'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/** Logo size while bouncing */
const LOGO_SIZE = 120

/** Movement speed in pixels per frame */
const SPEED = 2

/**
 * DVD-style bouncing logo screensaver.
 *
 * Entry: topbar logo hides, screensaver logo starts at center of screen
 * and moves in a random 360° direction, bouncing off edges with hue-rotate.
 *
 * Exit: overlay fades out with logo wherever it is. Once fully gone,
 * the topbar logo reappears.
 *
 * Background: black at 30% opacity.
 */
export function IdleScreensaver({ isIdle }: { isIdle: boolean }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const velRef = useRef({ dx: SPEED, dy: SPEED })
  const hueRef = useRef(0)
  const logoRef = useRef<HTMLImageElement>(null)
  const rafRef = useRef<number>(0)
  const [visible, setVisible] = useState(false)

  // ─── Bounce animation loop ───────────────────────────────────────────────
  const animate = useCallback(() => {
    const container = canvasRef.current
    const logo = logoRef.current
    if (!container || !logo) return

    const maxX = container.clientWidth - LOGO_SIZE
    const maxY = container.clientHeight - LOGO_SIZE

    let { x, y } = posRef.current
    let { dx, dy } = velRef.current

    x += dx
    y += dy

    if (x <= 0 || x >= maxX) {
      dx = -dx
      hueRef.current = (hueRef.current + 60 + Math.random() * 120) % 360
    }
    if (y <= 0 || y >= maxY) {
      dy = -dy
      hueRef.current = (hueRef.current + 60 + Math.random() * 120) % 360
    }

    x = Math.max(0, Math.min(x, maxX))
    y = Math.max(0, Math.min(y, maxY))

    posRef.current = { x, y }
    velRef.current = { dx, dy }

    logo.style.transform = `translate(${x}px, ${y}px)`
    logo.style.filter = `hue-rotate(${hueRef.current}deg) brightness(1.2)`

    rafRef.current = requestAnimationFrame(animate)
  }, [])

  // ─── Start / stop based on isIdle ────────────────────────────────────────
  useEffect(() => {
    if (isIdle) {
      // Hide topbar logo
      document.documentElement.setAttribute('data-screensaver-active', '')

      // Start at center of viewport
      const cx = (window.innerWidth - LOGO_SIZE) / 2
      const cy = (window.innerHeight - LOGO_SIZE) / 2
      posRef.current = { x: cx, y: cy }

      // Classic DVD diagonal — random quadrant
      velRef.current = {
        dx: Math.random() > 0.5 ? SPEED : -SPEED,
        dy: Math.random() > 0.5 ? SPEED : -SPEED,
      }

      hueRef.current = 0
      setVisible(true)
    } else {
      // Stop bouncing — overlay will fade out via AnimatePresence
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setVisible(false)
    }
  }, [isIdle])

  // ─── rAF loop when visible ───────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      rafRef.current = requestAnimationFrame(animate)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [visible, animate])

  // ─── Once exit animation completes, show topbar logo again ───────────────
  const handleExitComplete = useCallback(() => {
    // Wait 1s after screensaver disappears, then bounce the topbar logo back in
    setTimeout(() => {
      document.documentElement.removeAttribute('data-screensaver-active')
      const topbarLogo = document.querySelector('[data-topbar-logo]')
      if (topbarLogo) {
        topbarLogo.setAttribute('data-bounce', '')
        setTimeout(() => topbarLogo.removeAttribute('data-bounce'), 400)
      }
    }, 1000)
  }, [])

  return (
    <>
      {/* Global CSS: hide topbar logo when screensaver is active + bounce keyframe on reappear */}
      <style>{`
        html[data-screensaver-active] [data-topbar-logo] { opacity: 0 !important; }
        @keyframes topbar-logo-bounce {
          0%   { transform: scale(0); opacity: 0; }
          50%  { transform: scale(1.15); opacity: 1; }
          75%  { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        [data-topbar-logo][data-bounce] {
          animation: topbar-logo-bounce 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      <AnimatePresence onExitComplete={handleExitComplete}>
        {visible && (
          <motion.div
            ref={canvasRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[9999] bg-black/30 cursor-none"
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={logoRef}
              src="/gmbs-logo.svg"
              alt=""
              width={LOGO_SIZE}
              height={LOGO_SIZE}
              className="absolute top-0 left-0 pointer-events-none"
              style={{ willChange: 'transform, filter' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
