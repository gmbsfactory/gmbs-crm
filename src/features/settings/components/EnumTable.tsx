'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Cog, Trash2 } from 'lucide-react';
import { EnumConfig } from '@/features/settings/config/enumConfigs';
import { EnumEditDialog } from './EnumEditDialog';

interface EnumTableProps {
  config: EnumConfig;
}

export function EnumTable({ config }: EnumTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);
  const [deleteCodeConfirm, setDeleteCodeConfirm] = useState('');
  const [creating, setCreating] = useState(false);

  // Charger les données
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const items = await config.api.getAll();
      setData(items);
    } catch (error) {
      console.error(`Erreur lors du chargement des ${config.title}:`, error);
    } finally {
      setLoading(false);
    }
  }, [config.api, config.title]);

  useEffect(() => {
    loadData();
  }, [config.type, loadData]);

  // Handler pour la suppression
  const handleDelete = async () => {
    if (!deleteItem) return;

    // Vérification du code pour confirmation
    if (deleteCodeConfirm !== deleteItem.code) {
      alert('Le code ne correspond pas');
      return;
    }

    try {
      await config.api.delete(deleteItem.id);
      await loadData();
      setDeleteItem(null);
      setDeleteCodeConfirm('');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  // Handler après sauvegarde (création ou édition)
  const handleSaveComplete = async () => {
    await loadData();
    setEditItem(null);
    setCreating(false);
  };

  // Filtrer les champs pour exclure "code" de l'affichage
  const displayFields = config.fields.filter(field => field.name !== 'code');

  // Calculer le colspan dynamiquement
  const colSpan = displayFields.length + 2; // +2 pour Statut et Actions

  return (
    <>
      <div className="space-y-4">
        {/* Bouton d'ajout si autorisé */}
        {config.canCreate && (
          <div className="flex justify-end">
            <Button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter {config.title}
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              {displayFields.map(field => (
                <TableHead key={field.name}>{field.label}</TableHead>
              ))}
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-sm text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            )}

            {!loading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-sm text-muted-foreground">
                  Aucun {config.title.toLowerCase()}
                </TableCell>
              </TableRow>
            )}

            {!loading && data.map((item) => (
              <TableRow key={item.id}>
                {displayFields.map(field => (
                  <TableCell key={field.name}>
                    {field.type === 'color' && item[field.name] ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded border"
                          style={{ backgroundColor: item[field.name] }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {item[field.name]}
                        </span>
                      </div>
                    ) : (
                      item[field.name] || '—'
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <Badge className={item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {item.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditItem(item)}
                  >
                    <Cog className="h-4 w-4" />
                  </Button>
                  {config.canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeleteItem(item);
                        setDeleteCodeConfirm('');
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog d'édition / création */}
      {(editItem || creating) && (
        <EnumEditDialog
          config={config}
          item={editItem}
          isCreating={creating}
          onClose={() => {
            setEditItem(null);
            setCreating(false);
          }}
          onSave={handleSaveComplete}
        />
      )}

      {/* Dialog de suppression */}
      <Dialog open={!!deleteItem} onOpenChange={(open) => {
        if (!open) {
          setDeleteItem(null);
          setDeleteCodeConfirm('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteItem?.label}</strong> ?
            </p>
            <p className="text-sm text-muted-foreground">
              Pour confirmer, tapez le code : <span className="font-mono font-bold">{deleteItem?.code}</span>
            </p>
            <Input
              placeholder="Code de confirmation"
              value={deleteCodeConfirm}
              onChange={(e) => setDeleteCodeConfirm(e.target.value)}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteItem(null);
              setDeleteCodeConfirm('');
            }}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteCodeConfirm !== deleteItem?.code}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
