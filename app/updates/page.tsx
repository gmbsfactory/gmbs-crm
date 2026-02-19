"use client"

import { usePermissions } from "@/hooks/usePermissions"
import { UpdatesManager } from "@/features/settings/UpdatesManager"
import { ShieldAlert } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export default function UpdatesPage() {
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!can("manage_updates")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 opacity-40" />
        <p className="text-sm">Page accessible uniquement aux développeurs.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <UpdatesManager />
    </div>
  )
}
