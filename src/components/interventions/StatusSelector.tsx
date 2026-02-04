'use client';

import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { InterventionStatus } from "@/types/intervention";
import { cn } from "@/lib/utils";

interface StatusSelectorProps {
  currentStatusId?: string | null;
  statuses: InterventionStatus[];
  onChange: (statusId: string) => void;
  disabled?: boolean;
  className?: string;
}

const FALLBACK_COLOR = "#64748b";

const getContrastColor = (hexColor: string) => {
  const sanitized = hexColor.replace("#", "");
  if (sanitized.length !== 6) {
    return "#FFFFFF";
  }
  const value = Number.parseInt(sanitized, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 150 ? "#111827" : "#FFFFFF";
};

export function StatusSelector({
  currentStatusId,
  statuses,
  onChange,
  disabled = false,
  className,
}: StatusSelectorProps) {
  const activeStatus = useMemo(
    () => (currentStatusId ? statuses.find((status) => status.id === currentStatusId) : undefined),
    [currentStatusId, statuses]
  );

  const badgeColor = activeStatus
    ? activeStatus.color || FALLBACK_COLOR
    : FALLBACK_COLOR;
  const badgeTextColor = getContrastColor(badgeColor);

  return (
    <Select
      disabled={disabled}
      value={currentStatusId ?? undefined}
      onValueChange={onChange}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue>
          {activeStatus ? (
            <Badge
              style={{
                backgroundColor: badgeColor,
                color: badgeTextColor,
              }}
            >
              {activeStatus.label}
            </Badge>
          ) : (
            <span className="text-muted-foreground">Sélectionner un statut</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statuses.map((status) => (
          <SelectItem key={status.id} value={status.id}>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: status.color || FALLBACK_COLOR }}
              />
              <span>{status.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
