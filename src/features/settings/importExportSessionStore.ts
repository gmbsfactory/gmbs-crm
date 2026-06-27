"use client"

import { create } from "zustand"
import type {
  ImportMode,
  ImportResponse,
  ImportResolution,
  ImportResolutionsMap,
} from "@/utils/import-export/import-types"
import type { User } from "@/lib/api"

export type ImportPreviewBucket = "insert" | "update" | "skipped" | "conflict" | "error"

export interface ImportPreviewState {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
}

export type DateRange = { from: Date | null; to: Date | null }

interface ImportSessionState {
  open: boolean
  file: File | null
  preview: ImportPreviewState | null
  mode: ImportMode
  dryRun: boolean
  report: ImportResponse | null
  pendingConfirm: ImportResponse | null
  previewBucket: ImportPreviewBucket | null
  resolutions: ImportResolutionsMap
  errorMessage: string | null
  dragOver: boolean
  setOpen: (open: boolean) => void
  setFile: (file: File | null) => void
  setPreview: (preview: ImportPreviewState | null) => void
  setMode: (mode: ImportMode) => void
  setDryRun: (dryRun: boolean) => void
  setReport: (report: ImportResponse | null) => void
  setPendingConfirm: (pendingConfirm: ImportResponse | null) => void
  setPreviewBucket: (previewBucket: ImportPreviewBucket | null) => void
  setResolutions: (resolutions: ImportResolutionsMap) => void
  setResolution: (line: number, resolution: ImportResolution) => void
  clearResolution: (line: number) => void
  setErrorMessage: (errorMessage: string | null) => void
  setDragOver: (dragOver: boolean) => void
  resetImport: () => void
}

interface ExportSessionState {
  open: boolean
  range: DateRange
  exporting: boolean
  extended: boolean
  users: User[]
  loadingUsers: boolean
  selectedUserIds: Set<string>
  userQuery: string
  setOpen: (open: boolean) => void
  setRange: (range: DateRange) => void
  setExporting: (exporting: boolean) => void
  setExtended: (extended: boolean) => void
  setUsers: (users: User[]) => void
  setLoadingUsers: (loadingUsers: boolean) => void
  setSelectedUserIds: (selectedUserIds: Set<string>) => void
  setUserQuery: (userQuery: string) => void
}

export const useImportSessionStore = create<ImportSessionState>((set) => ({
  open: false,
  file: null,
  preview: null,
  mode: "upsert",
  dryRun: false,
  report: null,
  pendingConfirm: null,
  previewBucket: null,
  resolutions: {},
  errorMessage: null,
  dragOver: false,
  setOpen: (open) => set({ open }),
  setFile: (file) => set({ file }),
  setPreview: (preview) => set({ preview }),
  setMode: (mode) => set({ mode }),
  setDryRun: (dryRun) => set({ dryRun }),
  setReport: (report) => set({ report }),
  setPendingConfirm: (pendingConfirm) => set({ pendingConfirm }),
  setPreviewBucket: (previewBucket) => set({ previewBucket }),
  setResolutions: (resolutions) => set({ resolutions }),
  setResolution: (line, resolution) =>
    set((state) => ({ resolutions: { ...state.resolutions, [line]: resolution } })),
  clearResolution: (line) =>
    set((state) => {
      const next = { ...state.resolutions }
      delete next[line]
      return { resolutions: next }
    }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setDragOver: (dragOver) => set({ dragOver }),
  resetImport: () =>
    set({
      file: null,
      preview: null,
      report: null,
      pendingConfirm: null,
      previewBucket: null,
      resolutions: {},
      errorMessage: null,
      dragOver: false,
    }),
}))

export const useExportSessionStore = create<ExportSessionState>((set) => ({
  open: false,
  range: { from: null, to: null },
  exporting: false,
  extended: false,
  users: [],
  loadingUsers: false,
  selectedUserIds: new Set<string>(),
  userQuery: "",
  setOpen: (open) => set({ open }),
  setRange: (range) => set({ range }),
  setExporting: (exporting) => set({ exporting }),
  setExtended: (extended) => set({ extended }),
  setUsers: (users) => set({ users }),
  setLoadingUsers: (loadingUsers) => set({ loadingUsers }),
  setSelectedUserIds: (selectedUserIds) => set({ selectedUserIds }),
  setUserQuery: (userQuery) => set({ userQuery }),
}))
