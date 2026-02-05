"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    style={{
      background: "rgba(0, 0, 0, 0.20)",
    }}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const dialogContentVariants = cva(
  "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl overflow-hidden",
  {
    variants: {
      variant: {
        default: "glass-modal gap-4 p-6",
        premium: "glass-modal-premium gap-0 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Styles inline pour forcer l'effet glass translucide
const premiumGlassStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.25)",
  backdropFilter: "blur(16px) saturate(1.4)",
  WebkitBackdropFilter: "blur(16px) saturate(1.4)",
  border: "1px solid rgba(255, 255, 255, 0.4)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.6)",
}

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  overlayClassName?: string
  hideCloseButton?: boolean
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, overlayClassName, variant, hideCloseButton, style, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ variant, className }))}
      style={variant === "premium" ? { ...premiumGlassStyle, ...style } : style}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className={cn(
          "absolute right-4 top-4 rounded-md p-1.5 opacity-70 ring-offset-background transition-all hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10",
          variant === "premium"
            ? "hover:bg-[var(--modal-header-bg)] top-3 right-3"
            : "hover:bg-[var(--glass-bg-medium)]"
        )}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "premium"
}

// Style inline pour forcer le header solide - effet lévitation
const premiumHeaderStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.97)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.8)",
  padding: "1.25rem 1.5rem",
  boxShadow: "0 4px 16px rgba(51, 113, 178, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 1)",
}

const DialogHeader = ({
  className,
  variant = "default",
  style,
  ...props
}: DialogHeaderProps) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      variant === "premium" && "glass-modal-header",
      className
    )}
    style={variant === "premium" ? { ...premiumHeaderStyle, ...style } : style}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  translucent?: boolean
}

const DialogBody = ({
  className,
  translucent = false,
  ...props
}: DialogBodyProps) => (
  <div
    className={cn(
      "glass-modal-body",
      translucent && "glass-modal-body--translucent",
      className
    )}
    {...props}
  />
)
DialogBody.displayName = "DialogBody"

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "premium"
}

// Style inline pour forcer le footer solide - effet lévitation
const premiumFooterStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.95)",
  borderTop: "1px solid rgba(255, 255, 255, 0.8)",
  padding: "1rem 1.5rem",
  boxShadow: "0 -4px 16px rgba(51, 113, 178, 0.08), 0 -2px 6px rgba(0, 0, 0, 0.04), inset 0 -1px 0 rgba(255, 255, 255, 1)",
}

const DialogFooter = ({
  className,
  variant = "default",
  style,
  ...props
}: DialogFooterProps) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      variant === "premium" && "glass-modal-footer",
      className
    )}
    style={variant === "premium" ? { ...premiumFooterStyle, ...style } : style}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  dialogContentVariants,
}
