import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge";

export function ManagerBadge({
  code,
  displayName,
  color,
  avatarUrl,
  fallback,
}: {
  code?: string | null;
  displayName?: string | null;
  color?: string | null;
  avatarUrl?: string | null;
  fallback?: string;
} = {}) {
  const nameParts = displayName?.split(" ") ?? [];
  const firstname = nameParts[0] || null;
  const lastname = nameParts.slice(1).join(" ") || null;

  if (!displayName && !code && !fallback) {
    return <span className="text-[11px] text-muted-foreground">&mdash;</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex">
          <GestionnaireBadge
            firstname={firstname}
            lastname={lastname}
            color={color}
            avatarUrl={avatarUrl}
            size="sm"
            showBorder={true}
            className="h-6 w-6"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {displayName || code || fallback || "Inconnu"}
      </TooltipContent>
    </Tooltip>
  );
}
