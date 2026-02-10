"use client";

import { useMemo } from "react";
import Image from "next/image";
import { FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentPreviewProps {
  url: string;
  mimeType?: string | null;
  filename?: string;
  className?: string;
}

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const PDF_MIME_TYPES = new Set(["application/pdf"]);

function getExtension(filename?: string): string | null {
  if (!filename) return null;
  const parts = filename.split(".");
  if (parts.length < 2) return null;
  return parts.pop()?.toLowerCase() ?? null;
}

function isImage(mimeType?: string | null, filename?: string): boolean {
  if (mimeType && IMAGE_MIME_TYPES.has(mimeType)) return true;
  const extension = getExtension(filename);
  return !!extension && ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension);
}

function isPdf(mimeType?: string | null, filename?: string): boolean {
  if (mimeType && PDF_MIME_TYPES.has(mimeType)) return true;
  const extension = getExtension(filename);
  return extension === "pdf";
}

export function DocumentPreview({ url, mimeType, filename, className }: DocumentPreviewProps) {
  const previewType = useMemo(() => {
    if (isImage(mimeType, filename)) return "image";
    if (isPdf(mimeType, filename)) return "pdf";
    return "file";
  }, [mimeType, filename]);

  if (previewType === "image") {
    return (
      <div className={cn("relative overflow-hidden rounded-md border bg-muted min-h-[10rem]", className)}>
        <Image
          src={url}
          alt={filename ?? "Document"}
          fill
          className="object-contain"
          loading="lazy"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
        />
      </div>
    );
  }

  if (previewType === "pdf") {
    return (
      <div className={cn("overflow-hidden rounded-md border min-h-[10rem]", className)}>
        <iframe
          src={url}
          title={filename ?? "Document PDF"}
          className="h-[400px] min-h-[10rem] w-full"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[10rem] flex-col items-center justify-center gap-3 rounded-md border bg-muted/60 p-4 text-center",
        className
      )}
    >
      <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {filename ?? "Document"}
        </p>
        <p className="text-xs text-muted-foreground">
          Aperçu indisponible
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary"
      >
        <Download className="h-3 w-3" />
        Télécharger
      </a>
    </div>
  );
}

