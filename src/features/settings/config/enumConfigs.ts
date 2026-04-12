import { agenciesApi, type Agency } from '@/lib/api/v2/agenciesApi';
import { metiersApi, type Metier } from '@/lib/api/v2/metiersApi';
import { interventionStatusesApi, type InterventionStatus } from '@/lib/api/v2/interventionStatusesApi';

export type EntityType = 'agencies' | 'metiers' | 'intervention-statuses';

export type EnumItem = Agency | Metier | InterventionStatus;

export type EnumFieldValue = string | number | boolean | null | undefined;

export type EnumFormData = Record<string, EnumFieldValue>;

export const getEnumFieldValue = (
  item: EnumItem | EnumFormData | null | undefined,
  name: string,
): EnumFieldValue => {
  if (!item) return undefined;
  return (item as Record<string, EnumFieldValue>)[name];
};

/**
 * Generic adapter shape used by the settings UI to drive any enum CRUD table.
 * Each concrete API module (agenciesApi, metiersApi, …) is cast to this at the
 * config boundary below — that single cast is the type-erasure point between
 * the strongly-typed API layer and the generic UI driver.
 */
export interface EnumApiClient {
  getAll(params?: { includeInactive?: boolean }): Promise<EnumItem[]>;
  create?(data: EnumFormData): Promise<EnumItem>;
  update(id: string, data: EnumFormData): Promise<EnumItem | void>;
  delete?(id: string): Promise<void>;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'color' | 'textarea' | 'checkbox';
  editable: boolean;
  required?: boolean;
  generated?: boolean; // Pour le code auto-généré
  inlineToggle?: boolean; // Pour les checkbox éditables directement dans le tableau
}

export interface EnumConfig {
  type: EntityType;
  title: string;
  description: string;
  canCreate: boolean;
  canDelete: boolean;
  fields: FieldConfig[];
  api: EnumApiClient;
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
      { name: 'requires_reference', label: 'Réf. agence requise', type: 'checkbox', editable: true, inlineToggle: true },
    ],
    api: agenciesApi as unknown as EnumApiClient,
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
    api: metiersApi as unknown as EnumApiClient,
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
    api: interventionStatusesApi as unknown as EnumApiClient,
  },
};
