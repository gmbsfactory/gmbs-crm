import { describe, it, expect } from 'vitest';
import { extractInterventionId } from '@/utils/import-export/parsers/id-parser';

describe('extractInterventionId', () => {
  it('retourne null pour null/undefined/vide/espaces', () => {
    expect(extractInterventionId(null)).toBeNull();
    expect(extractInterventionId(undefined)).toBeNull();
    expect(extractInterventionId('')).toBeNull();
    expect(extractInterventionId('   ')).toBeNull();
  });

  it('trim les espaces et passe en majuscules', () => {
    expect(extractInterventionId('  test-1  ')).toBe('TEST-1');
    expect(extractInterventionId('abc')).toBe('ABC');
  });

  it('préserve les chiffres tels quels', () => {
    expect(extractInterventionId('1001')).toBe('1001');
    expect(extractInterventionId('00123')).toBe('00123');
  });

  it('préserve les IDs alphanumériques avec tirets/suffixes (pas de troncature)', () => {
    expect(extractInterventionId('123-bis')).toBe('123-BIS');
    expect(extractInterventionId('URG-1234')).toBe('URG-1234');
    expect(extractInterventionId('2025-001')).toBe('2025-001');
    expect(extractInterventionId('DOM-2025-01')).toBe('DOM-2025-01');
  });

  it('uppercase est idempotent', () => {
    const once = extractInterventionId('test-1');
    expect(extractInterventionId(once)).toBe(once);
  });
});
