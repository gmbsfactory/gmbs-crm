export type ModalDisplayMode = "halfpage" | "centerpage" | "fullpage"

export interface ModalDisplayConfig {
  label: string
  description: string
  containerClass: string
  wrapperClass: string
  width?: string
  height?: string
  maxWidth?: string
}

export interface ModalDisplayContextType {
  preferredMode: ModalDisplayMode
  defaultMode: ModalDisplayMode
  effectiveMode: ModalDisplayMode
  setPreferredMode: (mode: ModalDisplayMode) => void
  setDefaultMode: (mode: ModalDisplayMode) => void
  resetToDefault: () => void
  isDefaultModeModified: boolean
  configs: Record<ModalDisplayMode, ModalDisplayConfig>
}

export const DEFAULT_MODAL_DISPLAY_MODE: ModalDisplayMode = "centerpage"

export const MODAL_DISPLAY_CONFIGS: Record<ModalDisplayMode, ModalDisplayConfig> = {
  halfpage: {
    label: "Demi-page",
    description: "Modal sur la droite, comme Notion",
    containerClass: "w-[65%] h-full ml-auto",
    wrapperClass: "justify-end",
    width: "65%",
    height: "100%",
  },
  centerpage: {
    label: "Centrée",
    description: "Modal centrée classique",
    containerClass: "w-full max-w-4xl h-[90vh] m-auto",
    wrapperClass: "items-center justify-center p-4",
    maxWidth: "56rem",
    height: "90vh",
  },
  fullpage: {
    label: "Plein écran",
    description: "Modal en plein écran pour mobile",
    containerClass: "w-full h-full",
    wrapperClass: "",
    width: "100%",
    height: "100%",
  },
}