import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import InterventionsKanban from "@/components/interventions/InterventionsKanban"
import type { InterventionView } from "@/types/intervention-view"

/**
 * Signal « Démarré · n champs manquants » en KANBAN (spec §7.7, lot L2 point 7).
 *
 * Le glisser-déposer de `@dnd-kit` n'a rien à voir avec le badge : on remplace
 * la coquille du kanban par des `div` pour tester la carte, et rien d'autre.
 */
const kanbanState = vi.hoisted(() => ({ data: [] as { id: string; column: string }[] }))

vi.mock("@/components/ui/kanban", () => ({
  KanbanProvider: ({
    children,
    data,
    columns,
  }: {
    children: (c: { id: string }) => React.ReactNode
    data: { id: string; column: string }[]
    columns: { id: string }[]
  }) => {
    kanbanState.data = data
    return <div>{columns.map((column) => <div key={column.id}>{children(column)}</div>)}</div>
  },
  KanbanBoard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KanbanHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KanbanCards: ({ children, id }: { children: (i: never) => React.ReactNode; id: string }) => (
    <div data-column={id}>
      {kanbanState.data
        .filter((item) => item.column === id)
        .map((item) => (
          <div key={item.id}>{children(item as never)}</div>
        ))}
    </div>
  ),
  KanbanCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const DEMARRE = "2026-09-12T08:40:00.000Z"

function intervention(over: Record<string, unknown> = {}): InterventionView {
  return {
    id: "i-1",
    idIntervention: "DEMO-004",
    statusValue: "ACCEPTE",
    nomClient: "Durand",
    prenomClient: "Jeanne",
    ...over,
  } as unknown as InterventionView
}

function renderKanban(item: InterventionView) {
  return render(
    <InterventionsKanban
      interventions={[item]}
      statuses={["ACCEPTE", "INTER_EN_COURS"]}
      loading={false}
      error={null}
      onStatusChange={vi.fn()}
    />,
  )
}

describe("InterventionsKanban — pastilles du portail", () => {
  it("should show the missing-fields pill on a started card whose status stayed ACCEPTE", () => {
    renderKanban(intervention({ portal_work_started_at: DEMARRE, portal_work_missing_count: 2 }))
    const badge = screen.getByText("Démarré · 2 champs manquants")
    expect(badge).toBeInTheDocument()
    // Couleur partagée avec la liste et le modal, jamais redéclarée ici.
    expect((badge as HTMLElement).style.backgroundColor).toBe("rgb(217, 119, 6)")
  })

  it("should show nothing when no start was declared", () => {
    renderKanban(intervention())
    expect(screen.queryByText(/Démarré/)).not.toBeInTheDocument()
  })

  it("should show nothing once the status has followed", () => {
    renderKanban(
      intervention({
        statusValue: "INTER_EN_COURS",
        portal_work_started_at: DEMARRE,
        portal_work_missing_count: 2,
      }),
    )
    expect(screen.queryByText(/Démarré/)).not.toBeInTheDocument()
  })

  it("should let « À vérifier » win: two pills on one card is one too many", () => {
    renderKanban(
      intervention({
        has_portal_report: true,
        portal_work_started_at: DEMARRE,
        portal_work_missing_count: 2,
      }),
    )
    expect(screen.getByText("À vérifier")).toBeInTheDocument()
    expect(screen.queryByText(/Démarré/)).not.toBeInTheDocument()
  })
})
