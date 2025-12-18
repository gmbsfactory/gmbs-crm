"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bell, X, MessageSquare, Trash2, Maximize2 } from "lucide-react"

type StyleVariant = "original" | "accent-subtil" | "bleu-moderne" | "vert-naturel"

export default function TestModalUIPage() {
  const [currentStyle, setCurrentStyle] = useState<StyleVariant>("original")

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      {/* Sélecteur de style */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-3 bg-white rounded-xl shadow-xl p-3 border">
        <Button
          variant={currentStyle === "original" ? "default" : "outline"}
          onClick={() => setCurrentStyle("original")}
          className="font-semibold"
        >
          🎨 Original (Actuel)
        </Button>
        <Button
          variant={currentStyle === "accent-subtil" ? "default" : "outline"}
          onClick={() => setCurrentStyle("accent-subtil")}
          className="font-semibold"
        >
          💜 Accent Subtil
        </Button>
        <Button
          variant={currentStyle === "bleu-moderne" ? "default" : "outline"}
          onClick={() => setCurrentStyle("bleu-moderne")}
          className="font-semibold"
        >
          💙 Bleu Moderne
        </Button>
        <Button
          variant={currentStyle === "vert-naturel" ? "default" : "outline"}
          onClick={() => setCurrentStyle("vert-naturel")}
          className="font-semibold"
        >
          💚 Vert Naturel (Recommandé)
        </Button>
      </div>

      {/* Styles CSS dynamiques */}
      <style jsx global>{`
        /* Style Original - Actuel */
        [data-style="original"] .modal-config-columns-header,
        [data-style="original"] .intervention-form-section-header {
          background-image: linear-gradient(
            to bottom,
            color-mix(in oklab, var(--bg-light), white 12%),
            color-mix(in oklab, var(--bg-light), transparent 0%)
          );
          border-bottom: 1px solid color-mix(in oklab, var(--border), black 8%);
        }

        /* Style 1: Accent Subtil (Violet) */
        [data-style="accent-subtil"] .modal-config-columns-header,
        [data-style="accent-subtil"] .intervention-form-section-header {
          background-image: linear-gradient(
            to bottom,
            color-mix(in oklab, hsl(270 75% 36%), white 92%) 0%,
            color-mix(in oklab, var(--bg-light), white 12%) 100%
          );
          border-bottom: 1px solid color-mix(in oklab, hsl(270 75% 36%), white 70%);
        }

        [data-style="accent-subtil"] .intervention-form-section,
        [data-style="accent-subtil"] .modal-config-columns-panel {
          background-image: linear-gradient(
            to bottom,
            color-mix(in oklab, hsl(270 75% 36%), white 97%) 0%,
            color-mix(in oklab, var(--bg), white 9%) 60%,
            color-mix(in oklab, var(--bg), black 2%) 100%
          );
          border: 1px solid color-mix(in oklab, hsl(270 75% 36%), white 85%);
        }

        [data-style="accent-subtil"] .intervention-form-input:focus,
        [data-style="accent-subtil"] .intervention-form-textarea:focus {
          border-color: hsl(270 75% 36%);
          box-shadow:
            inset 0 1px 0 var(--highlight),
            0 0 0 3px color-mix(in oklab, hsl(270 75% 36%), white 85%);
        }

        /* Style 2: Bleu Moderne */
        [data-style="bleu-moderne"] {
          --accent-color-test: #3B82F6;
        }

        [data-style="bleu-moderne"] .modal-config-columns-header,
        [data-style="bleu-moderne"] .intervention-form-section-header {
          background-image: linear-gradient(
            135deg,
            #F0F7FF 0%,
            #E8F0FE 50%,
            color-mix(in oklab, var(--bg-light), white 12%) 100%
          );
          border-bottom: 1px solid #BFDBFE;
        }

        [data-style="bleu-moderne"] .intervention-form-section,
        [data-style="bleu-moderne"] .modal-config-columns-panel {
          background-image: linear-gradient(
            to bottom,
            #F0F7FF 0%,
            #FAFBFF 50%,
            var(--bg-light) 100%
          );
          border: 1.5px solid #BFDBFE;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            0 2px 8px rgba(59, 130, 246, 0.1);
        }

        [data-style="bleu-moderne"] .intervention-form-input,
        [data-style="bleu-moderne"] .intervention-form-textarea,
        [data-style="bleu-moderne"] .intervention-form-select {
          background: white;
          border: 1.5px solid #BFDBFE;
        }

        [data-style="bleu-moderne"] .intervention-form-input:focus,
        [data-style="bleu-moderne"] .intervention-form-textarea:focus {
          border-color: #3B82F6;
          background: #F0F7FF;
          box-shadow: 0 0 0 3px #DBEAFE;
        }

        [data-style="bleu-moderne"] .intervention-form-button--primary {
          background: #3B82F6;
          background-image: linear-gradient(to bottom, #60A5FA 0%, #3B82F6 100%);
          border: 1px solid #2563EB;
          color: white;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.3),
            0 2px 6px rgba(59, 130, 246, 0.3);
        }

        /* Style 3: Vert Naturel (Recommandé) */
        [data-style="vert-naturel"] {
          --nature-green: #479E8C;
          --nature-cream: #FAF8F3;
          --nature-sand: #E8E3D8;
        }

        [data-style="vert-naturel"] .modal-config-columns-header,
        [data-style="vert-naturel"] .intervention-form-section-header {
          background-image: linear-gradient(
            135deg,
            #EBF7F4 0%,
            #F2F7F5 50%,
            #FAF8F3 100%
          );
          border-bottom: 1.5px solid #B8DDD4;
        }

        [data-style="vert-naturel"] .intervention-form-section,
        [data-style="vert-naturel"] .modal-config-columns-panel {
          background: #FAF8F3;
          background-image: linear-gradient(
            to bottom,
            #EBF7F4 0%,
            #FAF8F3 50%,
            #F5F2EA 100%
          );
          border: 1.5px solid #B8DDD4;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            0 2px 8px rgba(71, 158, 140, 0.12);
        }

        [data-style="vert-naturel"] .intervention-form-input,
        [data-style="vert-naturel"] .intervention-form-textarea,
        [data-style="vert-naturel"] .intervention-form-select {
          background: white;
          border: 1.5px solid #B8DDD4;
          transition: all 0.2s ease;
        }

        [data-style="vert-naturel"] .intervention-form-input:focus,
        [data-style="vert-naturel"] .intervention-form-textarea:focus {
          border-color: #479E8C;
          background: #EBF7F4;
          box-shadow: 
            inset 0 1px 2px rgba(71, 158, 140, 0.08),
            0 0 0 3px #D4EDE7;
        }

        [data-style="vert-naturel"] .intervention-form-button--primary {
          background: #479E8C;
          background-image: linear-gradient(to bottom, #5BB5A0 0%, #479E8C 100%);
          border: 1px solid #3A8271;
          color: white;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.35),
            0 2px 6px rgba(71, 158, 140, 0.25);
        }

        [data-style="vert-naturel"] .intervention-form-button--primary:hover {
          background-image: linear-gradient(to bottom, #66C2AE 0%, #479E8C 100%);
          transform: translateY(-2px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.4),
            0 4px 12px rgba(71, 158, 140, 0.3);
        }
      `}</style>

      {/* Contenu du modal - Version visible sur la page */}
      <div className="max-w-6xl mx-auto mt-20" data-style={currentStyle}>
        <div className="modal-config-surface bg-white rounded-2xl shadow-2xl border">
          {/* Header */}
          <header className="modal-config-columns-header relative">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="modal-config-columns-icon-button">
                <X className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="modal-config-columns-icon-button text-red-500">
                <Bell className="h-4 w-4 fill-current" />
              </Button>
              <Button variant="ghost" size="icon" className="modal-config-columns-icon-button">
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="modal-config-columns-icon-button hover:bg-red-500/10">
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="modal-config-columns-title">
                Modifier l&apos;intervention
                <span className="text-sm text-muted-foreground ml-2">(1 / 5)</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Mis à jour le 14/12/2024 10:30
              </span>
            </div>
          </header>

          {/* Body */}
          <div className="p-8 space-y-6">
            {/* Section 1: Informations principales */}
            <div className="intervention-form-section">
              <div className="intervention-form-section-header">
                <div className="intervention-form-section-title">Informations principales</div>
              </div>
              <div className="intervention-form-section-content">
                <div className="grid grid-cols-2 gap-4">
                  <div className="intervention-form-field">
                    <Label htmlFor="name" className="intervention-form-label">
                      Nom intervention *
                    </Label>
                    <Input
                      id="name"
                      placeholder="Ex: Rénovation toiture"
                      className="intervention-form-input"
                      defaultValue="Réparation fuite salle de bain"
                    />
                  </div>
                  <div className="intervention-form-field">
                    <Label htmlFor="address" className="intervention-form-label">
                      Adresse *
                    </Label>
                    <Input
                      id="address"
                      placeholder="123 rue de Paris, Lyon"
                      className="intervention-form-input"
                      defaultValue="45 Avenue Victor Hugo, 75016 Paris"
                    />
                  </div>
                </div>
                <div className="intervention-form-field">
                  <Label htmlFor="context" className="intervention-form-label">
                    Contexte d&apos;intervention *
                  </Label>
                  <Textarea
                    id="context"
                    placeholder="Préciser le contexte client/agence"
                    rows={3}
                    className="intervention-form-textarea"
                    defaultValue="Client signale une fuite dans la salle de bain principale. Intervention urgente requise."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="intervention-form-field">
                    <Label htmlFor="agency" className="intervention-form-label">
                      Agence
                    </Label>
                    <Input
                      id="agency"
                      placeholder="GMBS Lyon"
                      className="intervention-form-input"
                      defaultValue="GMBS Paris Nord"
                    />
                  </div>
                  <div className="intervention-form-field">
                    <Label htmlFor="invoice2goId" className="intervention-form-label">
                      ID Invoice2go
                    </Label>
                    <Input
                      id="invoice2goId"
                      placeholder="Définir pour valider l'intervention"
                      className="intervention-form-input"
                      defaultValue="INV-2024-12345"
                    />
                  </div>
                </div>
                <div className="intervention-form-field">
                  <Label htmlFor="consigne" className="intervention-form-label">
                    Consignes à l&apos;artisan
                  </Label>
                  <Textarea
                    id="consigne"
                    placeholder="Instructions spécifiques"
                    rows={2}
                    className="intervention-form-textarea"
                    defaultValue="Accès par le code 1234A. Sonner au 2ème étage, appartement à droite."
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Statut & planification */}
            <div className="intervention-form-section">
              <div className="intervention-form-section-header">
                <div className="intervention-form-section-title">Statut &amp; planification</div>
              </div>
              <div className="intervention-form-section-content">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="intervention-form-field">
                    <Label className="intervention-form-label">Statut</Label>
                    <Select defaultValue="INTER_EN_COURS">
                      <SelectTrigger className="intervention-form-select">
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEMANDE">Demande</SelectItem>
                        <SelectItem value="DEVIS">Devis</SelectItem>
                        <SelectItem value="INTER_EN_COURS">En cours</SelectItem>
                        <SelectItem value="INTER_TERMINEE">Terminée</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="intervention-form-field">
                    <Label htmlFor="dueAt" className="intervention-form-label">
                      Échéance
                    </Label>
                    <Input
                      id="dueAt"
                      type="date"
                      className="intervention-form-input"
                      defaultValue="2024-12-20"
                    />
                  </div>
                  <div className="intervention-form-field">
                    <Label htmlFor="artisanId" className="intervention-form-label">
                      Artisan assigné *
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="artisanId"
                        placeholder="UUID artisan"
                        className="intervention-form-input"
                        defaultValue="Jean Dupont Plomberie"
                      />
                      <Button type="button" className="intervention-form-button">
                        Rechercher
                      </Button>
                    </div>
                  </div>
                  <div className="intervention-form-field">
                    <Label htmlFor="managerId" className="intervention-form-label">
                      Gestionnaire
                    </Label>
                    <Input
                      id="managerId"
                      placeholder="UUID utilisateur"
                      className="intervention-form-input"
                      defaultValue="Marie Martin"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="modal-config-columns-footer flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="modal-config-columns-icon-button">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className="legacy-form-button">
                Annuler
              </Button>
              <Button type="button" className="intervention-form-button--primary">
                Enregistrer les modifications
              </Button>
            </div>
          </footer>
        </div>

        {/* Légende explicative */}
        <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-200">
          <h3 className="font-bold text-lg mb-3 text-blue-900">💡 Instructions de test</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✅ Testez chaque style avec les boutons en haut</li>
            <li>🎨 Notez la colorimétrie des headers (en-têtes de sections)</li>
            <li>📝 Cliquez dans les champs pour voir les effets de focus</li>
            <li>🔘 Regardez les boutons primaires et secondaires</li>
            <li>💬 Faites votre retour sur le style préféré !</li>
          </ul>
        </div>
      </div>
    </div>
  )
}






