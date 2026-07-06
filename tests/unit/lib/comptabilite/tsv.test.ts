import { describe, expect, it } from "vitest"
import { escapeTsvCell, rowsToTsv } from "@/lib/comptabilite/tsv"

describe("escapeTsvCell", () => {
  it("laisse un champ simple intact", () => {
    expect(escapeTsvCell("Plomberie")).toBe("Plomberie")
    expect(escapeTsvCell("115,00€")).toBe("115,00€")
    expect(escapeTsvCell("")).toBe("")
  })

  it("entoure de guillemets et double les guillemets internes (cas inter 21343)", () => {
    // Contexte réel commençant par un guillemet non fermé -> avalait les colonnes suivantes.
    expect(escapeTsvCell('"Bonjour, le mitigeur est bloqué')).toBe('"""Bonjour, le mitigeur est bloqué"')
    expect(escapeTsvCell('un "vrai" souci')).toBe('"un ""vrai"" souci"')
  })

  it("échappe aussi les tabulations et retours ligne (sécurité)", () => {
    expect(escapeTsvCell("a\tb")).toBe('"a\tb"')
    expect(escapeTsvCell("ligne1\nligne2")).toBe('"ligne1\nligne2"')
  })
})

describe("rowsToTsv", () => {
  it("préserve les colonnes de chaque ligne malgré un guillemet dans le contexte", () => {
    const rows = [
      ["21343", '"Bonjour, mitigeur bloqué', "42,09 €", "223,25 €", "80,00 €"],
      ["21095", "Devis supp 20841", "0,00 €", "204,90 €", "145,00 €"],
    ]
    const tsv = rowsToTsv(rows)
    const lines = tsv.split("\n")

    // Deux lignes distinctes : le guillemet n'a pas fusionné les lignes.
    expect(lines).toHaveLength(2)
    // La cellule contexte de la 21343 est échappée (guillemet ouvrant doublé + entourée).
    expect(lines[0]).toContain('"""Bonjour, mitigeur bloqué"')
    // Les colonnes coûts restent bien APRÈS la cellule contexte, dans leurs propres colonnes.
    expect(lines[0].endsWith("\t42,09 €\t223,25 €\t80,00 €")).toBe(true)
    // La ligne suivante n'a pas été absorbée.
    expect(lines[1].startsWith("21095\t")).toBe(true)
  })
})
