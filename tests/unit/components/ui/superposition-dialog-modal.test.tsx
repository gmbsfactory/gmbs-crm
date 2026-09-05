import React from "react"
// Vitest (runtime JSX historique) requiert React sur le scope global
globalThis.React = React
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, cleanup } from "@testing-library/react"

// jsdom ne calcule aucune mise en page : focus-trap considère alors qu'aucun
// élément n'est focusable et refuse de s'activer. On le neutralise, il n'a rien
// à voir avec la superposition testée ici.
vi.mock("focus-trap-react", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { GenericModal } from "@/components/ui/modal/GenericModal"
import { StatusReasonModal } from "@/components/shared/StatusReasonModal"
import { Z_INDEX } from "@/lib/ui/z-index"

const noop = () => {}

/**
 * Extrait le z-index porté par un élément, qu'il soit écrit `z-50` ou `z-[1300]`.
 * En test, Tailwind ne produit pas de CSS : on lit donc la classe, pas le style
 * calculé. C'est exactement ce qui compte ici, puisque l'ordre d'empilement du
 * navigateur découle de cette classe.
 */
function zDeLaClasse(element: Element | null): number | null {
  if (!element) return null
  for (const classe of Array.from(element.classList)) {
    const m = /^!?z-(?:\[(\d+)\]|(\d+))$/.exec(classe)
    if (m) return Number(m[1] ?? m[2])
  }
  return null
}

/** Le plus grand z-index trouvé parmi les éléments correspondant au sélecteur. */
function zMax(selecteur: string): number | null {
  const valeurs = Array.from(document.querySelectorAll(selecteur))
    .map(zDeLaClasse)
    .filter((v): v is number => v !== null)
  return valeurs.length ? Math.max(...valeurs) : null
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
  document.body.style.pointerEvents = ""
  document.body.style.overflow = ""
})

describe("Superposition : dialogues au-dessus des gros modals", () => {
  it("sort le contenu d'un Dialog au-dessus du conteneur d'un GenericModal", () => {
    render(
      <GenericModal isOpen mode="centerpage" onClose={noop}>
        <p>Fiche artisan</p>
      </GenericModal>,
    )
    const zModal = zMax('[role="dialog"][aria-modal="true"]')
    expect(zModal).toBe(Z_INDEX.modal)

    cleanup()
    document.body.innerHTML = ""

    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Refuser la pièce</DialogTitle>
        </DialogContent>
      </Dialog>,
    )
    const zDialogue = zMax(".shadcn-dialog-content")
    const zVoile = zMax(".shadcn-dialog-overlay")

    expect(zDialogue).toBe(Z_INDEX.dialogue)
    expect(zVoile).toBe(Z_INDEX.dialogueVoile)
    // Le cœur du correctif : le dialogue passe devant le modal, voile compris.
    expect(zVoile!).toBeGreaterThan(zModal!)
    expect(zDialogue!).toBeGreaterThan(zVoile!)
  })

  it("sort le contenu d'un AlertDialog au-dessus d'un Dialog", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Confirmer</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    )
    const zConfirmation = zMax('[role="alertdialog"]')
    expect(zConfirmation).toBe(Z_INDEX.confirmation)
    expect(zConfirmation!).toBeGreaterThan(Z_INDEX.dialogue)
  })
})

describe("Non-régression : les rustines locales ont bien disparu", () => {
  it("StatusReasonModal ne surcharge plus le z-index et hérite du bon étage", () => {
    render(<StatusReasonModal open type="archive" onConfirm={noop} onCancel={noop} />)

    const contenu = document.querySelector(".shadcn-dialog-content")
    const voile = document.querySelector(".shadcn-dialog-overlay")

    expect(contenu).not.toBeNull()
    expect(zDeLaClasse(contenu)).toBe(Z_INDEX.dialogue)
    expect(zDeLaClasse(voile)).toBe(Z_INDEX.dialogueVoile)

    // Plus aucune classe « importante » : le défaut de la primitive suffit.
    const classes = [contenu, voile].flatMap((el) => Array.from(el?.classList ?? []))
    expect(classes.filter((c) => c.startsWith("!z-"))).toEqual([])
  })
})
