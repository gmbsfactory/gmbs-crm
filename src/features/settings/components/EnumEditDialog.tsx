'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ColorPicker } from './ColorPicker';
import { EnumConfig } from '@/features/settings/config/enumConfigs';

interface EnumEditDialogProps {
  config: EnumConfig;
  item: any | null; // null si création
  isCreating: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function EnumEditDialog({ config, item, isCreating, onClose, onSave }: EnumEditDialogProps) {
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Initialiser le formulaire
  useEffect(() => {
    if (item) {
      // Mode édition : copier les données
      setFormData({ ...item });
    } else {
      // Mode création : initialiser avec des valeurs par défaut
      const initialData: any = {};
      config.fields.forEach(field => {
        if (field.editable) {
          initialData[field.name] = field.type === 'color' ? '#6366f1' : '';
        }
      });
      setFormData(initialData);
    }
  }, [item, config.fields]);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Préparer les données à sauvegarder (seulement les champs éditables)
      const dataToSave: any = {};
      config.fields
        .filter(f => f.editable)
        .forEach(field => {
          dataToSave[field.name] = formData[field.name];
        });

      if (isCreating) {
        // Création
        await config.api.create(dataToSave);
      } else {
        // Édition
        await config.api.update(item.id, dataToSave);
      }

      onSave();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      if (error.message === 'duplicate_code') {
        alert('Ce code existe déjà. Veuillez choisir un autre label.');
      } else {
        alert(`Erreur: ${error.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Vérifier si le formulaire est valide
  const isFormValid = () => {
    return config.fields
      .filter(f => f.editable && f.required)
      .every(field => formData[field.name] && formData[field.name].trim() !== '');
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
                      value={formData[field.name] || ''}
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
                      value={formData[field.name] || ''}
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
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {field.type === 'color' ? (
                  <ColorPicker
                    value={formData[field.name] || '#6366f1'}
                    onChange={(color) => setFormData({ ...formData, [field.name]: color })}
                  />
                ) : field.type === 'textarea' ? (
                  <Textarea
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    placeholder={field.label}
                  />
                ) : (
                  <Input
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    placeholder={field.label}
                    required={field.required}
                  />
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
