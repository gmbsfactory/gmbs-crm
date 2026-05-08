import { describe, it, expect } from 'vitest';
import { mapInterventionFromCSV, CSV_HEADERS_REQUIRED } from '@/utils/import-export/intervention-mapper';
import type { EnumResolver, EntityFinder } from '@/utils/import-export/enum-resolver';

// ─── Fakes ────────────────────────────────────────────────────────────────────

const resolver: EnumResolver = {
  getAgencyId: (l) => (l.toLowerCase().includes('imodirect') ? 'agency-1' : null),
  getMetierId: (l) => (l.toLowerCase().includes('plomberie') ? 'metier-1' : null),
  getInterventionStatusId: (l) => (l.toLowerCase().includes('cours') ? 'status-1' : null),
  getUserId: (l) => (l === 'alice' ? 'user-1' : null),
} as unknown as EnumResolver;

const finder: EntityFinder = {
  findArtisanByName: (n) => (n.toLowerCase().includes('dupont') ? 'artisan-1' : null),
} as unknown as EntityFinder;

const BASE_ROW = {
  Date: '15/06/2024',
  Agence: 'ImoDirect',
  Métier: 'Plomberie',
  Statut: 'En cours',
  ID: 'INT-001',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('mapInterventionFromCSV', () => {
  it('mappe une ligne complète valide', async () => {
    const result = await mapInterventionFromCSV(
      {
        ...BASE_ROW,
        Adresse: '12 rue de la Paix 75001 Paris',
        "Contexte d'intervention": 'Fuite robinet',
        'COUT SST': '500',
        'COÛT MATERIEL': '100',
        'COUT INTER': '1200',
        SST: 'Jean DUPONT',
        'Gest.': 'alice',
        'TEL LOC': '0612345678',
        Locataire: 'Marie MARTIN',
        'Em@il Locataire': 'marie@example.com',
        "Date d'intervention": '20/06/2024',
        '% SST': '50',
        'Numéro SST': 'SST-42',
      },
      resolver,
      finder,
    );

    expect('_invalid' in result).toBe(false);
    if ('_invalid' in result) return;

    expect(result.id_inter).toBe('INT-001');
    expect(result.agence_id).toBe('agency-1');
    expect(result.metier_id).toBe('metier-1');
    expect(result.statut_id).toBe('status-1');
    expect(result.assigned_user_id).toBe('user-1');
    expect(result.artisan_sst).toBe('artisan-1');
    expect(result.date).toContain('2024-06-15');
    expect(result.date_prevue).toContain('2024-06-20');
    expect(result.numero_sst).toBe('SST-42');
    expect(result.costs.length).toBeGreaterThan(0);
    expect(result.tenant?.email).toBe('marie@example.com');
    expect(result.warnings).toHaveLength(0);
  });

  it('retourne invalid si Date manquante', async () => {
    const result = await mapInterventionFromCSV({ ...BASE_ROW, Date: '' }, resolver, finder);
    expect('_invalid' in result && result._invalid).toBe(true);
    if ('_invalid' in result) expect(result.reason).toMatch(/date/i);
  });

  it('retourne invalid si Métier inconnu (refus strict)', async () => {
    const result = await mapInterventionFromCSV({ ...BASE_ROW, Métier: 'Maconnerie' }, resolver, finder);
    expect('_invalid' in result && result._invalid).toBe(true);
    if ('_invalid' in result) expect(result.reason).toMatch(/métier inconnu/i);
  });

  it('retourne invalid si Agence inconnue (refus strict)', async () => {
    const result = await mapInterventionFromCSV({ ...BASE_ROW, Agence: 'AgenceInconnue' }, resolver, finder);
    expect('_invalid' in result && result._invalid).toBe(true);
    if ('_invalid' in result) expect(result.reason).toMatch(/agence inconnue/i);
  });

  it('produit un warning si artisan inconnu (pas de refus)', async () => {
    const result = await mapInterventionFromCSV({ ...BASE_ROW, SST: 'Artisan Inconnu' }, resolver, finder);
    expect('_invalid' in result).toBe(false);
    if ('_invalid' in result) return;
    expect(result.artisan_sst).toBeNull();
    expect(result.warnings.some((w) => w.field === 'SST')).toBe(true);
  });

  it('produit un warning si adresse manquante (pas de refus)', async () => {
    const result = await mapInterventionFromCSV({ ...BASE_ROW, Adresse: '' }, resolver, finder);
    expect('_invalid' in result).toBe(false);
    if ('_invalid' in result) return;
    expect(result.warnings.some((w) => w.field === 'Adresse')).toBe(true);
  });

  it('mappe SST 2 quand présent', async () => {
    const result = await mapInterventionFromCSV(
      { ...BASE_ROW, SST: 'Jean DUPONT', 'SST 2': 'Jean DUPONT' },
      resolver,
      finder,
    );
    expect('_invalid' in result).toBe(false);
    if ('_invalid' in result) return;
    expect(result.artisan_sst).toBe('artisan-1');
    expect(result.artisan_sst2).toBe('artisan-1');
  });

  it('accepte ID absent (mode création)', async () => {
    const { ID: _, ...rowWithoutId } = BASE_ROW;
    const result = await mapInterventionFromCSV(rowWithoutId, resolver, finder);
    expect('_invalid' in result).toBe(false);
    if ('_invalid' in result) return;
    expect(result.id_inter).toBeNull();
  });

  it('retourne invalid pour une ligne vide', async () => {
    const result = await mapInterventionFromCSV({ Date: '', Agence: '', Métier: '' }, resolver, finder);
    expect('_invalid' in result && result._invalid).toBe(true);
  });

  it('produit un warning si % SST hors plage', async () => {
    const result = await mapInterventionFromCSV({ ...BASE_ROW, '% SST': '150' }, resolver, finder);
    expect('_invalid' in result).toBe(false);
    if ('_invalid' in result) return;
    expect(result.warnings.some((w) => w.field === '% SST')).toBe(true);
  });
});

describe('CSV_HEADERS_REQUIRED', () => {
  it('contient les champs minimaux', () => {
    expect(CSV_HEADERS_REQUIRED).toContain('Date');
    expect(CSV_HEADERS_REQUIRED).toContain('Métier');
    expect(CSV_HEADERS_REQUIRED).toContain('Agence');
  });
});
