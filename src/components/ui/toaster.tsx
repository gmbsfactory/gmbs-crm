"use client"

import * as React from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md group-[.toaster]:py-2 group-[.toaster]:px-3 group-[.toaster]:text-sm group-[.toaster]:min-h-0",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-xs group-[.toast]:py-1 group-[.toast]:px-2",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:py-1 group-[.toast]:px-2",
          closeButton:
            "group-[.toast]:!left-1 group-[.toast]:!right-auto group-[.toast]:!top-1 group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-foreground group-[.toast]:hover:bg-muted",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
