'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorPicker } from './ColorPicker';
import {
  EnumConfig,
  EnumFormData,
  EnumItem,
} from '@/features/settings/config/enumConfigs';
import { agenciesApi } from '@/lib/api/v2/agenciesApi';

interface EnumEditDialogProps {
  config: EnumConfig;
  item: EnumItem | null; // null si création
  isCreating: boolean;
  onClose: () => void;
  onSave: () => void;
}

const fieldString = (data: EnumFormData, name: string): string => {
  const value = data[name];
  return typeof value === 'string' ? value : '';
};

const fieldBoolean = (data: EnumFormData, name: string): boolean => {
  return data[name] === true;
};

export function EnumEditDialog({ config, item, isCreating, onClose, onSave }: EnumEditDialogProps) {
  const [formData, setFormData] = useState<EnumFormData>({});
  const [saving, setSaving] = useState(false);

  // Initialiser le formulaire
  useEffect(() => {
    if (item) {
      // Mode édition : copier les données
      setFormData({ ...(item as unknown as EnumFormData) });
    } else {
      // Mode création : initialiser avec des valeurs par défaut
      const initialData: EnumFormData = {};
      config.fields.forEach(field => {
        if (field.editable) {
          if (field.type === 'color') {
            initialData[field.name] = '#6366f1';
          } else if (field.type === 'checkbox') {
            initialData[field.name] = false;
          } else {
            initialData[field.name] = '';
          }
        }
      });
      setFormData(initialData);
    }
  }, [item, config.fields]);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Préparer les données à sauvegarder (seulement les champs éditables, sauf checkbox inlineToggle)
      const dataToSave: EnumFormData = {};
      const checkboxFields: { name: string; value: boolean }[] = [];

      config.fields
        .filter(f => f.editable)
        .forEach(field => {
          // Les checkbox avec inlineToggle sont gérées séparément (table agency_config)
          if (field.type === 'checkbox' && field.inlineToggle) {
            checkboxFields.push({ name: field.name, value: fieldBoolean(formData, field.name) });
          } else {
            dataToSave[field.name] = formData[field.name];
          }
        });

      let createdId: string | null = null;

      if (isCreating) {
        if (!config.api.create) {
          throw new Error(`La création n'est pas supportée pour ${config.title}`);
        }
        const created = await config.api.create(dataToSave);
        createdId = created.id;
      } else if (item) {
        await config.api.update(item.id, dataToSave);
      }

      // Mettre à jour les checkbox (requires_reference) si c'est une agence
      if (config.type === 'agencies') {
        const targetId = createdId || item?.id;
        const requiresRefField = checkboxFields.find(f => f.name === 'requires_reference');
        if (targetId && requiresRefField) {
          await agenciesApi.updateRequiresReference(targetId, requiresRefField.value);
        }
      }

      onSave();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'duplicate_code') {
        alert('Ce code existe déjà. Veuillez choisir un autre label.');
      } else {
        alert(`Erreur: ${message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Vérifier si le formulaire est valide
  const isFormValid = () => {
    return config.fields
      .filter(f => f.editable && f.required)
      .every(field => fieldString(formData, field.name).trim() !== '');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCreating ? `Ajouter ${config.title}` : `Modifier ${config.title}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {config.fields.map(field => {
            if (!field.editable) {
              // Champs non éditables (ex: code)
              if (field.generated && !isCreating) {
                return (
                  <div key={field.name}>
                    <Label>{field.label}</Label>
                    <Input
                      value={fieldString(formData, field.name)}
                      disabled
                      className="font-mono bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Généré automatiquement depuis le label
                    </p>
                  </div>
                );
              }
              if (!isCreating) {
                return (
                  <div key={field.name}>
                    <Label>{field.label}</Label>
                    <Input
                      value={fieldString(formData, field.name)}
                      disabled
                      className="font-mono bg-muted"
                    />
                  </div>
                );
              }
              return null; // Ne pas afficher le code en mode création
            }

            // Champs éditables
            return (
              <div key={field.name}>
                {field.type === 'checkbox' ? (
                  <div className="flex items-center gap-3 py-2">
                    <Checkbox
                      id={field.name}
                      checked={fieldBoolean(formData, field.name)}
                      onCheckedChange={(checked) => setFormData({ ...formData, [field.name]: !!checked })}
                    />
                    <Label htmlFor={field.name} className="cursor-pointer">
                      {field.label}
                    </Label>
                  </div>
                ) : (
                  <>
                    <Label>
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.type === 'color' ? (
                      <ColorPicker
                        value={fieldString(formData, field.name) || '#6366f1'}
                        onChange={(color) => setFormData({ ...formData, [field.name]: color })}
                      />
                    ) : field.type === 'textarea' ? (
                      <Textarea
                        value={fieldString(formData, field.name)}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        placeholder={field.label}
                      />
                    ) : (
                      <Input
                        value={fieldString(formData, field.name)}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        placeholder={field.label}
                        required={field.required}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!isFormValid() || saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
