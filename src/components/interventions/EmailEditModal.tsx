'use client';

import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Paperclip, Mail, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import type { EmailTemplateData } from '@/lib/email-templates/intervention-emails';
import { generateDevisEmailTemplate, generateInterventionEmailTemplate } from '@/lib/email-templates/intervention-emails';
import DOMPurify from 'dompurify';

export interface EmailEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailType: 'devis' | 'intervention';
  artisanId: string;
  artisanEmail: string;
  interventionId: string;
  templateData: EmailTemplateData;
  selectedArtisanForEmail?: string; // For internal use
}

interface AttachmentFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ATTACHMENTS = 5;

export function EmailEditModal({
  isOpen,
  onClose,
  emailType,
  artisanId,
  artisanEmail,
  interventionId,
  templateData,
  selectedArtisanForEmail: _selectedArtisanForEmail,
}: EmailEditModalProps) {
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100); // Zoom percentage (100 = 100%)
  const [optimalZoom, setOptimalZoom] = useState(100); // Calculated optimal zoom
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);

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
    const interventionRef = templateData.idIntervention || interventionId.slice(0, 8);
    if (emailType === 'devis') {
      return `Demande de devis - Intervention #${interventionRef}`;
    }
    return `Demande d'intervention - Intervention #${interventionRef}`;
  }, [emailType, templateData.idIntervention, interventionId]);

  // Update editable data when templateData changes
  useEffect(() => {
    if (isOpen) {
      setEditableData({
        commentaire: templateData.commentaire || '',
        coutSST: templateData.coutSST || '',
      });
      setSubject(getDefaultSubject());
      setAttachments([]);
    }
  }, [isOpen, templateData, getDefaultSubject]);

  // Regenerate HTML when editable fields change
  useEffect(() => {
    if (isOpen && artisanId) {
      const updatedTemplateData: EmailTemplateData = {
        nomClient: templateData.nomClient,
        telephoneClient: templateData.telephoneClient,
        telephoneClient2: templateData.telephoneClient2,
        adresse: templateData.adresse,
        idIntervention: templateData.idIntervention,
        consigneArtisan: templateData.consigneArtisan,
        commentaire: editableData.commentaire,
        datePrevue: templateData.datePrevue,
        coutSST: editableData.coutSST,
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

  // Initialize template data when modal opens
  useEffect(() => {
    if (isOpen && artisanId) {
      // Set default subject
      setSubject(getDefaultSubject());

      // Generate HTML content from template with editable data
      const initialTemplateData: EmailTemplateData = {
        ...templateData,
        ...editableData,
      };

      try {
        const htmlContent = emailType === 'devis'
          ? generateDevisEmailTemplate(initialTemplateData)
          : generateInterventionEmailTemplate(initialTemplateData);
        setHtmlContent(htmlContent);
      } catch (error) {
        console.error('[EmailEditModal] Failed to generate template:', error);
        toast.error('Erreur lors de la génération du template');
        setHtmlContent('');
      }

      // Reset attachments
      setAttachments([]);
    }
  }, [isOpen, emailType, interventionId, artisanId, getDefaultSubject, editableData, templateData]);

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachmentFile[] = [];
    let hasError = false;

    // Check total attachment count
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`Maximum ${MAX_ATTACHMENTS} pièces jointes autorisées`);
      hasError = true;
    }

    Array.from(files).forEach((file) => {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Le fichier "${file.name}" dépasse la taille maximale de ${MAX_FILE_SIZE / 1024 / 1024} MB`);
        hasError = true;
        return;
      }

      // Check if file already exists
      if (attachments.some((att) => att.name === file.name && att.size === file.size)) {
        toast.error(`Le fichier "${file.name}" est déjà ajouté`);
        hasError = true;
        return;
      }

      newFiles.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
      });
    });

    if (!hasError && newFiles.length > 0) {
      setAttachments((prev) => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} fichier(s) ajouté(s)`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
    toast.success('Pièce jointe supprimée');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Replace cid:logoGM with actual image URL for preview
  const getPreviewHtml = useCallback((html: string): string => {
    // Replace cid:logoGM with the actual logo path
    // Try PNG first, then SVG as fallback
    const logoPath = '/logoGM.png';

    // Replace cid:logoGM with actual image URL
    return html.replace(/cid:logoGM/g, logoPath);
  }, []);

  const handleSend = async () => {
    // Validation
    if (!subject || subject.trim().length === 0) {
      toast.error('Le sujet de l\'email est requis');
      return;
    }

    if (!artisanId) {
      toast.error('Artisan non sélectionné');
      return;
    }

    setIsSending(true);
    const sendingToast = toast.loading('Envoi en cours...');

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set timeout (70s frontend timeout)
    timeoutRef.current = setTimeout(() => {
      setIsSending(false);
      toast.dismiss(sendingToast);
      toast.error('L\'envoi a pris trop de temps. Veuillez vérifier votre connexion et réessayer.');
    }, 70000);

    try {
      // Regenerate HTML with current editable data before sending
      const finalTemplateData: EmailTemplateData = {
        nomClient: templateData.nomClient,
        telephoneClient: templateData.telephoneClient,
        telephoneClient2: templateData.telephoneClient2,
        adresse: templateData.adresse,
        idIntervention: templateData.idIntervention,
        consigneArtisan: templateData.consigneArtisan,
        commentaire: editableData.commentaire || templateData.commentaire,
        datePrevue: templateData.datePrevue,
        coutSST: editableData.coutSST || templateData.coutSST,
      };

      // Generate final HTML content with editable data
      let finalHtmlContent: string;
      try {
        finalHtmlContent = emailType === 'devis'
          ? generateDevisEmailTemplate(finalTemplateData)
          : generateInterventionEmailTemplate(finalTemplateData);
      } catch (error) {
        console.error('[EmailEditModal] Failed to generate final template:', error);
        toast.dismiss(sendingToast);
        toast.error('Erreur lors de la génération du template final');
        setIsSending(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      if (!finalHtmlContent || finalHtmlContent.trim().length === 0) {
        toast.dismiss(sendingToast);
        toast.error('Le contenu de l\'email est vide');
        setIsSending(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Prepare attachments (convert to base64)
      const attachmentData = await Promise.all(
        attachments.map(async (att) => {
          const buffer = await att.file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          return {
            filename: att.name,
            contentType: att.file.type || 'application/octet-stream',
            content: base64,
          };
        })
      );

      // Get authentication token
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (!token) {
        toast.dismiss(sendingToast);
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
          attachments: attachmentData,
        }),
      });

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi de l\'email');
      }

      // Success
      toast.dismiss(sendingToast);
      toast.success('Email envoyé avec succès');
      onClose();
    } catch (error) {
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      toast.dismiss(sendingToast);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'envoi de l\'email';
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (isSending) return; // Prevent closing while sending
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="w-[85vw] max-w-[85vw] h-[90vh] max-h-[90vh] overflow-hidden z-[80] p-0 flex"
        overlayClassName="z-[75]"
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

              {/* Attachments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pièces jointes</Label>
                  <Badge variant="secondary" className="text-xs">
                    Logo GMBS inclus
                  </Badge>
                </div>

                {/* File input */}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isSending || attachments.length >= MAX_ATTACHMENTS}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || attachments.length >= MAX_ATTACHMENTS}
                    className="flex items-center gap-2"
                  >
                    <Paperclip className="h-4 w-4" />
                    Ajouter
                    {attachments.length > 0 && ` (${attachments.length}/${MAX_ATTACHMENTS})`}
                  </Button>
                </div>

                {/* Attachment list */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Paperclip className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm truncate">{att.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            ({formatFileSize(att.size)})
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttachment(att.id)}
                          disabled={isSending}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
    </Dialog>
  );
}

