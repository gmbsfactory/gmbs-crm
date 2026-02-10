'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Briefcase, 
  ListChecks, 
  Plus, 
  Settings2, 
  Trash2, 
  X, 
  Check, 
  AlertTriangle,
  Search,
  Palette,
  Hash,
  FileText,
  ToggleRight
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { agenciesApi } from '@/lib/api/v2/agenciesApi';
import { metiersApi } from '@/lib/api/v2/metiersApi';
import { interventionStatusesApi } from '@/lib/api/v2/interventionStatusesApi';

type EntityType = 'agencies' | 'metiers' | 'intervention-statuses';

interface EntityItem {
  id: string;
  code: string;
  label: string;
  color?: string | null;
  description?: string | null;
  is_active: boolean;
  requires_reference?: boolean;
}

const ENTITY_CONFIG = {
  agencies: {
    icon: Building2,
    title: 'Agences',
    description: 'Gérez les agences et leurs paramètres',
    color: 'from-blue-500/20 to-indigo-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    canCreate: true,
    canDelete: true,
    hasRequiresReference: true,
    api: agenciesApi,
  },
  metiers: {
    icon: Briefcase,
    title: 'Métiers',
    description: 'Configurez les types de métiers disponibles',
    color: 'from-emerald-500/20 to-green-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    canCreate: true,
    canDelete: true,
    hasRequiresReference: false,
    api: metiersApi,
  },
  'intervention-statuses': {
    icon: ListChecks,
    title: 'Statuts d\'Intervention',
    description: 'Personnalisez les statuts (édition uniquement)',
    color: 'from-amber-500/20 to-orange-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    canCreate: false,
    canDelete: false,
    hasRequiresReference: false,
    api: interventionStatusesApi,
  },
};

// Couleurs prédéfinies pour le sélecteur
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

