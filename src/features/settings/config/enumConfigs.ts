import { agenciesApi } from '@/lib/api/v2/agenciesApi';
import { metiersApi } from '@/lib/api/v2/metiersApi';
import { interventionStatusesApi } from '@/lib/api/v2/interventionStatusesApi';

export type EntityType = 'agencies' | 'metiers' | 'intervention-statuses';

export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'color' | 'textarea';
  editable: boolean;
  required?: boolean;
  generated?: boolean; // Pour le code auto-généré
}

export interface EnumConfig {
  type: EntityType;
  title: string;
  description: string;
  canCreate: boolean;
  canDelete: boolean;
  fields: FieldConfig[];
  api: any; // API client (agenciesApi, metiersApi, etc.)
}

export const ENUM_CONFIGS: Record<EntityType, EnumConfig> = {
  'agencies': {
    type: 'agencies',
    title: 'Agences',
    description: 'Gestion des agences',
    canCreate: true,
    canDelete: true,
    fields: [
      { name: 'code', label: 'Code', type: 'text', editable: false, generated: true },
      { name: 'label', label: 'Label', type: 'text', editable: true, required: true },
      { name: 'color', label: 'Couleur', type: 'color', editable: true },
    ],
    api: agenciesApi,
  },
  'metiers': {
    type: 'metiers',
    title: 'Métiers',
    description: 'Gestion des métiers disponibles',
    canCreate: true,
    canDelete: true,
    fields: [
      { name: 'code', label: 'Code', type: 'text', editable: false, generated: true },
      { name: 'label', label: 'Label', type: 'text', editable: true, required: true },
      { name: 'description', label: 'Description', type: 'textarea', editable: true },
      { name: 'color', label: 'Couleur', type: 'color', editable: true },
    ],
    api: metiersApi,
  },
  'intervention-statuses': {
    type: 'intervention-statuses',
    title: 'Statuts d\'Intervention',
    description: 'Gestion des statuts (édition uniquement)',
    canCreate: false, // IMPORTANT
    canDelete: false, // IMPORTANT
    fields: [
      { name: 'code', label: 'Code', type: 'text', editable: false }, // Lecture seule
      { name: 'label', label: 'Label', type: 'text', editable: true, required: true },
      { name: 'color', label: 'Couleur', type: 'color', editable: true },
    ],
    api: interventionStatusesApi,
  },
};
