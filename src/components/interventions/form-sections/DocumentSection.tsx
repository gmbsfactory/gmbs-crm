"use client"

import { ChevronDown, ChevronRight, Upload, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { DocumentManager } from "@/components/documents"
import { DocumentReclassificationModal } from "@/components/documents/DocumentReclassificationModal"
import { cn } from "@/lib/utils"

interface DocumentSectionProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  interventionId: string
  currentUser: any
  documentKinds: Array<{ kind: string; label: string }>

  // Validation
  requiresFacture: boolean
  requiresDevis: boolean
  hasFactureGMBS: boolean
  hasDevis: boolean

  // Reclassification
  documentsToReclassify: any[]
  isReclassifyModalOpen: boolean
  onReclassifyModalOpenChange: (open: boolean) => void

  // Callbacks
  onDocumentsChange: () => void
}

export function DocumentSection({
  isOpen,
  onOpenChange,
  interventionId,
  currentUser,
  documentKinds,
  requiresFacture,
  requiresDevis,
  hasFactureGMBS,
  hasDevis,
  documentsToReclassify,
  isReclassifyModalOpen,
  onReclassifyModalOpenChange,
  onDocumentsChange,
}: DocumentSectionProps) {
  return (
    <>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <Card className={cn(
          (requiresFacture && !hasFactureGMBS) && "ring-2 ring-orange-400/50",
          (requiresDevis && !hasDevis) && "ring-2 ring-orange-400/50",
        )}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50 group">
              <CardTitle className="flex items-center gap-2 text-xs justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-3 w-3" />
                  Documents {(requiresFacture || requiresDevis) && <span className="text-orange-500">*</span>}
                  {requiresFacture && !hasFactureGMBS && (
                    <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Facture GMBS obligatoire" />
                  )}
                  {requiresDevis && !hasDevis && (
                    <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Devis GMBS obligatoire" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {documentsToReclassify.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        onReclassifyModalOpenChange(true)
                      }}
                    >
                      <Wand2 className="h-3 w-3 mr-1" />
                      <span className="text-xs hidden sm:inline">Reclassifier</span>
                      <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                        {documentsToReclassify.length}
                      </Badge>
                    </Button>
                  )}
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-3 pb-3">
              <DocumentManager
                entityType="intervention"
                entityId={interventionId}
                kinds={documentKinds}
                currentUser={currentUser ?? undefined}
                onChange={onDocumentsChange}
                highlightedKinds={[
                  ...(requiresFacture && !hasFactureGMBS ? ["facturesGMBS"] : []),
                  ...(requiresDevis && !hasDevis ? ["devis"] : []),
                ]}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Modal de reclassification */}
      <DocumentReclassificationModal
        open={isReclassifyModalOpen}
        onOpenChange={onReclassifyModalOpenChange}
        entityType="intervention"
        entityId={interventionId}
        documentKinds={documentKinds}
      />
    </>
  )
}