export function EnumManager() {
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('agencies');
  const [data, setData] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EntityItem | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    color: '#6366f1',
    description: '',
    is_active: true,
    requires_reference: false,
  });
  const [saving, setSaving] = useState(false);
  
  // Delete modal
  const [deletingItem, setDeletingItem] = useState<EntityItem | null>(null);
  const [deleteCodeConfirm, setDeleteCodeConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Toggle loading states
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const config = ENTITY_CONFIG[selectedEntity];
  const Icon = config.icon;

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const items = await config.api.getAll();
      setData(items);
    } catch (error) {
      console.error(`Erreur lors du chargement des ${config.title}:`, error);
      toast.error(`Erreur lors du chargement des ${config.title}`);
    } finally {
      setLoading(false);
    }
  }, [config.api, config.title]);

  useEffect(() => {
    loadData();
    setSearchQuery('');
  }, [selectedEntity, loadData]);

  // Filtered data
  const filteredData = data.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return item.label.toLowerCase().includes(query) || 
           item.code.toLowerCase().includes(query) ||
           (item.description?.toLowerCase().includes(query));
  });

  // Open create modal
  const handleCreate = () => {
    setEditingItem(null);
    setFormData({
      label: '',
      color: '#6366f1',
      description: '',
      is_active: true,
      requires_reference: false,
    });
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (item: EntityItem) => {
    setEditingItem(item);
    setFormData({
      label: item.label,
      color: item.color || '#6366f1',
      description: item.description || '',
      is_active: item.is_active,
      requires_reference: item.requires_reference || false,
    });
    setShowModal(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!formData.label.trim()) {
      toast.error('Le label est requis');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        // Update - utiliser any car les types varient selon l'entité
        const updateData: Record<string, unknown> = {
          label: formData.label,
          color: formData.color,
        };
        // Description seulement pour les métiers
        if (selectedEntity === 'metiers') {
          updateData.description = formData.description || undefined;
        }
        // requires_reference seulement pour les agences
        if (config.hasRequiresReference && formData.requires_reference !== undefined) {
          // Utiliser l'API spécifique pour requires_reference
          await (config.api as typeof agenciesApi).updateRequiresReference?.(editingItem.id, formData.requires_reference);
        }
        await config.api.update(editingItem.id, updateData as any);
        toast.success(`${config.title.slice(0, -1)} mis à jour`);
      } else {
        // Create - utiliser any car les types varient selon l'entité
        const createData: Record<string, unknown> = {
          label: formData.label,
          color: formData.color,
        };
        // Description seulement pour les métiers
        if (selectedEntity === 'metiers') {
          createData.description = formData.description || undefined;
        }
        // Vérifier si l'API a une méthode create (intervention-statuses n'en a pas)
        if ('create' in config.api && typeof config.api.create === 'function') {
          await (config.api as any).create(createData);
        }
        // requires_reference sera géré après la création si nécessaire
        toast.success(`${config.title.slice(0, -1)} créé`);
      }
      await loadData();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deletingItem || deleteCodeConfirm !== deletingItem.code) return;

    setDeleting(true);
    try {
      // Vérifier si l'API a une méthode delete (intervention-statuses n'en a pas)
      if ('delete' in config.api && typeof config.api.delete === 'function') {
        await (config.api as any).delete(deletingItem.id);
        toast.success(`${config.title.slice(0, -1)} supprimé`);
        await loadData();
        setDeletingItem(null);
        setDeleteCodeConfirm('');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  // Toggle requires_reference inline
  const handleToggleRequiresReference = async (item: EntityItem) => {
    if (!config.hasRequiresReference) return;

    setTogglingIds(prev => new Set(prev).add(item.id));
    try {
      await agenciesApi.updateRequiresReference(item.id, !item.requires_reference);
      setData(prev => prev.map(i => 
        i.id === item.id ? { ...i, requires_reference: !item.requires_reference } : i
      ));
      toast.success(item.requires_reference ? 'Référence agence désactivée' : 'Référence agence activée');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Entity selector tabs */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-br from-primary/5 via-background to-background border-b">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ENTITY_CONFIG) as EntityType[]).map((entityType) => {
              const entityConfig = ENTITY_CONFIG[entityType];
              const EntityIcon = entityConfig.icon;
              const isSelected = selectedEntity === entityType;
              
              return (
                <motion.button
                  key={entityType}
                  onClick={() => setSelectedEntity(entityType)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
                    isSelected 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <EntityIcon className="h-4 w-4" />
                  {entityConfig.title}
                </motion.button>
              );
            })}
          </div>
        </div>
        
        {/* Header with search and add button */}
        <div className={cn("px-6 py-5 bg-gradient-to-br via-background to-background border-b", config.color)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center", config.color)}>
                <Icon className={cn("h-6 w-6", config.iconColor)} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{config.title}</h2>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </div>
            </div>
            {config.canCreate && (
              <motion.button
                onClick={handleCreate}
                className="px-4 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </motion.button>
            )}
          </div>
          
          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Rechercher dans ${config.title.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
        </div>

        {/* Data list */}
        <div className="divide-y">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Chargement...</p>
              </div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Icon className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? 'Aucun résultat pour cette recherche' : `Aucun ${config.title.toLowerCase()}`}
              </p>
            </div>
          ) : (
            filteredData.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="px-6 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Color indicator */}
                    <div
                      className="h-10 w-10 rounded-xl border-2 shadow-sm"
                      style={{ backgroundColor: item.color || 'hsl(var(--primary))', borderColor: item.color || 'hsl(var(--primary))' }}
                    />
                    
                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{item.label}</p>
                        <span className="px-2 py-0.5 rounded-md bg-muted text-xs font-mono text-muted-foreground">
                          {item.code}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Requires reference toggle (agencies only) */}
                    {config.hasRequiresReference && (
                      <div className="flex items-center gap-2">
                        {togglingIds.has(item.id) ? (
                          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Checkbox
                            checked={item.requires_reference || false}
                            onCheckedChange={() => handleToggleRequiresReference(item)}
                            aria-label="Réf. requise"
                          />
                        )}
                        <span className="text-xs text-muted-foreground">Réf. requise</span>
                      </div>
                    )}
                    
                    {/* Status badge */}
                    <div className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium",
                      item.is_active 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                        : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                    )}>
                      {item.is_active ? 'Actif' : 'Inactif'}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <motion.button
                        onClick={() => handleEdit(item)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                      </motion.button>
                      {config.canDelete && (
                        <motion.button
                          onClick={() => { setDeletingItem(item); setDeleteCodeConfirm(''); }}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="pointer-events-auto relative w-full max-w-lg bg-background rounded-2xl shadow-2xl border overflow-hidden"
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={cn("px-6 py-5 border-b bg-gradient-to-br via-background to-background", config.color)}>
                  <button
                    onClick={() => setShowModal(false)}
                    className="absolute right-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center", config.color)}>
                      <Icon className={cn("h-5 w-5", config.iconColor)} />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {editingItem ? `Modifier ${config.title.slice(0, -1)}` : `Ajouter ${config.title.slice(0, -1)}`}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {editingItem ? `Code: ${editingItem.code}` : 'Le code sera généré automatiquement'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Label */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" />
                      Label *
                    </label>
                    <input
                      type="text"
                      value={formData.label}
                      onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="Nom du label"
                      className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  
                  {/* Description (if applicable) */}
                  {selectedEntity === 'metiers' && (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Description optionnelle"
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                      />
                    </div>
                  )}
                  
                  {/* Color selector */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Palette className="h-3.5 w-3.5" />
                      Couleur
                    </label>
                    <div className="grid grid-cols-8 gap-2">
                      {PRESET_COLORS.map((color) => (
                        <motion.button
                          key={color}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, color }))}
                          className={cn(
                            "h-8 w-full rounded-lg transition-all",
                            formData.color === color && "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                          )}
                          style={{ backgroundColor: color }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        className="h-8 w-8 rounded-lg cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        placeholder="#6366f1"
                        className="flex-1 px-3 py-1.5 rounded-lg border bg-muted/30 focus:bg-background focus:border-primary transition-all outline-none font-mono text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Requires reference toggle (agencies only) */}
                  {config.hasRequiresReference && (
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <ToggleRight className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">Référence agence requise</p>
                          <p className="text-xs text-muted-foreground">Exiger une référence pour cette agence</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, requires_reference: !prev.requires_reference }))}
                        className={cn(
                          "relative h-6 w-11 rounded-full transition-colors",
                          formData.requires_reference ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                          formData.requires_reference && "translate-x-5"
                        )} />
                      </button>
                    </div>
                  )}
                  
                  {/* Active toggle */}
                  {editingItem && (
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">Statut actif</p>
                          <p className="text-xs text-muted-foreground">Activer ou désactiver cet élément</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                        className={cn(
                          "relative h-6 w-11 rounded-full transition-colors",
                          formData.is_active ? "bg-emerald-500" : "bg-muted"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                          formData.is_active && "translate-x-5"
                        )} />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <motion.button
                    onClick={handleSave}
                    disabled={saving || !formData.label.trim()}
                    className="px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {saving ? (
                      <>
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        {editingItem ? 'Mettre à jour' : 'Créer'}
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingItem && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingItem(null)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="pointer-events-auto relative w-full max-w-md bg-background rounded-2xl shadow-2xl border overflow-hidden"
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-5 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Supprimer {config.title.slice(0, -1)}</h3>
                      <p className="text-sm text-muted-foreground">Cette action est irréversible</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="p-4 rounded-xl bg-muted/30 border flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-lg"
                      style={{ backgroundColor: deletingItem.color || 'hsl(var(--primary))' }}
                    />
                    <div>
                      <p className="font-medium">{deletingItem.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{deletingItem.code}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Tapez le code <span className="font-mono font-bold">{deletingItem.code}</span> pour confirmer :
                    </label>
                    <input
                      type="text"
                      value={deleteCodeConfirm}
                      onChange={(e) => setDeleteCodeConfirm(e.target.value)}
                      placeholder={deletingItem.code}
                      className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all outline-none font-mono"
                    />
                  </div>
                </div>
                
                <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3">
                  <button
                    onClick={() => { setDeletingItem(null); setDeleteCodeConfirm(''); }}
                    disabled={deleting}
                    className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <motion.button
                    onClick={handleDelete}
                    disabled={deleting || deleteCodeConfirm !== deletingItem.code}
                    className="px-6 py-2.5 rounded-xl font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {deleting ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
