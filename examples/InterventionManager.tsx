// ===== EXEMPLE PRATIQUE D'UTILISATION DE L'API V2 =====
// Ce fichier montre comment utiliser efficacement l'API v2 dans un composant React

"use client"

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageSquare, Plus, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ✅ Import correct de l'API v2
import {
    commentsApi,
    documentsApi,
    interventionsApiV2
} from '@/lib/api/v2';

// ✅ Import des hooks personnalisés
import { useArtisans } from '@/hooks/useArtisans';
import { useInterventionsQuery } from '@/hooks/useInterventionsQuery';
import type { InterventionView } from '@/types/intervention-view';

interface InterventionManagerProps {
  agenceId?: string;
}

export function InterventionManager({ agenceId }: InterventionManagerProps) {
  // ✅ Utilisation des hooks personnalisés
  const [serverFilters, setServerFilters] = useState<Record<string, string | string[] | null | undefined>>(() =>
    agenceId ? { agence: agenceId } : {},
  );

  const {
    interventions,
    loading: interventionsLoading,
    error: interventionsError,
    refresh: refreshInterventions,
    updateInterventionOptimistic,
  } = useInterventionsQuery({
    serverFilters,
  });

  useEffect(() => {
    if (!agenceId) {
      setServerFilters((prev) => {
        if (prev.agence === undefined) return prev;
        const { agence: _removed, ...rest } = prev;
        return rest;
      });
      return;
    }

    setServerFilters((prev) => {
      if (prev.agence === agenceId) return prev;
      return { ...prev, agence: agenceId };
    });
  }, [agenceId]);

  const {
    artisans,
    loading: artisansLoading
  } = useArtisans({
    limit: 100,
    autoLoad: true
  });

  // États locaux pour les formulaires
  const [newIntervention, setNewIntervention] = useState({
    contexte_intervention: '',
    adresse: '',
    ville: '',
    statut_id: 'DEMANDE'
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  // ✅ Fonction de création d'intervention
  const handleCreateIntervention = useCallback(async () => {
    if (!newIntervention.contexte_intervention || !newIntervention.adresse) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setCreating(true);
    try {
      const intervention = await interventionsApiV2.create({
        ...newIntervention,
        agence_id: agenceId,
        date: new Date().toISOString()
      });

      await refreshInterventions();
      
      // Reset du formulaire
      setNewIntervention({
        contexte_intervention: '',
        adresse: '',
        ville: '',
        statut_id: 'DEMANDE'
      });

      console.log('Intervention créée:', intervention);
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      alert('Erreur lors de la création de l\'intervention');
    } finally {
      setCreating(false);
    }
  }, [newIntervention, agenceId, refreshInterventions]);

  // ✅ Fonction de mise à jour du statut
  const handleStatusChange = useCallback(async (interventionId: string, newStatus: string) => {
    try {
      // ✅ Mise à jour optimiste
      updateInterventionOptimistic(interventionId, {
        statut: newStatus,
        statusValue: newStatus as InterventionView["statusValue"],
      });

      // ✅ Mise à jour via l'API
      await interventionsApiV2.update(interventionId, { statut_id: newStatus });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      // ✅ Rollback en cas d'erreur
      refreshInterventions();
    }
  }, [refreshInterventions, updateInterventionOptimistic]);

  // ✅ Fonction d'assignation d'artisan
  const handleAssignArtisan = useCallback(async (interventionId: string, artisanId: string) => {
    try {
      await interventionsApiV2.assignArtisan(interventionId, artisanId, 'primary');
      
      // ✅ Rafraîchir pour avoir les données à jour
      refreshInterventions();
      
      console.log('Artisan assigné avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
    }
  }, [refreshInterventions]);

  // ✅ Fonction d'upload de document
  const handleDocumentUpload = useCallback(async (interventionId: string) => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entity_id', interventionId);
      formData.append('entity_type', 'intervention');
      formData.append('kind', 'devis');
      formData.append('description', `Document pour intervention ${interventionId}`);

      const document = await documentsApi.upload(formData);
      
      console.log('Document uploadé:', document);
      setSelectedFile(null);
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
    } finally {
      setUploading(false);
    }
  }, [selectedFile]);

  // ✅ Fonction d'ajout de commentaire
  const handleAddComment = useCallback(async (interventionId: string, content: string) => {
    try {
      const comment = await commentsApi.create({
        entity_id: interventionId,
        entity_type: 'intervention',
        content: content,
        comment_type: 'internal'
      });

      console.log('Commentaire ajouté:', comment);
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
    }
  }, []);

  // ✅ Fonction de filtrage
  const handleFilterChange = useCallback((filterType: string, value: string) => {
    setServerFilters((prev) => {
      const next = { ...prev };
      if (value === 'all') {
        delete (next as Record<string, unknown>)[filterType];
      } else {
        next[filterType] = value;
      }
      return next;
    });
  }, [setServerFilters]);

  // ✅ Gestion des erreurs
  if (interventionsError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Erreur lors du chargement des interventions:</p>
            <p className="text-sm">{interventionsError}</p>
            <Button onClick={refreshInterventions} className="mt-4">
              Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ✅ Formulaire de création */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nouvelle Intervention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Contexte de l'intervention"
              value={newIntervention.contexte_intervention}
              onChange={(e) => setNewIntervention(prev => ({ 
                ...prev, 
                contexte_intervention: e.target.value 
              }))}
            />
            <Input
              placeholder="Adresse"
              value={newIntervention.adresse}
              onChange={(e) => setNewIntervention(prev => ({ 
                ...prev, 
                adresse: e.target.value 
              }))}
            />
            <Input
              placeholder="Ville"
              value={newIntervention.ville}
              onChange={(e) => setNewIntervention(prev => ({ 
                ...prev, 
                ville: e.target.value 
              }))}
            />
            <Select
              value={newIntervention.statut_id}
              onValueChange={(value) => setNewIntervention(prev => ({ 
                ...prev, 
                statut_id: value 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEMANDE">Demandé</SelectItem>
                <SelectItem value="DEVIS_ENVOYE">Devis Envoyé</SelectItem>
                <SelectItem value="EN_COURS">En Cours</SelectItem>
                <SelectItem value="TERMINE">Terminé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={handleCreateIntervention}
            disabled={creating}
            className="w-full"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              'Créer l\'intervention'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ✅ Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Select onValueChange={(value) => handleFilterChange('statut', value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="DEMANDE">Demandé</SelectItem>
                <SelectItem value="DEVIS_ENVOYE">Devis Envoyé</SelectItem>
                <SelectItem value="EN_COURS">En Cours</SelectItem>
                <SelectItem value="TERMINE">Terminé</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={refreshInterventions} variant="outline">
              Rafraîchir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Liste des interventions */}
      <div className="space-y-4">
        {interventionsLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
            <p className="mt-2">Chargement des interventions...</p>
          </div>
        ) : (
          interventions.map((intervention) => (
            <Card key={intervention.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h3 className="font-semibold">
                      {intervention.contexte_intervention}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {intervention.adresse}, {intervention.ville}
                    </p>
                    <p className="text-xs text-gray-500">
                      Créé le {new Date(intervention.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* ✅ Badge de statut cliquable */}
                    <Badge 
                      className="cursor-pointer"
                      onClick={() => {
                        const statuses = ['DEMANDE', 'DEVIS_ENVOYE', 'EN_COURS', 'TERMINE'];
                        const currentIndex = statuses.indexOf(intervention.statut_id || 'DEMANDE');
                        const nextIndex = (currentIndex + 1) % statuses.length;
                        handleStatusChange(intervention.id, statuses[nextIndex]);
                      }}
                    >
                      {intervention.statut_id || 'DEMANDE'}
                    </Badge>
                  </div>
                </div>
                
                {/* ✅ Actions */}
                <div className="flex gap-2 mt-4">
                  <Select onValueChange={(artisanId) => handleAssignArtisan(intervention.id, artisanId)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Assigner un artisan" />
                    </SelectTrigger>
                    <SelectContent>
                      {artisans.map((artisan) => (
                        <SelectItem key={artisan.id} value={artisan.id}>
                          {artisan.raison_sociale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex gap-2">
                    <input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id={`file-${intervention.id}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById(`file-${intervention.id}`)?.click()}
                      disabled={uploading}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Document
                    </Button>
                    
                    {selectedFile && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDocumentUpload(intervention.id)}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Upload'
                        )}
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const content = prompt('Contenu du commentaire:');
                        if (content) handleAddComment(intervention.id, content);
                      }}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Commentaire
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        
      </div>
    </div>
  );
}

// ===== UTILISATION DU COMPOSANT =====
// 
// function App() {
//   return (
//     <div className="container mx-auto p-6">
//       <InterventionManager agenceId="your-agency-id" />
//     </div>
//   );
// }
//
// ===== POINTS CLÉS DE CET EXEMPLE =====
//
// ✅ 1. Imports corrects de l'API v2 et des hooks
// ✅ 2. Utilisation de TanStack Query via useInterventionsQuery pour la gestion d'état
// ✅ 3. Mise à jour optimiste pour une meilleure UX
// ✅ 4. Gestion d'erreurs avec rollback
// ✅ 5. Fonctions useCallback pour les performances
// ✅ 6. États de chargement spécifiques
// ✅ 7. Validation des données avant envoi
// ✅ 8. Interface utilisateur intuitive
// ✅ 9. Gestion des fichiers et uploads
// ✅ 10. Système de commentaires intégré
