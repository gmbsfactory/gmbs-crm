"use client"

import * as React from "react"
import { Toaster as Sonner } from "sonner"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      expand
      gap={8}
      icons={{
        loading: React.createElement(Loader2, {
          className: "h-4 w-4 animate-spin text-muted-foreground",
        }),
        success: React.createElement(CheckCircle2, {
          className: "h-4 w-4 text-emerald-500",
        }),
        error: React.createElement(XCircle, {
          className: "h-4 w-4 text-red-500",
        }),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:py-3 group-[.toaster]:px-4 group-[.toaster]:text-sm group-[.toaster]:overflow-visible",
          description:
            "group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:pr-4",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-xs group-[.toast]:py-1.5 group-[.toast]:px-3 group-[.toast]:font-medium group-[.toast]:rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:py-1 group-[.toast]:px-2",
          closeButton:
            "group-[.toast]:!absolute group-[.toast]:!-top-2 group-[.toast]:!-right-2 group-[.toast]:!left-auto group-[.toast]:!w-5 group-[.toast]:!h-5 group-[.toast]:!rounded-full group-[.toast]:!bg-destructive group-[.toast]:!border-none group-[.toast]:!text-destructive-foreground group-[.toast]:hover:!bg-destructive/90 group-[.toast]:!shadow-md group-[.toast]:!flex group-[.toast]:!items-center group-[.toast]:!justify-center group-[.toast]:!p-0 group-[.toast]:!opacity-100",
          loading: "group-[.toaster]:border-muted-foreground/20",
          success: "group-[.toaster]:border-emerald-500/20",
          error:
            "group-[.toaster]:border-red-500/30 group-[.toaster]:border-l-red-500 group-[.toaster]:border-l-4",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
