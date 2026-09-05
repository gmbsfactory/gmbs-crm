'use client';

import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Mail, Loader2, ZoomIn, ZoomOut, RotateCcw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-client';
import { interventionsApi } from '@/lib/api';
import { emailLogKeys, interventionKeys } from '@/lib/react-query/queryKeys';
import { useEmailLogsByType, type EmailLog } from '@/hooks/useEmailLogs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { EmailTemplateData } from '@/lib/email-templates/intervention-emails';
import { generateDevisEmailTemplate, generateInterventionEmailTemplate } from '@/lib/email-templates/intervention-emails';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEmailAttachments } from './useEmailAttachments';
import {
  EMAIL_ATTACHMENT_UPLOAD_KINDS,
  MAX_EMAIL_ATTACHMENTS,
  MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES,
  MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL,
  formatFileSize,
  labelForAttachmentKind,
} from '@/lib/interventions/email-attachments';
import DOMPurify from 'dompurify';

export interface EmailEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailType: 'devis' | 'intervention';
  artisanId: string;
  artisanEmail: string;
  interventionId: string;
  templateData: EmailTemplateData;
  sstPriceSaveContext?: {
    originalValue: string;
    artisanOrder: 1 | 2;
    persistedArtisanOrder?: 1 | 2 | null;
  };
}

// Lot L7 (spec §5.6) : les pièces jointes ne viennent plus du disque du gestionnaire mais de
// l'intervention (`intervention_attachments`), et le serveur lit les fichiers dans Storage.
// Le corps de la requête ne transporte donc plus de base64, et le plafond Vercel de ~3,2 Mo
// qui bornait auparavant l'envoi a disparu : seule reste la limite SMTP (voir
// MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL).

interface SstPriceChange {
  previousAmount: number | null;
  nextAmount: number;
  previousLabel: string;
  nextLabel: string;
}

function parseSstAmount(value: string | null | undefined): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

function amountToCents(amount: number | null): number | null {
  return amount === null ? null : Math.round(amount * 100);
}

