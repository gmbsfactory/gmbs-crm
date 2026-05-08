import { describe, it, expect } from 'vitest';
import { EnumResolver, EntityFinder } from '@/utils/import-export/enum-resolver';

const refs = {
  agencies: [
    { id: 'agency-1', label: 'ImoDirect' },
    { id: 'agency-2', label: 'AFEDIM' },
  ],
  metiers: [
    { id: 'metier-1', label: 'Plomberie' },
    { id: 'metier-2', label: 'Électricité' },
  ],
  statuses: [
    { id: 'status-1', label: 'En cours' },
    { id: 'status-2', label: 'Terminé' },
  ],
  users: [
    { id: 'user-1', username: 'alice', code_gestionnaire: 'A' },
    { id: 'user-2', username: 'bob', code_gestionnaire: null },
    { id: 'user-3', username: 'dimitri', code_gestionnaire: 'D' },
  ],
  artisans: [
    { id: 'artisan-1', plain_nom: 'Jean DUPONT' },
    { id: 'artisan-2', plain_nom: 'Marie MARTIN' },
  ],
};

describe('EnumResolver', () => {
  const resolver = new EnumResolver(refs);

  it('résout un label agence exact', () => {
    expect(resolver.getAgencyId('ImoDirect')).toBe('agency-1');
  });

  it('résolution insensible à la casse', () => {
    expect(resolver.getAgencyId('imodirect')).toBe('agency-1');
    expect(resolver.getAgencyId('IMODIRECT')).toBe('agency-1');
  });

  it('résolution insensible aux accents', () => {
    expect(resolver.getMetierId('Electricite')).toBe('metier-2');
  });

  it('retourne null pour un label inconnu', () => {
    expect(resolver.getAgencyId('InconnuXYZ')).toBeNull();
  });

  it('résout un statut', () => {
    expect(resolver.getInterventionStatusId('Terminé')).toBe('status-2');
    expect(resolver.getInterventionStatusId('termine')).toBe('status-2');
  });

  it('résout un username', () => {
    expect(resolver.getUserId('Alice')).toBe('user-1');
  });

  it('résout un code_gestionnaire (lettre) via la DB', () => {
    expect(resolver.getUserId('D')).toBe('user-3');
    expect(resolver.getUserId('d')).toBe('user-3');
  });

  it('résout via la code-map statique pour les alias historiques', () => {
    // "olivier" → "yazid" dans la code-map, mais yazid n'existe pas dans ce fixture
    expect(resolver.getUserId('olivier')).toBeNull();
    // "lucien" → "soufian" idem
    expect(resolver.getUserId('lucien')).toBeNull();
  });
});

describe('EntityFinder', () => {
  const finder = new EntityFinder(refs);

  it('trouve un artisan par plain_nom', () => {
    expect(finder.findArtisanByName('Jean DUPONT')).toBe('artisan-1');
  });

  it('résolution insensible à la casse', () => {
    expect(finder.findArtisanByName('jean dupont')).toBe('artisan-1');
  });

  it('retourne null si inconnu', () => {
    expect(finder.findArtisanByName('Inconnu XYZ')).toBeNull();
  });

  describe('résolution floue (port GSheets)', () => {
    const fuzzyRefs = {
      ...refs,
      artisans: [
        { id: 'artisan-1', plain_nom: 'Jean DUPONT' },
        { id: 'artisan-2', plain_nom: 'Marie MARTIN' },
        { id: 'artisan-3', plain_nom: 'Plomberie Express Paris' },
        { id: 'artisan-4', plain_nom: 'ELEC PRO' },
      ],
    };
    const fuzzyFinder = new EntityFinder(fuzzyRefs);

    it('ignore le suffixe "(archivé)"', () => {
      expect(fuzzyFinder.findArtisanByName('Jean DUPONT (archivé)')).toBe('artisan-1');
      expect(fuzzyFinder.findArtisanByName('Jean DUPONT archivé')).toBe('artisan-1');
    });

    it('ignore le suffixe IDF', () => {
      expect(fuzzyFinder.findArtisanByName('Jean DUPONT IDF')).toBe('artisan-1');
    });

    it('ignore un code numérique terminal (2-3 chiffres)', () => {
      expect(fuzzyFinder.findArtisanByName('Jean DUPONT 75')).toBe('artisan-1');
      expect(fuzzyFinder.findArtisanByName('Jean DUPONT 92 75')).toBe('artisan-1');
    });

    it('ignore un slash terminal', () => {
      expect(fuzzyFinder.findArtisanByName('Jean DUPONT /')).toBe('artisan-1');
    });

    it('match par sous-chaîne (substring)', () => {
      expect(fuzzyFinder.findArtisanByName('Plomberie Express')).toBe('artisan-3');
    });

    it('match composite "A / B" — résout sur la première partie reconnue', () => {
      expect(fuzzyFinder.findArtisanByName('Jean DUPONT / Inconnu XYZ')).toBe('artisan-1');
      expect(fuzzyFinder.findArtisanByName('Inconnu XYZ / Marie MARTIN')).toBe('artisan-2');
    });

    it('renvoie null sous le seuil de score', () => {
      expect(fuzzyFinder.findArtisanByName('Société Inconnue ABC')).toBeNull();
    });
  });
});
