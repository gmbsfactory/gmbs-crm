"use client"

import { useCallback, useRef } from "react"
import { createPortal } from "react-dom"

export interface TipData {
  time?: string
  text?: string
  sub?: string
  tag?: string
  tagColor?: string
}

/**
 * Tooltip flottant des barres de la timeline (Monitoring DEV v2).
 *
 * Un seul nœud, porté dans `body` (échappe aux conteneurs `overflow:hidden`),
 * mis à jour de façon impérative au survol pour éviter de re-rendre l'arbre à
 * chaque `mousemove`. Le contenu est inséré via `textContent` (pas d'injection).
 */
export function useTimelineTooltip() {
  const ref = useRef<HTMLDivElement | null>(null)

  const showTip = useCallback((e: { clientX: number; clientY: number }, d: TipData) => {
    const el = ref.current
    if (!el) return
    el.replaceChildren()

    const mk = (text: string, css: string) => {
      const node = document.createElement("div")
      node.style.cssText = css
      node.textContent = text
      return node
    }
    const mono = "ui-monospace, Menlo, monospace"
    if (d.time) el.appendChild(mk(d.time, `font-family:${mono}; font-weight:800; font-size:11px; letter-spacing:.02em; color:#fff;`))
    if (d.text) el.appendChild(mk(d.text, `font-weight:600; font-size:12px; color:#fff; margin-top:${d.time ? "3px" : "0"};`))
    if (d.sub) el.appendChild(mk(d.sub, `font-size:11px; color:rgba(255,255,255,.72); font-family:${mono}; margin-top:2px;`))
    if (d.tag) {
      const tag = mk(d.tag, `align-self:flex-start; margin-top:5px; font-size:10px; font-weight:700; color:#fff; padding:1px 7px; border-radius:5px; font-family:${mono};`)
      tag.style.background = d.tagColor || "rgba(255,255,255,.16)"
      el.appendChild(tag)
    }

    el.style.display = "flex"
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 10
    let x = e.clientX + 14
    if (x + w + pad > vw) x = e.clientX - 14 - w
    if (x < pad) x = pad
    let y = e.clientY - h - 12
    if (y < pad) y = e.clientY + 18
    if (y + h + pad > vh) y = vh - h - pad
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }, [])

  const hideTip = useCallback(() => {
    if (ref.current) ref.current.style.display = "none"
  }, [])

  const node =
    typeof document === "undefined"
      ? null
      : createPortal(
          <div
            ref={ref}
            className="mdev-tooltip"
            style={{
              display: "none",
              flexDirection: "column",
              position: "fixed",
              left: 0,
              top: 0,
              zIndex: 300,
              maxWidth: 260,
              padding: "8px 11px",
              borderRadius: 9,
              background: "rgba(17,19,30,.97)",
              border: "1px solid rgba(255,255,255,.09)",
              boxShadow: "0 10px 28px rgba(0,0,0,.45)",
              pointerEvents: "none",
            }}
          />,
          document.body
        )

  return { node, showTip, hideTip }
}