function formatSstAmountLabel(amount: number | null, fallback?: string): string {
  if (amount === null) {
    const trimmedFallback = fallback?.trim();
    return trimmedFallback || 'Non spécifié';
  }

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function updateSstCostInCache(
  old: any,
  amount: number,
  artisanOrder: 1 | 2,
  persistedArtisanOrder: 1 | 2 | null,
) {
  if (!old) return old;

  const existingCosts = Array.isArray(old.intervention_costs)
    ? old.intervention_costs
    : Array.isArray(old.costs)
      ? old.costs
      : [];

  const matchesTargetCost = (cost: any) => (
    cost.cost_type === 'sst' &&
    (cost.artisan_order ?? 1) === artisanOrder
  );

  const existingCost = existingCosts.find(matchesTargetCost);
  const nextCost = {
    ...(existingCost || {}),
    cost_type: 'sst',
    amount,
    label: artisanOrder === 2 ? 'Coût SST 2ème artisan' : 'Coût SST',
    artisan_order: persistedArtisanOrder,
  };

  const nextCosts = existingCost
    ? existingCosts.map((cost: any) => matchesTargetCost(cost) ? nextCost : cost)
    : [...existingCosts, nextCost];

  const totalSst = nextCosts
    .filter((cost: any) => cost.cost_type === 'sst')
    .reduce((sum: number, cost: any) => sum + (Number(cost.amount) || 0), 0);

  return {
    ...old,
    costs: nextCosts,
    intervention_costs: nextCosts,
    coutSST: totalSst || old.coutSST,
  };
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'hier';
  if (diffD < 7) return `il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function EmailHistoryEntry({ log }: { log: EmailLog }) {
  const isSent = log.status === 'sent';
  const senderName = [log.sender_firstname, log.sender_lastname].filter(Boolean).join(' ') || 'Inconnu';
  const fullDate = new Date(log.sent_at).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-2 px-3 py-2 border-b last:border-b-0 text-xs">
      {isSent ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0 cursor-default" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs text-xs">
              {log.error_message || 'Envoi échoué'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{log.recipient_email}</span>
        </div>
        <p className="text-muted-foreground truncate" title={log.subject}>{log.subject}</p>
        <div className="flex items-center gap-1.5 text-muted-foreground/70">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">{formatRelativeTime(log.sent_at)}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{fullDate}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span>·</span>
          <span className="truncate">{senderName}</span>
        </div>
      </div>
    </div>
  );
}

export function EmailEditModal({
  isOpen,
  onClose,
  emailType,
  artisanId,
  artisanEmail,
  interventionId,
  templateData,
  sstPriceSaveContext,
}: EmailEditModalProps) {
  const queryClient = useQueryClient();
  const { data: emailHistory, isLoading: isHistoryLoading } = useEmailLogsByType(
    interventionId,
    emailType,
    { enabled: isOpen }
  );
  const [showHistory, setShowHistory] = useState(false);
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSstPriceConfirm, setShowSstPriceConfirm] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100); // Zoom percentage (100 = 100%)
  const [optimalZoom, setOptimalZoom] = useState(100); // Calculated optimal zoom
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);

  // Pièces jointes : lignes d'`intervention_attachments` cochées par le gestionnaire.
  const { data: currentUser } = useCurrentUser({ enabled: isOpen });
  const uploader = currentUser
    ? {
        id: currentUser.id,
        displayName:
          [currentUser.firstname, currentUser.lastname].filter(Boolean).join(' ') ||
          currentUser.username ||
          currentUser.email ||
          'Gestionnaire',
        code: currentUser.code_gestionnaire ?? null,
        color: currentUser.color ?? null,
      }
    : undefined;

  const emailAttachments = useEmailAttachments({
    interventionId,
    emailType,
    isOpen,
    uploader,
  });

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setPreviewZoom(prev => Math.min(prev + 10, 150));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPreviewZoom(prev => Math.max(prev - 10, 30));
  }, []);

  const handleZoomReset = useCallback(() => {
    setPreviewZoom(optimalZoom);
  }, [optimalZoom]);

  // Editable template data fields (only commentaire and coutSST)
  const [editableData, setEditableData] = useState<Partial<EmailTemplateData>>({
    commentaire: templateData.commentaire || '',
    coutSST: templateData.coutSST || '',
  });

  // Generate default subject based on email type
  const getDefaultSubject = useCallback(() => {
    const interventionRef = templateData.idIntervention || 'XXXX';
    if (emailType === 'devis') {
      return `Demande de devis - Intervention #${interventionRef}`;
    }
    return `Demande d'intervention - Intervention #${interventionRef}`;
  }, [emailType, templateData.idIntervention]);

  // Initialize editable data only when modal opens (not on every templateData reference change)
  useEffect(() => {
    if (isOpen && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setEditableData({
        commentaire: templateData.commentaire || '',
        coutSST: templateData.coutSST || '',
      });
      setSubject(getDefaultSubject());
    }
    if (!isOpen) {
      hasInitializedRef.current = false;
    }
  }, [isOpen, templateData, getDefaultSubject]);

  // Regenerate HTML when editable fields change
  useEffect(() => {
    if (isOpen && artisanId) {
      const updatedTemplateData: EmailTemplateData = {
        nomClient: templateData.nomClient,
        telephoneClient: templateData.telephoneClient,
        adresse: templateData.adresse,
        idIntervention: templateData.idIntervention,
        consigneArtisan: templateData.consigneArtisan,
        commentaire: editableData.commentaire,
        datePrevue: templateData.datePrevue,
        coutSST: editableData.coutSST,
        isVacant: templateData.isVacant,
        keyCode: templateData.keyCode,
        floor: templateData.floor,
        apartmentNumber: templateData.apartmentNumber,
        vacantHousingInstructions: templateData.vacantHousingInstructions,
      };

      try {
        const newHtmlContent = emailType === 'devis'
          ? generateDevisEmailTemplate(updatedTemplateData)
          : generateInterventionEmailTemplate(updatedTemplateData);
        setHtmlContent(newHtmlContent);
      } catch (error) {
        console.error('[EmailEditModal] Failed to regenerate template:', error);
      }
    }
  }, [editableData.commentaire, editableData.coutSST, isOpen, artisanId, emailType, templateData]);

  // Note: Initial HTML generation is handled by the "Regenerate HTML" effect above
  // when editableData is first set on modal open.

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Calculate optimal zoom to fit content
  const calculateOptimalZoom = useCallback(() => {
    if (!previewContainerRef.current || !previewContentRef.current) return;

    const contentEl = previewContentRef.current;
    const containerEl = previewContainerRef.current;
    
    // Temporarily set zoom to 100% to measure actual content
    const originalTransform = contentEl.style.transform;
    contentEl.style.transform = 'scale(1)';
    
    const containerHeight = containerEl.clientHeight;
    const contentHeight = contentEl.scrollHeight;
    
    contentEl.style.transform = originalTransform;
    
    if (contentHeight > 0 && containerHeight > 0) {
      // Calculate optimal zoom percentage (min 50%, max 100%)
      const optimal = Math.min(100, Math.max(50, Math.floor((containerHeight / contentHeight) * 100)));
      setOptimalZoom(optimal);
      setPreviewZoom(optimal);
    }
  }, []);

  // Reset zoom when modal opens
  useEffect(() => {
    if (isOpen) {
      setPreviewZoom(100);
      setOptimalZoom(100);
    }
  }, [isOpen]);

  // Calculate optimal zoom when content is rendered
  useLayoutEffect(() => {
    if (isOpen && htmlContent) {
      const timer = setTimeout(calculateOptimalZoom, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, htmlContent, calculateOptimalZoom]);

  // Un fichier du disque devient d'abord une pièce de l'intervention, puis est coché comme
  // les autres : c'est ce qui garantit que l'artisan le retrouve dans son application.
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    await emailAttachments.addFilesFromDisk(files);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Replace cid:logoGM with actual image URL for preview
  const getPreviewHtml = useCallback((html: string): string => {
    // Replace cid:logoGM with the actual logo path
    // Try PNG first, then SVG as fallback
    const logoPath = '/logoGM.png';

    // Replace cid:logoGM with actual image URL
    return html.replace(/cid:logoGM/g, logoPath);
  }, []);

  const getSstPriceChange = useCallback((): SstPriceChange | null => {
    if (emailType !== 'intervention' || !sstPriceSaveContext) return null;

    const previousAmount = parseSstAmount(sstPriceSaveContext.originalValue);
    const nextAmount = parseSstAmount(editableData.coutSST);
    if (nextAmount === null) return null;

    if (amountToCents(previousAmount) === amountToCents(nextAmount)) return null;

    return {
      previousAmount,
      nextAmount,
      previousLabel: formatSstAmountLabel(previousAmount, sstPriceSaveContext.originalValue),
      nextLabel: formatSstAmountLabel(nextAmount, editableData.coutSST),
    };
  }, [editableData.coutSST, emailType, sstPriceSaveContext]);

  const validateSendFields = useCallback(() => {
    if (!subject || subject.trim().length === 0) {
      toast.error('Le sujet de l\'email est requis');
      return false;
    }

    if (!artisanId) {
      toast.error('Artisan non sélectionné');
      return false;
    }

    return true;
  }, [artisanId, subject]);

  const persistSstPriceChange = useCallback(async (change: SstPriceChange) => {
    if (!sstPriceSaveContext) return;

    const priceToast = toast.loading('Mise à jour du prix SST...');
    const persistedArtisanOrder = sstPriceSaveContext.persistedArtisanOrder === undefined
      ? sstPriceSaveContext.artisanOrder
      : sstPriceSaveContext.persistedArtisanOrder;

    try {
      await interventionsApi.upsertCost(interventionId, {
        cost_type: 'sst',
        label: sstPriceSaveContext.artisanOrder === 2 ? 'Coût SST 2ème artisan' : 'Coût SST',
        amount: change.nextAmount,
        artisan_order: persistedArtisanOrder,
      });

      queryClient.setQueryData(
        interventionKeys.detail(interventionId),
        (old: any) => updateSstCostInCache(
          old,
          change.nextAmount,
          sstPriceSaveContext.artisanOrder,
          persistedArtisanOrder,
        ),
      );

      await queryClient.invalidateQueries({
        queryKey: interventionKeys.detail(interventionId),
        refetchType: 'all',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['podium'] });

      toast.success('Prix SST mis à jour', {
        id: priceToast,
        description: `${change.previousLabel} → ${change.nextLabel}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error('Erreur lors de la mise à jour du prix SST', {
        id: priceToast,
        description: message,
      });
      throw Object.assign(error instanceof Error ? error : new Error(message), { toastShown: true });
    }
  }, [interventionId, queryClient, sstPriceSaveContext]);

  const sendEmail = async ({ persistSstPrice = false }: { persistSstPrice?: boolean } = {}) => {
    if (!validateSendFields()) {
      return;
    }

    setIsSending(true);
    let sendingToast: string | number | undefined;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      const pendingSstPriceChange = getSstPriceChange();
      if (persistSstPrice && pendingSstPriceChange) {
        await persistSstPriceChange(pendingSstPriceChange);
      }

      sendingToast = toast.loading('Envoi en cours...');

      // Set timeout (70s frontend timeout)
      timeoutRef.current = setTimeout(() => {
        setIsSending(false);
        if (sendingToast !== undefined) toast.dismiss(sendingToast);
        toast.error('L\'envoi a pris trop de temps. Veuillez vérifier votre connexion et réessayer.');
      }, 70000);

      // Regenerate HTML with current editable data before sending
      const finalTemplateData: EmailTemplateData = {
        nomClient: templateData.nomClient,
        telephoneClient: templateData.telephoneClient,
        adresse: templateData.adresse,
        idIntervention: templateData.idIntervention,
        consigneArtisan: templateData.consigneArtisan,
        commentaire: editableData.commentaire || templateData.commentaire,
        datePrevue: templateData.datePrevue,
        coutSST: editableData.coutSST || templateData.coutSST,
        isVacant: templateData.isVacant,
        keyCode: templateData.keyCode,
        floor: templateData.floor,
        apartmentNumber: templateData.apartmentNumber,
        vacantHousingInstructions: templateData.vacantHousingInstructions,
      };

      // Generate final HTML content with editable data
      let finalHtmlContent: string;
      try {
        finalHtmlContent = emailType === 'devis'
          ? generateDevisEmailTemplate(finalTemplateData)
          : generateInterventionEmailTemplate(finalTemplateData);
      } catch (error) {
        console.error('[EmailEditModal] Failed to generate final template:', error);
        if (sendingToast !== undefined) toast.dismiss(sendingToast);
        toast.error('Erreur lors de la génération du template final');
        setIsSending(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      if (!finalHtmlContent || finalHtmlContent.trim().length === 0) {
        if (sendingToast !== undefined) toast.dismiss(sendingToast);
        toast.error('Le contenu de l\'email est vide');
        setIsSending(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Lot L7 : le corps ne transporte plus que des identifiants de pièces de
      // l'intervention. Les octets sont lus dans Storage par la route d'envoi.
      const attachmentIds = emailAttachments.selectedIds;

      // Get authentication token
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (!token) {
        if (sendingToast !== undefined) toast.dismiss(sendingToast);
        toast.error('Session expirée. Veuillez vous reconnecter.');
        setIsSending(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Send email with final HTML content
      // Include artisanEmail to allow sending to artisan not yet saved in intervention
      const response = await fetch(`/api/interventions/${interventionId}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: emailType,
          artisanId,
          artisanEmail, // Pass email directly for unsaved artisan selection
          subject: subject.trim(),
          htmlContent: finalHtmlContent.trim(),
          attachmentIds,
        }),
      });

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      let data: { error?: string; data?: unknown };
      try {
        data = await response.json();
      } catch {
        // Le corps de la requête ne contient plus de fichiers depuis le lot L7 : une réponse
        // non-JSON ne peut plus venir d'un rejet plateforme pour corps trop volumineux.
        throw new Error(
          `Réponse inattendue du serveur (HTTP ${response.status}) lors de l'envoi de l'e-mail.`,
        );
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi de l\'email');
      }

      // Parse enriched response
      const responseData = data.data as {
        messageId?: string | null;
        accepted?: string[];
        rejected?: string[];
        logId?: string | null;
      } | undefined;

      if (sendingToast !== undefined) toast.dismiss(sendingToast);

      // Warn if some recipients were rejected
      if (responseData?.rejected && responseData.rejected.length > 0) {
        toast.warning(`Email rejeté pour : ${responseData.rejected.join(', ')}`, {
          description: `Sujet : ${subject.trim()}`,
        });
      } else {
        toast.success(`Email envoyé à ${artisanEmail}`, {
          description: `Sujet : ${subject.trim()}`,
        });
      }

      // Invalidate email logs cache
      queryClient.invalidateQueries({
        queryKey: emailLogKeys.byIntervention(interventionId),
      });

      onClose();
    } catch (error) {
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (sendingToast !== undefined) toast.dismiss(sendingToast);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'envoi de l\'email';
      if (!(error instanceof Error && (error as Error & { toastShown?: boolean }).toastShown)) {
        toast.error(errorMessage);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => {
    if (!validateSendFields()) {
      return;
    }

    if (getSstPriceChange()) {
      setShowSstPriceConfirm(true);
      return;
    }

    void sendEmail();
  };

  const handleSavePriceAndSend = () => {
    setShowSstPriceConfirm(false);
    void sendEmail({ persistSstPrice: true });
  };

  const handleSendWithoutSavingPrice = () => {
    setShowSstPriceConfirm(false);
    void sendEmail({ persistSstPrice: false });
  };

  const handleClose = () => {
    if (isSending) return; // Prevent closing while sending
    if (showSstPriceConfirm) return; // Garder le modal email ouvert tant que la confirmation prix SST est affichée
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="w-[85vw] max-w-[85vw] h-[90vh] max-h-[90vh] overflow-hidden p-0 flex"
        onEscapeKeyDown={(event) => {
          // Ne pas fermer le modal email pendant l'envoi ou quand la confirmation prix SST est ouverte
          if (isSending || showSstPriceConfirm) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          // Les interactions dans l'AlertDialog (rendu via portal) ne doivent pas fermer le modal email
          if (isSending || showSstPriceConfirm) event.preventDefault();
        }}
      >
        <div className="flex flex-row w-full h-full">
          {/* Left: Preview - full height with zoom controls and scroll */}
          <div className="flex flex-col w-[65%] h-full border-r">
            <div className="border-b bg-muted/50 px-4 py-2 flex-shrink-0 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Aperçu de l&apos;email</span>
                <p className="text-xs text-muted-foreground">Ce que le destinataire recevra</p>
              </div>
              {/* Zoom controls */}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={previewZoom <= 30}
                  className="h-8 w-8 p-0"
                  title="Zoom arrière"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium w-12 text-center">{previewZoom}%</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={previewZoom >= 150}
                  className="h-8 w-8 p-0"
                  title="Zoom avant"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomReset}
                  className="h-8 w-8 p-0"
                  title="Réinitialiser le zoom"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div
              ref={previewContainerRef}
              className="bg-white"
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                height: 'calc(100% - 52px)',
                overflowY: 'auto',
                overflowX: 'auto',
              }}
            >
              <div
                ref={previewContentRef}
                className="p-4"
                style={{
                  zoom: previewZoom / 100,
                }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getPreviewHtml(htmlContent)) }}
              />
            </div>
          </div>

          {/* Right: Header + Editor + Footer */}
          <div className="flex flex-col w-[35%] h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">
                  {emailType === 'devis' ? 'Email demande de devis' : 'Email demande d\'intervention'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Destinataire : <span className="font-medium text-foreground">{artisanEmail}</span>
              </p>
            </div>

            {/* Editor - scrollable */}
            <div className="overflow-y-auto px-6 py-4 space-y-4" style={{ height: 'calc(100% - 140px)' }}>
              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="email-subject">Sujet</Label>
                <Input
                  id="email-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Sujet de l'email"
                  disabled={isSending}
                />
              </div>

              {/* Coût SST (only for intervention type) */}
              {emailType === 'intervention' && (
                <div className="space-y-2">
                  <Label htmlFor="cout-sst">Coût SST</Label>
                  <Input
                    id="cout-sst"
                    type="text"
                    value={editableData.coutSST || ''}
                    onChange={(e) => setEditableData(prev => ({ ...prev, coutSST: e.target.value }))}
                    placeholder="Ex: 150 EUR ou Non spécifié"
                    disabled={isSending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Coût SST pour cette intervention
                  </p>
                </div>
              )}

              {/* Commentaire */}
              <div className="space-y-2">
                <Label htmlFor="commentaire">Commentaire</Label>
                <Textarea
                  id="commentaire"
                  value={editableData.commentaire || ''}
                  onChange={(e) => setEditableData(prev => ({ ...prev, commentaire: e.target.value }))}
                  placeholder="Commentaires additionnels (optionnel)"
                  rows={3}
                  disabled={isSending}
                />
                <p className="text-xs text-muted-foreground">
                  Commentaires additionnels qui apparaîtront dans l&apos;email
                </p>
              </div>

              {/* Email History for this type */}
              <div className="rounded-lg border bg-muted/30">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  disabled={isHistoryLoading || !emailHistory || emailHistory.length === 0}
                  className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">
                      {isHistoryLoading
                        ? 'Chargement historique...'
                        : emailHistory && emailHistory.length > 0
                          ? `Historique (${emailHistory.length} email${emailHistory.length > 1 ? 's' : ''} ${emailType === 'devis' ? 'devis' : 'intervention'})`
                          : `Aucun email ${emailType === 'devis' ? 'devis' : 'intervention'} envoyé`
                      }
                    </span>
                  </div>
                  {emailHistory && emailHistory.length > 0 && (
                    showHistory ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )
                  )}
                </button>
                {showHistory && emailHistory && emailHistory.length > 0 && (
                  <div className="border-t max-h-[180px] overflow-y-auto">
                    {emailHistory.map((log) => (
                      <EmailHistoryEntry key={log.id} log={log} />
                    ))}
                  </div>
                )}
              </div>

              {/* Pièces jointes — lignes d'intervention_attachments (lot L7, spec §5.6) */}
              <div className="space-y-2" data-testid="email-attachments">
                <div className="flex items-center justify-between">
                  <Label>Pièces jointes</Label>
                  <Badge variant="secondary" className="text-xs">
                    Logo GMBS inclus
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cochez des pièces de l&apos;intervention : l&apos;artisan les retrouvera à
                  l&apos;identique dans son application.
                </p>

                {/* Liste des pièces de l'intervention */}
                {emailAttachments.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Chargement des pièces de l&apos;intervention...
                  </div>
                ) : emailAttachments.error ? (
                  <p className="text-xs text-destructive">{emailAttachments.error}</p>
                ) : emailAttachments.options.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucune pièce sur cette intervention. Ajoutez un fichier ci-dessous : il sera
                    d&apos;abord enregistré comme pièce de l&apos;intervention.
                  </p>
                ) : (
                  <div className="rounded-md border divide-y max-h-[220px] overflow-y-auto">
                    {emailAttachments.options.map((option) => {
                      const checked = emailAttachments.isSelected(option.id);
                      const disabled = isSending || (!checked && !emailAttachments.canSelectMore);
                      return (
                        <label
                          key={option.id}
                          htmlFor={`piece-jointe-${option.id}`}
                          className="flex items-start gap-2 p-2 cursor-pointer hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`piece-jointe-${option.id}`}
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() => emailAttachments.toggle(option.id)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                              <span className="text-sm truncate">{option.filename}</span>
                              <Badge variant="outline" className="text-[10px] flex-shrink-0">
                                {labelForAttachmentKind(option.kind)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(option.fileSize)}
                              {option.sentToArtisanAt
                                ? ` · déjà envoyée le ${new Date(option.sentToArtisanAt).toLocaleDateString('fr-FR')}`
                                : ''}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Ajout d'un fichier du disque : dépôt sur l'intervention, puis sélection */}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isSending || emailAttachments.isUploading || !emailAttachments.canSelectMore}
                    className="hidden"
                    id="file-upload"
                  />
                  <Select
                    value={emailAttachments.uploadKind}
                    onValueChange={emailAttachments.setUploadKind}
                    disabled={isSending || emailAttachments.isUploading}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Nature du fichier ajouté">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMAIL_ATTACHMENT_UPLOAD_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind} className="text-xs">
                          {labelForAttachmentKind(kind)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || emailAttachments.isUploading || !emailAttachments.canSelectMore}
                    className="flex items-center gap-2"
                  >
                    {emailAttachments.isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                    Ajouter un fichier
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {emailAttachments.selectedIds.length}/{MAX_EMAIL_ATTACHMENTS} pièce
                  {emailAttachments.selectedIds.length > 1 ? 's' : ''} sélectionnée
                  {emailAttachments.selectedIds.length > 1 ? 's' : ''}
                  {' · '}
                  <span
                    className={
                      emailAttachments.selectedSize > MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES
                        ? 'text-destructive'
                        : undefined
                    }
                  >
                    {formatFileSize(emailAttachments.selectedSize)}
                  </span>
                  {` sur ${MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL} au total`}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex-shrink-0 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSending}>
                Annuler
              </Button>
              <Button type="button" onClick={handleSend} disabled={isSending}>
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Envoyer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Hidden DialogHeader and DialogFooter for accessibility */}
        <DialogHeader className="sr-only">
          <DialogTitle>
            {emailType === 'devis' ? 'Email demande de devis' : 'Email demande d\'intervention'}
          </DialogTitle>
          <DialogDescription>
            Destinataire : {artisanEmail}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>

      <AlertDialog
        open={showSstPriceConfirm}
        onOpenChange={(open) => {
          if (!isSending) setShowSstPriceConfirm(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(() => {
                const change = getSstPriceChange();
                return change
                  ? `Le prix SST passe de ${change.previousLabel} → ${change.nextLabel}`
                  : 'Le prix SST a été modifié';
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Choisissez si ce nouveau prix doit aussi être enregistré sur l&apos;intervention avant l&apos;envoi du mail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-3 sm:flex-col sm:justify-start sm:space-x-0">
            {/* Ligne 1 : option secondaire, isolée dans un menu déroulant (pas un choix par défaut) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSending}
                  className="w-full justify-between px-2 text-muted-foreground hover:text-foreground sm:w-auto sm:self-start sm:justify-start"
                >
                  Voir plus d&apos;options
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
                <DropdownMenuItem
                  onSelect={handleSendWithoutSavingPrice}
                  disabled={isSending}
                  className="whitespace-normal"
                >
                  Envoyer avec le nouveau prix sans l&apos;enregistrer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Ligne 2 : actions principales — bouton de retour + validation */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialogCancel
                onClick={() => setShowSstPriceConfirm(false)}
                disabled={isSending}
                className="mt-0"
              >
                Retour arrière
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleSavePriceAndSend} disabled={isSending}>
                Enregistrer nouveau prix et envoyer
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
