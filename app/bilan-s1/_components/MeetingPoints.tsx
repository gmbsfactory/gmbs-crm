"use client"

import { useState } from "react"
import { Check, ChevronDown, Send, X } from "lucide-react"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import type { BilanPoint } from "@/types/bilan-s1"
import { useBilanS1Points, useReplyToBilanPoint } from "@/hooks/useBilanS1Points"

/** Libellés enregistrés comme réponse quand on tranche par bouton. */
const DECISION_VALIDATE = "✅ Validé — part en devis supplémentaire"
const DECISION_REFUSE = "❌ Refusé"

const replyDateFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

function replyAuthorName(reply: BilanPoint["replies"][number]): string {
  const user = reply.user
  if (!user) return "Utilisateur supprimé"
  return `${user.firstname || ""} ${user.lastname || ""}`.trim() || "Utilisateur"
}

/**
 * Panneau « À traiter en réunion » (écran 3) : chaque point est cliquable ;
 * les personnes ayant accès à la page répondent, les réponses sont
 * horodatées avec leur avatar, et le point passe en « Répondu ».
 */
export function MeetingPoints() {
  const { data: points = [], isLoading, isError, error } = useBilanS1Points(true)
  const replyMutation = useReplyToBilanPoint()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)

  const toggle = (id: string) => {
    setExpandedId((current) => (current === id ? null : id))
    setDraft("")
    setSendError(null)
  }

  const send = (pointId: string) => {
    const body = draft.trim()
    if (!body || replyMutation.isPending) return
    setSendError(null)
    replyMutation.mutate(
      { pointId, body },
      {
        onSuccess: () => setDraft(""),
        onError: (e) => setSendError(e instanceof Error ? e.message : "Erreur lors de l'envoi"),
      }
    )
  }

  const sendDecision = (pointId: string, decision: string) => {
    if (replyMutation.isPending) return
    setSendError(null)
    replyMutation.mutate(
      { pointId, body: decision },
      { onError: (e) => setSendError(e instanceof Error ? e.message : "Erreur lors de l'envoi") }
    )
  }

  const answered = points.filter((p) => p.statut === "repondu").length

  return (
    <div className="card points-card">
      <h3>
        À traiter en réunion{" "}
        <span className="h3-note">
          ({answered}/{points.length} répondu{answered > 1 ? "s" : ""})
        </span>
      </h3>

      {isLoading ? <div className="points-empty">Chargement des points…</div> : null}
      {isError ? (
        <div className="points-empty">
          Impossible de charger les points : {error instanceof Error ? error.message : "erreur"}
        </div>
      ) : null}

      <div className="points-list">
        {points.map((point) => {
          const expanded = expandedId === point.id
          return (
            <div key={point.id} className={expanded ? "point open" : "point"}>
              <button type="button" className="point-head" onClick={() => toggle(point.id)}>
                <span className={`badge ${point.statut === "repondu" ? "b-resolu" : "b-encours"}`}>
                  {point.statut === "repondu" ? "Répondu" : "À qualifier"}
                </span>
                <span className="point-title">{point.titre}</span>
                {point.replies.length > 0 ? (
                  <span className="point-count">
                    {point.replies.length} rép.
                  </span>
                ) : null}
                <ChevronDown className={expanded ? "point-chevron open" : "point-chevron"} aria-hidden="true" />
              </button>

              {expanded ? (
                <div className="point-body">
                  {point.detail ? <p className="point-detail">{point.detail}</p> : null}
                  {point.origine ? <p className="point-origin">{point.origine}</p> : null}

                  {point.replies.length > 0 ? (
                    <div className="point-replies">
                      {point.replies.map((reply) => (
                        <div key={reply.id} className="reply">
                          <GestionnaireBadge
                            firstname={reply.user?.firstname}
                            lastname={reply.user?.lastname}
                            color={reply.user?.color}
                            avatarUrl={reply.user?.avatarUrl}
                            size="xs"
                            showBorder={false}
                          />
                          <div className="reply-content">
                            <div className="reply-meta">
                              <b>{replyAuthorName(reply)}</b> · {replyDateFmt.format(new Date(reply.createdAt)).replace(".", "")}
                            </div>
                            <div className="reply-body">{reply.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {point.reponseType === "decision" ? (
                    <div className="decision-actions">
                      <button
                        type="button"
                        className="btn-decide btn-validate"
                        disabled={replyMutation.isPending}
                        onClick={() => sendDecision(point.id, DECISION_VALIDATE)}
                      >
                        <Check aria-hidden="true" />
                        Valider — devis supp
                      </button>
                      <button
                        type="button"
                        className="btn-decide btn-refuse"
                        disabled={replyMutation.isPending}
                        onClick={() => sendDecision(point.id, DECISION_REFUSE)}
                      >
                        <X aria-hidden="true" />
                        Refuser
                      </button>
                    </div>
                  ) : (
                    <div className="reply-form">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Votre réponse…"
                        rows={2}
                        maxLength={4000}
                      />
                      <button
                        type="button"
                        className="reply-send"
                        disabled={!draft.trim() || replyMutation.isPending}
                        onClick={() => send(point.id)}
                      >
                        <Send aria-hidden="true" />
                        {replyMutation.isPending ? "Envoi…" : "Envoyer"}
                      </button>
                    </div>
                  )}
                  {sendError ? <div className="vis-error">{sendError}</div> : null}
                </div>
              ) : null}
            </div>
          )
        })}
        {!isLoading && !isError && points.length === 0 ? (
          <div className="points-empty">Aucun point à traiter.</div>
        ) : null}
      </div>
    </div>
  )
}
