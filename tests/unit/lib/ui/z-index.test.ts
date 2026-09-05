import { describe, it, expect } from "vitest"
import { Z_INDEX, Z_CLASS } from "@/lib/ui/z-index"

/**
 * L'échelle de superposition est un contrat : ces tests figent l'ordre des
 * étages. Si quelqu'un déplace une valeur, il doit passer par ici — et donc
 * relire pourquoi cet étage était au-dessus du précédent.
 * Voir docs/conventions/z-index.md
 */
describe("Échelle de superposition", () => {
  describe("cohérence entre les constantes et les classes Tailwind", () => {
    it("expose exactement les mêmes étages des deux côtés", () => {
      expect(Object.keys(Z_CLASS).sort()).toEqual(Object.keys(Z_INDEX).sort())
    })

    it("écrit dans chaque classe la valeur numérique de l'étage", () => {
      for (const [etage, valeur] of Object.entries(Z_INDEX)) {
        const classe = Z_CLASS[etage as keyof typeof Z_CLASS]
        const nombre = Number(classe.replace(/^z-\[?/, "").replace(/\]$/, ""))
        expect(nombre, `étage « ${etage} »`).toBe(valeur)
      }
    })
  })

  describe("ordre des étages", () => {
    it("place une boîte de dialogue au-dessus d'un gros modal", () => {
      // C'est le bug corrigé : le motif de refus d'une pièce passait derrière
      // la fiche artisan.
      expect(Z_INDEX.dialogueVoile).toBeGreaterThan(Z_INDEX.modal)
      expect(Z_INDEX.dialogue).toBeGreaterThan(Z_INDEX.dialogueVoile)
    })

    it("place une confirmation au-dessus d'une boîte de dialogue", () => {
      // Une confirmation s'ouvre souvent DEPUIS un dialogue.
      expect(Z_INDEX.confirmationVoile).toBeGreaterThan(Z_INDEX.dialogue)
      expect(Z_INDEX.confirmation).toBeGreaterThan(Z_INDEX.confirmationVoile)
    })

    it("place un dialogue imbriqué au-dessus de son parent et sous les confirmations", () => {
      expect(Z_INDEX.dialogueImbriqueVoile).toBeGreaterThan(Z_INDEX.dialogue)
      expect(Z_INDEX.dialogueImbrique).toBeGreaterThan(Z_INDEX.dialogueImbriqueVoile)
      expect(Z_INDEX.dialogueImbrique).toBeLessThan(Z_INDEX.confirmationVoile)
    })

    it("garde les menus et sélecteurs au-dessus de toutes les surfaces modales", () => {
      // Un sélecteur ouvert DANS un dialogue doit rester devant lui.
      expect(Z_INDEX.flottant).toBeGreaterThan(Z_INDEX.confirmation)
      expect(Z_INDEX.flottant).toBeGreaterThan(Z_INDEX.visionneuse)
      expect(Z_INDEX.flottantImbrique).toBeGreaterThan(Z_INDEX.flottant)
    })

    it("place chaque surface au-dessus de son propre voile", () => {
      expect(Z_INDEX.modal).toBeGreaterThan(Z_INDEX.modalVoile)
      expect(Z_INDEX.panneau).toBeGreaterThan(Z_INDEX.panneauVoile)
    })

    it("place les panneaux latéraux au-dessus des gros modals", () => {
      // Un panneau d'historique s'ouvre depuis la fiche artisan.
      expect(Z_INDEX.panneauVoile).toBeGreaterThan(Z_INDEX.modal)
    })

    it("garde les éléments flottants de la page sous les dialogues", () => {
      // Infobulle de cellule tronquée, carte de survol : rien de la page ne doit
      // passer devant un dialogue ouvert.
      expect(Z_INDEX.flottantPage).toBeLessThan(Z_INDEX.dialogueVoile)
      expect(Z_INDEX.flottantPage).toBeGreaterThan(Z_INDEX.panneau)
    })

    it("garde la visionneuse et les notifications au-dessus des confirmations", () => {
      expect(Z_INDEX.visionneuse).toBeGreaterThan(Z_INDEX.confirmation)
      expect(Z_INDEX.notification).toBeGreaterThan(Z_INDEX.visionneuse)
    })
  })
})
