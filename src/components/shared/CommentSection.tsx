"use client"

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { commentsApi } from "@/lib/api/commentsApi"
import type { Comment } from "@/lib/api/common/types"
import { commentKeys } from "@/lib/react-query/queryKeys"
import { useModalFreshness } from "@/hooks/useModalFreshness"
import { cn } from "@/lib/utils"
import { Send, Edit, Trash2 } from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { getHighlightSegments } from "@/components/search/highlight"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"

interface CommentSectionProps {
  entityType: "artisan" | "intervention"
  entityId: string
  currentUserId?: string | null
  limit?: number
  scrollFadeColor?: string | null
  scrollFadeInsetLeft?: number
  scrollFadeInsetRight?: number
  disableScrollFades?: boolean
  /** Requête de recherche pour surligner les termes correspondants */
  searchQuery?: string
  /** Active le polling T2 (5s) quand le modal parent est ouvert (défaut: true) */
  isModalOpen?: boolean
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }
  try {
    const now = new Date()
    const isCurrentYear = date.getFullYear() === now.getFullYear()

    if (isCurrentYear) {
      // Année en cours : "11 févr. 14:30" (pas d'année)
      return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    }

    // Années précédentes : "11 févr. 25 14:30" (année courte sur 2 chiffres)
    const dayMonth = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
    }).format(date)
    const yearShort = String(date.getFullYear()).slice(-2)
    const time = new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)

    return `${dayMonth} ${yearShort} ${time}`
  } catch {
    return value
  }
}

const getInitials = (name: string) => {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return parts
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

const normalizeHexColor = (color?: string | null) => {
  if (!color) return null
  const trimmed = color.trim()
  if (!trimmed) return null
  let hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("")
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null
  }
  return hex
}

const getAvatarTextColorClass = (color?: string | null) => {
  const normalized = normalizeHexColor(color)
  if (!normalized) {
    return "text-white"
  }
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.65 ? "text-black" : "text-white"
}

