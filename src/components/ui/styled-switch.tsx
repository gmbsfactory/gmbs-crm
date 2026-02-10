"use client"

import React, { useCallback } from 'react'
import { cn } from "@/lib/utils"

interface StyledSwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  id?: string
}

export const StyledSwitch = React.forwardRef<
  HTMLInputElement,
  StyledSwitchProps
>(({ id, checked = false, onCheckedChange, ...props }, ref) => {
  const switchId = id || `styled-switch-${Math.random().toString(36).substr(2, 9)}`

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLLabelElement>) => {
    e.currentTarget.style.transform = checked
      ? 'perspective(100px) rotateX(-5deg) rotateY(5deg)'
      : 'perspective(100px) rotateX(5deg) rotateY(-5deg)'
  }, [checked])

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLLabelElement>) => {
    e.currentTarget.style.transform = ''
  }, [])

  return (
    <div>
      <input
        ref={ref}
        type="checkbox"
        name="checkbox"
        id={switchId}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="hidden"
        {...props}
      />
      <label
        htmlFor={switchId}
        className={cn(
          "relative flex items-center h-[30px] w-[60px] cursor-pointer rounded-full",
          "bg-background transition-transform duration-[400ms]"
        )}
        style={{
          boxShadow: `
            inset 0 0 2.5px 2px hsl(var(--background)),
            inset 0 0 10px 0.5px hsl(var(--foreground) / 0.49),
            5px 10px 15px hsl(var(--foreground) / 0.1),
            inset 0 0 0 1.5px hsl(var(--foreground) / 0.3)
          `,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span
          className="absolute h-5 w-5 rounded-full transition-all duration-[400ms]"
          style={{
            left: checked ? '35px' : '5px',
            backgroundColor: 'hsl(var(--foreground))',
            backgroundImage: checked
              ? 'linear-gradient(315deg, hsl(var(--foreground)) 0%, hsl(var(--muted-foreground)) 70%)'
              : 'linear-gradient(130deg, hsl(var(--muted-foreground)) 10%, hsl(var(--background)) 11%, hsl(var(--muted-foreground) / 0.8) 62%)',
            boxShadow: '0 1px 0.5px hsl(var(--foreground) / 0.3), 5px 5px 5px hsl(var(--foreground) / 0.3)',
          }}
        />
      </label>
    </div>
  )
})

StyledSwitch.displayName = "StyledSwitch"
