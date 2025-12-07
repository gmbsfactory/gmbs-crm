"use client"

import * as React from "react"

// Lightweight CSS-only bubble background inspired by shadcn docs.
// Uses CSS variables --glass-c1/2/3 set by lib/themes.ts for palette.
// 🚀 OPTIMISATION: Désactive l'animation et le blur si prefers-reduced-motion

export default function BubbleBackground() {
  // 🚀 OPTIMISATION: Vérifier si l'utilisateur préfère réduire les animations
  const [shouldAnimate, setShouldAnimate] = React.useState(true)
  
  React.useEffect(() => {
    // Détecter les préférences utilisateur pour reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setShouldAnimate(!mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setShouldAnimate(!e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // 🚀 Si reduced-motion activé, retourner un fond statique simple (pas de blur ni animation)
  if (!shouldAnimate) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "linear-gradient(135deg, var(--glass-c1, #8b5cf6) 0%, var(--glass-c3, #4c1d95) 100%)",
          opacity: 0.3,
        }}
        data-animated-bg
      />
    )
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        // Several radial gradients positioned across the screen.
        backgroundImage: [
          "radial-gradient(600px circle at 20% 10%, var(--glass-c1, #8b5cf6) 0%, transparent 55%)",
          "radial-gradient(500px circle at 85% 15%, var(--glass-c2, #1e1b4b) 0%, transparent 60%)",
          "radial-gradient(500px circle at 50% 85%, var(--glass-c3, #4c1d95) 0%, transparent 60%)",
          "radial-gradient(420px circle at 15% 70%, var(--glass-c2, #1e1b4b) 0%, transparent 65%)",
          "radial-gradient(380px circle at 80% 75%, var(--glass-c1, #8b5cf6) 0%, transparent 65%)",
        ].join(", "),
        backgroundRepeat: "no-repeat",
        backgroundSize: "auto",
        backgroundPosition: "0% 0%",
        animation: "gradient 16s ease-in-out infinite",
        filter: "blur(24px)",
        opacity: 0.7,
        // 🚀 Optimisation GPU - forcer l'accélération matérielle
        willChange: "background-position",
        transform: "translateZ(0)",
      }}
      data-animated-bg
    />
  )
}

