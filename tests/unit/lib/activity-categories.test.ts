import { describe, it, expect } from "vitest"
import {
  ALL_CATEGORIES,
  actionTypesForCategory,
  catColor,
  catTint,
  categoryOf,
  pageColor,
  pageLabel,
} from "@/lib/monitoring/activity-categories"

describe("activity-categories", () => {
  describe("categoryOf", () => {
    it("mappe les action_types vers la bonne catégorie", () => {
      expect(categoryOf("CREATE")).toBe("create")
      expect(categoryOf("STATUS_CHANGE")).toBe("status")
      expect(categoryOf("COST_ADD")).toBe("finance")
      expect(categoryOf("PAYMENT_DELETE")).toBe("finance")
      expect(categoryOf("DOCUMENT_ADD")).toBe("doc")
      expect(categoryOf("COMMENT_UPDATE")).toBe("comment")
      expect(categoryOf("ARTISAN_ASSIGN")).toBe("assign")
      expect(categoryOf("ARCHIVE")).toBe("archive")
      expect(categoryOf("RESTORE")).toBe("archive")
      expect(categoryOf("UPDATE")).toBe("update")
    })
    it("retombe sur 'update' pour un type inconnu", () => {
      expect(categoryOf("SOMETHING_NEW")).toBe("update")
    })
  })

  it("actionTypesForCategory('finance') couvre coûts et paiements", () => {
    const types = actionTypesForCategory("finance")
    expect(types).toContain("COST_ADD")
    expect(types).toContain("PAYMENT_ADD")
    expect(types).not.toContain("CREATE")
  })

  describe("couleurs via tokens (aucun hex en dur)", () => {
    it("catColor / catTint produisent des hsl(var(--token))", () => {
      expect(catColor("create")).toBe("hsl(var(--success-hsl))")
      expect(catTint("create", 0.2)).toBe("hsl(var(--success-hsl) / 0.2)")
      expect(catColor("status")).toBe("hsl(var(--primary))")
    })
    it("pageColor référence un token", () => {
      expect(pageColor("artisans")).toContain("--chart-1")
      expect(pageColor("interventions")).toContain("--chart-3")
    })
  })

  describe("pageLabel", () => {
    it("retourne le libellé connu ou 'Autre'", () => {
      expect(pageLabel("interventions")).toBe("Interventions")
      expect(pageLabel("comptabilite")).toBe("Comptabilité")
      expect(pageLabel(null)).toBe("Autre")
      expect(pageLabel("inconnue")).toBe("inconnue")
    })
  })

  it("expose 9 catégories (dont email)", () => {
    expect(ALL_CATEGORIES).toHaveLength(9)
    expect(ALL_CATEGORIES).toContain("email")
  })
})
