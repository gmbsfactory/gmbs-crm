"use client"

import React, { useRef, useState, useCallback } from "react"
import { motion, AnimatePresence, useMotionValue } from "framer-motion"
import type { AIPageContext } from "@/lib/ai/types"
import { cn } from "@/lib/utils"

const BUBBLE_POSITION_KEY = "crm:ai:bubble-position"

interface AIFloatingBubbleProps {
  context: AIPageContext | null
  onActivate: () => void
}

function loadSavedPosition(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 }
  try {
    const saved = localStorage.getItem(BUBBLE_POSITION_KEY)
    return saved ? JSON.parse(saved) : { x: 0, y: 0 }
  } catch {
    return { x: 0, y: 0 }
  }
}

export function AIFloatingBubble({ context, onActivate }: AIFloatingBubbleProps) {
  const constraintsRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Persist drag position across sessions via localStorage
  const savedPosition = loadSavedPosition()
  const x = useMotionValue(savedPosition.x)
  const y = useMotionValue(savedPosition.y)

  const hasActions = (context?.availableActions?.length ?? 0) > 0

  const handleClick = useCallback(() => {
    // Do not trigger click when finishing a drag gesture
    if (!isDragging) {
      onActivate()
    }
  }, [isDragging, onActivate])

  if (!hasActions) return null

  return (
    <>
      {/* Drag constraint area (full viewport) */}
      <div
        ref={constraintsRef}
        className="fixed inset-0 pointer-events-none z-[85]"
        aria-hidden
      />

      <AnimatePresence>
        <motion.button
          key="ai-floating-bubble"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          drag
          dragConstraints={constraintsRef}
          dragElastic={0.1}
          dragMomentum={false}
          style={{ x, y }}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => {
            // Save position to localStorage for persistence
            try {
              const pos = { x: x.get(), y: y.get() }
              localStorage.setItem(BUBBLE_POSITION_KEY, JSON.stringify(pos))
            } catch {
              // localStorage may be unavailable
            }
            // Small delay so the click handler can distinguish drag from click
            setTimeout(() => setIsDragging(false), 100)
          }}
          onClick={handleClick}
          className={cn(
            "fixed bottom-6 right-6 z-[85]",
            "h-12 w-12 rounded-full",
            "bg-primary text-primary-foreground",
            "shadow-lg hover:shadow-xl",
            "flex items-center justify-center",
            "cursor-grab active:cursor-grabbing",
            "transition-shadow duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          aria-label="Assistant IA - Ouvrir les actions disponibles"
          title="Assistant IA"
        >
          {/* Sparkle / star icon for AI */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
          </svg>

          {/* Badge showing number of available actions (only when > 1) */}
          {context && context.availableActions.length > 1 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {context.availableActions.length}
            </span>
          )}
        </motion.button>
      </AnimatePresence>
    </>
  )
}