const normalizedHexToRgba = (normalizedHex: string, alpha: number) => {
  const r = parseInt(normalizedHex.slice(0, 2), 16)
  const g = parseInt(normalizedHex.slice(2, 4), 16)
  const b = parseInt(normalizedHex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const createFadeGradient = (position: "top" | "bottom", color?: string | null) => {
  const normalized = normalizeHexColor(color)
  if (!normalized) return null
  const direction = position === "top" ? "to bottom" : "to top"
  const strong = normalizedHexToRgba(normalized, 0.92)
  const mid = normalizedHexToRgba(normalized, 0.45)
  return `linear-gradient(${direction}, ${strong} 0%, ${mid} 55%, transparent 100%)`
}

type CommentAuthorDetails = NonNullable<Comment["users"]>

const SCROLL_DEBOUNCE_MS = 50
const CONTEXT_MENU_ENABLED = false

const blurActiveElement = () => {
  if (typeof document === "undefined") return
  const active = document.activeElement as HTMLElement | null
  if (active && typeof active.blur === "function") {
    active.blur()
  }
}

/** Helper pour rendre du texte avec surlignage des termes de recherche */
function HighlightedText({ text, searchQuery }: { text: string; searchQuery: string }) {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return <>{text}</>
  }
  const segments = getHighlightSegments(text, searchQuery)
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${segment.text}-${index}`}
          className={segment.isMatch ? "search-highlight" : undefined}
        >
          {segment.text}
        </span>
      ))}
    </>
  )
}

export function CommentSection({
  entityType,
  entityId,
  currentUserId,
  limit = 50,
  scrollFadeColor,
  scrollFadeInsetLeft = 0,
  scrollFadeInsetRight = 0,
  disableScrollFades = false,
  searchQuery = "",
  isModalOpen = true,
}: CommentSectionProps) {
  const [newComment, setNewComment] = useState("")
  const textareaId = useId()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousLengthRef = useRef(0)
  const [latestCommentId, setLatestCommentId] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editingOriginalContentRef = useRef("")
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setNewComment("")
    setEditingCommentId(null)
    setEditingContent("")
    setDeletingCommentId(null)
    editingOriginalContentRef.current = ""
  }, [entityId])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const wrapper =
      root.closest(".card-table-wrapper") ??
      root.closest("[aria-hidden]")
    if (!wrapper) return

    const handleHidden = () => {
      if (wrapper.getAttribute("aria-hidden") === "true") {
        blurActiveElement()
      }
    }

    handleHidden()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "aria-hidden") {
          handleHidden()
        }
      }
    })

    observer.observe(wrapper, { attributes: true, attributeFilter: ["aria-hidden"] })
    return () => observer.disconnect()
  }, [entityId])

  // T2 Freshness: poll comments at 5s only when modal is open and visible
  const { queryOptions: freshnessOptions } = useModalFreshness(isModalOpen)

  const {
    data: comments = [],
    isLoading,
    isError,
    error,
  } = useQuery<Comment[]>({
    queryKey: commentKeys.byEntityPaginated(entityType, entityId, limit),
    enabled: Boolean(entityId),
    queryFn: async () => {
      const items = await commentsApi.getByEntity(entityType, entityId, { limit })
      return items
    },
    ...freshnessOptions,
  })

  const createComment = useMutation({
    mutationFn: async (content: string) =>
      commentsApi.create({
        entity_id: entityId,
        entity_type: entityType,
        content,
        comment_type: "internal",
        is_internal: true,
        author_id: currentUserId ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.invalidateByEntity(entityType, entityId) })
      setNewComment("")
      toast({
        title: "Commentaire ajouté",
        description: "Votre commentaire a été enregistré avec succès.",
      })
    },
    onError: (mutationError) => {
      const description =
        mutationError instanceof Error ? mutationError.message : "Impossible d'ajouter le commentaire"
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      })
    },
  })

  const updateComment = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) =>
      commentsApi.update(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.invalidateByEntity(entityType, entityId) })
      setEditingCommentId(null)
      setEditingContent("")
      editingOriginalContentRef.current = ""
      toast({
        title: "Commentaire modifié",
        description: "Votre commentaire a été mis à jour avec succès.",
      })
    },
    onError: (mutationError) => {
      const description =
        mutationError instanceof Error ? mutationError.message : "Impossible de modifier le commentaire"
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      })
    },
  })

  const deleteComment = useMutation({
    mutationFn: async (id: string) => commentsApi.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.invalidateByEntity(entityType, entityId) })
      toast({
        title: "Commentaire supprimé",
        description: "Votre commentaire a été supprimé avec succès.",
        duration: 3500,
      })
    },
    onError: (mutationError) => {
      const description =
        mutationError instanceof Error ? mutationError.message : "Impossible de supprimer le commentaire"
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      })
    },
    onSettled: () => {
      requestAnimationFrame(() => {
        const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null
        textarea?.focus()
      })
    },
  })

  const closeDeleteDialog = useCallback(() => {
    setDeletingCommentId(null)
  }, [])

  const trimmedComment = newComment.trim()

  const handleSubmit = () => {
    if (!trimmedComment || createComment.isPending || !currentUserId) {
      return
    }
    createComment.mutate(trimmedComment)
  }

  const handleStartEdit = (comment: Comment) => {
    const content = comment.content || ""
    editingOriginalContentRef.current = content
    setEditingCommentId(comment.id)
    setEditingContent(content)
  }

  const handleCancelEdit = () => {
    setEditingCommentId(null)
    setEditingContent("")
    editingOriginalContentRef.current = ""
  }

  const handleSaveEdit = useCallback(() => {
    const trimmed = editingContent.trim()
    if (!editingCommentId || !trimmed || updateComment.isPending) {
      return
    }
    if (trimmed === editingOriginalContentRef.current.trim()) {
      handleCancelEdit()
      return
    }
    updateComment.mutate({ id: editingCommentId, content: trimmed })
  }, [editingContent, editingCommentId, updateComment])

  const handleDelete = () => {
    if (!deletingCommentId || deleteComment.isPending) {
      return
    }

    const targetId = deletingCommentId
    blurActiveElement()
    closeDeleteDialog()
    deleteComment.mutate(targetId)
  }

  const handleDeleteRequest = useCallback((commentId: string) => {
    blurActiveElement()
    if (editingCommentId === commentId) {
      handleCancelEdit()
    }
    setDeletingCommentId(commentId)
  }, [editingCommentId])

  useEffect(() => {
    if (!editingCommentId) {
      editingTextareaRef.current = null
      return
    }

    const frame = requestAnimationFrame(() => {
      const textarea = editingTextareaRef.current
      if (!textarea) return
      textarea.focus()
      const length = textarea.value.length
      textarea.setSelectionRange(length, length)
    })

    return () => cancelAnimationFrame(frame)
  }, [editingCommentId])

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      handleSubmit()
    }
  }

  const orderedComments = useMemo(() => {
    if (!comments?.length) {
      return []
    }
    return [...comments].sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
      return aDate - bDate
    })
  }, [comments])

  const placeholderText = currentUserId ? "Écrivez votre commentaire ici..." : "Chargement des informations utilisateur…"
  const isSubmitDisabled = !currentUserId || !trimmedComment || createComment.isPending

  const evaluateScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) {
      setCanScrollUp(false)
      setCanScrollDown(false)
      return
    }

    const { scrollTop, clientHeight, scrollHeight } = element
    setCanScrollUp(scrollTop > 2)
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 2)
  }, [])

  useEffect(() => {
    evaluateScroll()
  }, [orderedComments, evaluateScroll])

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  const handleScroll = useCallback(() => {
    evaluateScroll()
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(evaluateScroll, SCROLL_DEBOUNCE_MS)
  }, [evaluateScroll])

  useEffect(() => {
    const currentLength = orderedComments.length
    if (currentLength === 0) {
      previousLengthRef.current = 0
      setLatestCommentId(null)
      return
    }

    const lastCommentId = orderedComments[currentLength - 1]?.id ?? null
    setLatestCommentId(lastCommentId)

    const shouldScrollToBottom =
      previousLengthRef.current !== currentLength || previousLengthRef.current === 0

    previousLengthRef.current = currentLength

    if (!shouldScrollToBottom) {
      return
    }

    requestAnimationFrame(() => {
      const element = scrollRef.current
      if (!element) return
      element.scrollTop = element.scrollHeight
      evaluateScroll()
    })
  }, [orderedComments, evaluateScroll])

  const topFadeBackground = useMemo(
    () => (disableScrollFades ? null : createFadeGradient("top", scrollFadeColor)),
    [scrollFadeColor, disableScrollFades],
  )
  const bottomFadeBackground = useMemo(
    () => (disableScrollFades ? null : createFadeGradient("bottom", scrollFadeColor)),
    [scrollFadeColor, disableScrollFades],
  )

  const commentsContent = useMemo(() => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <div className="h-20 rounded bg-muted animate-pulse" />
          <div className="h-20 rounded bg-muted animate-pulse" />
        </div>
      )
    }

    if (isError) {
      const message =
        error instanceof Error ? error.message : "Impossible de charger les commentaires pour le moment."
      return <p className="text-sm text-destructive">{message}</p>
    }

    if (!orderedComments.length) {
      return <p className="text-sm text-muted-foreground">Aucun commentaire pour le moment.</p>
    }

    return (
      <div className="relative max-h-[320px] overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex flex-col gap-3 overflow-y-auto pr-1 scrollbar-minimal"
          style={{ maxHeight: 320 }}
        >
          {orderedComments.map((comment) => {
            const authorDetails = comment.users as CommentAuthorDetails | undefined
            // DEBUG: Log pour diagnostiquer le problème d'avatar_url
            if (process.env.NODE_ENV === 'development' || typeof window !== 'undefined') {
            }
            const authorName =
              authorDetails &&
              ([authorDetails.firstname, authorDetails.lastname].filter(Boolean).join(" ").trim() ||
                authorDetails.username)
            const displayAuthor = authorName || "Utilisateur"
            const userColor = authorDetails?.color ?? null
            const normalizedBubbleColor = normalizeHexColor(userColor)
            const avatarTextClass = userColor ? getAvatarTextColorClass(userColor) : ""
            const isCurrentUserComment = Boolean(currentUserId && comment.author_id === currentUserId)
            const formattedDate = formatDateTime(comment.created_at)
            
            // Calcul dynamique de l'arrondi basé sur le nombre de lignes
            const lineCount = (comment.content?.split('\n').length ?? 1) + Math.floor((comment.content?.length ?? 0) / 40)
            const getBubbleRounding = (lines: number): string => {
              if (lines <= 1) return "rounded-2xl" // Court: arrondis modérés pour éviter l'effet cercle
              if (lines <= 2) return "rounded-2xl"
              if (lines <= 4) return "rounded-xl"
              return "rounded-lg" // Long: arrondis plus subtils pour une vraie bulle
            }
            const bubbleRounding = getBubbleRounding(lineCount)
            
            const bubbleBaseClass =
              `message-bubble inline-flex max-w-full whitespace-pre-wrap break-words ${bubbleRounding} border px-4 py-2 text-left text-sm leading-relaxed shadow-inner shadow-black/10 backdrop-blur-sm transition-all data-[new=true]:animate-in data-[new=true]:fade-in-0 data-[new=true]:slide-in-from-bottom-2`
            const bubbleToneClass = normalizedBubbleColor
              ? ""
              : isCurrentUserComment
                  ? "border-primary/30 bg-primary/10 text-primary-foreground/80"
                  : "border-border/40 bg-background/70 text-foreground"
            const bubbleClassName = cn(
              bubbleBaseClass,
              bubbleToneClass,
              normalizedBubbleColor ? avatarTextClass : "",
              CONTEXT_MENU_ENABLED && isCurrentUserComment ? "cursor-context-menu" : "",
            )
            const isEditing = editingCommentId === comment.id
            const reasonBadge =
              comment.reason_type === "archive"
                ? {
                    label: "archivage",
                    className: "bg-slate-200 text-slate-700 border-slate-300",
                  }
                : comment.reason_type === "done"
                  ? {
                      label: "terminé",
                      className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
                    }
                  : null

            const bubbleStyle = normalizedBubbleColor
              ? {
                  backgroundColor: normalizedHexToRgba(
                    normalizedBubbleColor,
                    isCurrentUserComment ? 0.32 : 0.2,
                  ),
                  borderColor: normalizedHexToRgba(normalizedBubbleColor, 0.5),
                }
              : undefined

            const bubbleElement = (
              <div className={bubbleClassName} style={bubbleStyle} data-new={comment.id === latestCommentId}>
                {searchQuery && searchQuery.trim().length > 0 ? (
                  <HighlightedText text={comment.content} searchQuery={searchQuery} />
                ) : (
                  comment.content
                )}
              </div>
            )

            const renderedBubble =
              CONTEXT_MENU_ENABLED && isCurrentUserComment ? (
                <ContextMenu>
                  <ContextMenuTrigger asChild>{bubbleElement}</ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => handleStartEdit(comment)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Modifier
                    </ContextMenuItem>
                    <ContextMenuItem
                      onSelect={() => handleDeleteRequest(comment.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ) : (
                bubbleElement
              )

            return (
              <div
                key={comment.id}
                className={cn("flex w-full", isCurrentUserComment ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "flex w-full max-w-[95%] items-start gap-3",
                    isCurrentUserComment ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <GestionnaireBadge
                    firstname={authorDetails?.firstname ?? null}
                    lastname={authorDetails?.lastname ?? null}
                    color={userColor}
                    avatarUrl={authorDetails?.avatar_url ?? null}
                    size="md"
                    showBorder={true}
                    className="h-10 w-10"
                  />
                  <div
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 text-sm leading-relaxed",
                      isCurrentUserComment ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {isEditing ? (
                      <div
                        className={cn(
                          "flex min-w-0 flex-1 flex-col gap-3 rounded-3xl border border-border/40 bg-background/80 px-4 py-3 shadow-inner shadow-black/10 backdrop-blur-sm",
                          isCurrentUserComment ? "items-end text-right" : "items-start text-left"
                        )}
                      >
                        <Textarea
                          ref={(node) => {
                            if (isEditing) {
                              editingTextareaRef.current = node
                            }
                          }}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={3}
                          className="min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          aria-label="Modifier votre commentaire"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              handleCancelEdit()
                            } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                              e.preventDefault()
                              handleSaveEdit()
                            }
                          }}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={updateComment.isPending}
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={
                              !editingContent.trim() ||
                              editingContent.trim() === editingOriginalContentRef.current.trim() ||
                              updateComment.isPending
                            }
                          >
                            Enregistrer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex min-w-0 flex-1 flex-col gap-1",
                          isCurrentUserComment ? "items-end text-right" : "items-start text-left"
                        )}
                      >
                        {/* Ligne date + bulle : date toujours à l'opposé de la bulle, centrée verticalement */}
                        <div className="flex w-full min-w-0 items-center gap-2 flex-row">
                          {isCurrentUserComment ? (
                            <>
                              <time
                                dateTime={comment.created_at ?? undefined}
                                className="flex-shrink-0 whitespace-nowrap text-xs italic text-muted-foreground"
                              >
                                {formattedDate}
                              </time>
                              <div className="flex min-w-0 flex-1 justify-end">
                                {renderedBubble}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex min-w-0 flex-1 justify-start">
                                {renderedBubble}
                              </div>
                              <time
                                dateTime={comment.created_at ?? undefined}
                                className="flex-shrink-0 whitespace-nowrap text-xs italic text-muted-foreground"
                              >
                                {formattedDate}
                              </time>
                            </>
                          )}
                        </div>
                        {/* Badge reason reste en dessous */}
                        {reasonBadge ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              reasonBadge.className,
                            )}
                          >
                            {reasonBadge.label}
                          </Badge>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {canScrollUp && !disableScrollFades ? (
          <div
            className={cn(
              "pointer-events-none absolute top-0 h-6",
              !topFadeBackground && "inset-x-0 bg-gradient-to-b from-background/95 via-background/60 to-transparent",
            )}
            style={{
              left: scrollFadeInsetLeft,
              right: scrollFadeInsetRight,
              backgroundImage: topFadeBackground ?? undefined,
            }}
          />
        ) : null}
        {canScrollDown && !disableScrollFades ? (
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 h-6",
              !bottomFadeBackground && "inset-x-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent",
            )}
            style={{
              left: scrollFadeInsetLeft,
              right: scrollFadeInsetRight,
              backgroundImage: bottomFadeBackground ?? undefined,
            }}
          />
        ) : null}
      </div>
    )
  }, [
    orderedComments,
    currentUserId,
    error,
    isError,
    isLoading,
    handleScroll,
    canScrollUp,
    canScrollDown,
    disableScrollFades,
    scrollFadeInsetLeft,
    scrollFadeInsetRight,
    topFadeBackground,
    bottomFadeBackground,
    latestCommentId,
    editingCommentId,
    handleDeleteRequest,
    handleSaveEdit,
    editingContent,
    updateComment.isPending,
    searchQuery,
  ])

  return (
    <>
      <div ref={rootRef} className="space-y-4">
        {commentsContent}

        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-border/40 bg-background/70 px-3 py-1 shadow-inner shadow-black/10 backdrop-blur-sm">
            <Textarea
              id={textareaId}
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={placeholderText}
              disabled={!currentUserId || createComment.isPending}
              className="max-h-24 flex-1 resize-none border-none bg-transparent px-1 py-2 text-sm text-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ minHeight: 0 }}
            />
          </div>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            size="icon"
            className={cn(
              "h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-inner shadow-black/20 transition",
              "hover:bg-primary/90"
            )}
            aria-label="Envoyer le commentaire (Ctrl/Cmd + Entrée)"
            title="Envoyer (Ctrl/Cmd + Entrée)"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deletingCommentId} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le commentaire</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce commentaire ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-80"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
