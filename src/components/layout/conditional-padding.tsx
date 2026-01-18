"use client"

import { usePathname } from "next/navigation"

export function ConditionalPadding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"
  const isPortail = pathname?.startsWith("/portail")
  
  // Pas de padding sur login et portail artisan
  const noPadding = isLoginPage || isPortail
  
  return (
    <div className={`flex flex-1 w-full overflow-hidden ${noPadding ? '' : 'pt-16'}`}>
      {children}
    </div>
  )
}


