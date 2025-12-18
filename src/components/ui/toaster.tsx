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
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:py-3 group-[.toaster]:px-4 group-[.toaster]:text-sm group-[.toaster]:min-h-0 group-[.toaster]:relative group-[.toaster]:overflow-visible",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:pr-4",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-xs group-[.toast]:py-1.5 group-[.toast]:px-3 group-[.toast]:font-medium group-[.toast]:rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:py-1 group-[.toast]:px-2",
          closeButton:
            "group-[.toast]:!absolute group-[.toast]:!-top-2 group-[.toast]:!-right-2 group-[.toast]:!left-auto group-[.toast]:!w-5 group-[.toast]:!h-5 group-[.toast]:!rounded-full group-[.toast]:!bg-destructive group-[.toast]:!border-none group-[.toast]:!text-destructive-foreground group-[.toast]:hover:!bg-destructive/90 group-[.toast]:!shadow-md group-[.toast]:!flex group-[.toast]:!items-center group-[.toast]:!justify-center group-[.toast]:!p-0 group-[.toast]:!opacity-100",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
