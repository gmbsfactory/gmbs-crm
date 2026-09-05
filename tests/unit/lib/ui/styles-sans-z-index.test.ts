import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

/**
 * Garde-fou : aucune feuille de style ne doit déclarer de z-index sur une
 * surface modale ou flottante.
 *
 * Pourquoi ce test existe : le bug signalé par le client (le motif de refus
 * d'une pièce derrière la fiche artisan) venait d'une valeur écrite en CSS,
 * invisible depuis les classes des composants. Les tests qui lisent la classe
 * Tailwind ne pouvaient pas le voir. Celui-ci relit la CSS elle-même.
 *
 * La superposition a UNE source de vérité : src/lib/ui/z-index.ts.
 * Voir docs/conventions/z-index.md
 */

const DOSSIER_STYLES = join(process.cwd(), "app", "styles")

/** Sélecteurs de surfaces dont la superposition appartient à l'échelle. */
const SELECTEURS_SURVEILLES = [
  ".modal-overlay",
  ".shadcn-dialog-overlay",
  ".shadcn-dialog-content",
  ".shadcn-sheet-content",
  ".shadcn-popover-content",
  ".modal-surface",
  ".modal-content",
  ".tooltip-surface",
  ".dropdown",
  ".drawer",
]

interface RegleCss {
  fichier: string
  selecteur: string
  corps: string
}

/**
 * Découpe grossièrement une feuille en règles « sélecteurs { corps } ».
 * Suffisant ici : on ne cherche qu'une déclaration, pas à analyser la cascade.
 */
function lireRegles(fichier: string, contenu: string): RegleCss[] {
  const sansCommentaires = contenu.replace(/\/\*[\s\S]*?\*\//g, "")
  const regles: RegleCss[] = []
  const motif = /([^{}]+)\{([^{}]*)\}/g
  let trouve: RegExpExecArray | null
  while ((trouve = motif.exec(sansCommentaires)) !== null) {
    regles.push({
      fichier,
      selecteur: trouve[1].trim().replace(/\s+/g, " "),
      corps: trouve[2],
    })
  }
  return regles
}

function toutesLesRegles(): RegleCss[] {
  return readdirSync(DOSSIER_STYLES)
    .filter((nom) => nom.endsWith(".css"))
    .flatMap((nom) => lireRegles(nom, readFileSync(join(DOSSIER_STYLES, nom), "utf-8")))
}

/** Le sélecteur cible-t-il exactement cette classe (et pas `.dropdown-item`) ? */
function cible(selecteur: string, classe: string): boolean {
  const echappee = classe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`${echappee}(?![\\w-])`).test(selecteur)
}

describe("Feuilles de style et échelle de superposition", () => {
  it("ne déclare aucun z-index sur une surface modale ou flottante", () => {
    const fautives = toutesLesRegles()
      .filter((regle) => /(^|[;\s])z-index\s*:/.test(regle.corps))
      .filter((regle) => SELECTEURS_SURVEILLES.some((classe) => cible(regle.selecteur, classe)))
      .map((regle) => `${regle.fichier} — ${regle.selecteur}`)

    expect(
      fautives,
      "Ces règles CSS créent une seconde source de vérité pour la superposition. "
        + "Retirer le z-index et passer par Z_CLASS (src/lib/ui/z-index.ts).",
    ).toEqual([])
  })

  it("surveille bien des sélecteurs réellement présents dans les feuilles", () => {
    // Sinon la garde ci-dessus deviendrait vide au premier renommage de classe.
    const regles = toutesLesRegles()
    const presents = SELECTEURS_SURVEILLES.filter((classe) =>
      regles.some((regle) => cible(regle.selecteur, classe)),
    )
    expect(presents).toEqual(SELECTEURS_SURVEILLES)
  })
})
