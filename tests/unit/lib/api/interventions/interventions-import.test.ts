import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveTenants,
  resolveOwners,
  interventionsImportApi,
} from '@/lib/api/interventions/interventions-import';
import type { TenantInfo, OwnerInfo } from '@/utils/import-export/parsers/person-parser';
import type { MappedIntervention } from '@/utils/import-export/types/import-types';

function makeMapped(tenant: TenantInfo | null, owner: OwnerInfo | null = null): MappedIntervention {
  return { tenant, owner } as unknown as MappedIntervention;
}

function makeSupabaseRpc(rpcResponse: { data: unknown[]; error: null | { message: string } }) {
  const rpc = vi.fn().mockResolvedValue(rpcResponse);
  const insert = vi.fn().mockReturnThis();
  const select = vi.fn().mockResolvedValue({ data: [], error: null });
  const from = vi.fn(() => ({ insert, select }));
  return { client: { rpc, from } as never, rpc, from, insert };
}

describe('resolveTenants', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns "none" for every line when no tenant info exists', async () => {
    const { client, rpc } = makeSupabaseRpc({ data: [], error: null });
    const out = await resolveTenants(
      client,
      [{ line: 1, mapped: makeMapped(null) }, { line: 2, mapped: makeMapped(null) }],
      true,
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(out.get(1)).toEqual({ kind: 'none' });
    expect(out.get(2)).toEqual({ kind: 'none' });
  });

  it('calls the resolver RPC with deduped phones/emails/names (no .in chunking)', async () => {
    const { client, rpc } = makeSupabaseRpc({ data: [], error: null });
    const tenants: TenantInfo[] = [
      { telephone: '0601', telephone2: null, email: 'a@x.fr', plain_nom_client: 'Alice', firstname: null, lastname: null },
      { telephone: '0601', telephone2: null, email: 'a@x.fr', plain_nom_client: 'Alice', firstname: null, lastname: null }, // dupe
      { telephone: '0602', telephone2: null, email: null, plain_nom_client: 'Bob', firstname: null, lastname: null },
    ];
    await resolveTenants(
      client,
      tenants.map((t, i) => ({ line: i + 1, mapped: makeMapped(t) })),
      true,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('csv_intervention_import_resolve_tenants');
    expect(args.p_telephones.sort()).toEqual(['0601', '0602']);
    expect(args.p_telephones2.sort()).toEqual(['0601', '0602']); // mêmes valeurs scannées sur les 2 colonnes
    expect(args.p_emails).toEqual(['a@x.fr']);
    expect(args.p_names.sort()).toEqual(['Alice', 'Bob']);
  });

  it('maps existing matches to kind="existing" and dryRun missing to kind="new" (id=null)', async () => {
    const { client } = makeSupabaseRpc({
      data: [
        { id: 'tenant-alice', telephone: '0601', telephone2: null, email: null, plain_nom_client: null },
      ],
      error: null,
    });
    const out = await resolveTenants(
      client,
      [
        { line: 1, mapped: makeMapped({ telephone: '0601', telephone2: null, email: null, plain_nom_client: 'Alice', firstname: null, lastname: null }) },
        { line: 2, mapped: makeMapped({ telephone: '0602', telephone2: null, email: null, plain_nom_client: 'Bob', firstname: null, lastname: null }) },
      ],
      true,
    );
    expect(out.get(1)).toEqual({ kind: 'existing', id: 'tenant-alice' });
    expect(out.get(2)).toEqual({ kind: 'new', id: null });
  });
});

describe('resolveByComposite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renvoie une Map vide si aucune ligne en entrée (court-circuit, pas d\'appel RPC)', async () => {
    const rpc = vi.fn();
    const out = await interventionsImportApi.resolveByComposite(
      { rpc } as never,
      [],
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(out.size).toBe(0);
  });

  it('appelle le RPC avec lignes, agence_id, date (jour UTC), adresse — et indexe par line', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { line: 7, match_ids: ['inter-a'] },
        { line: 9, match_ids: ['inter-b', 'inter-c'] },
      ],
      error: null,
    });
    const out = await interventionsImportApi.resolveByComposite(
      { rpc } as never,
      [
        { line: 7, agence_id: 'ag-1', date: '2024-06-15T00:00:00Z', adresse: '12 rue Paix' },
        { line: 9, agence_id: null, date: '2024-06-16T23:45:00+02:00', adresse: '8 rue Lyon' },
      ],
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('csv_intervention_import_resolve_by_composite');
    expect(args.p_lines).toEqual([7, 9]);
    expect(args.p_agence_ids).toEqual(['ag-1', null]);
    // Truncation au jour : on garde uniquement les 10 premiers caractères.
    expect(args.p_dates).toEqual(['2024-06-15', '2024-06-16']);
    expect(args.p_addresses).toEqual(['12 rue Paix', '8 rue Lyon']);
    expect(out.get(7)).toEqual(['inter-a']);
    expect(out.get(9)).toEqual(['inter-b', 'inter-c']);
  });

  it('ignore les lignes avec match_ids vide', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ line: 1, match_ids: [] }, { line: 2, match_ids: ['x'] }],
      error: null,
    });
    const out = await interventionsImportApi.resolveByComposite(
      { rpc } as never,
      [
        { line: 1, agence_id: null, date: '2024-06-15T00:00:00Z', adresse: 'a' },
        { line: 2, agence_id: null, date: '2024-06-15T00:00:00Z', adresse: 'b' },
      ],
    );
    expect(out.has(1)).toBe(false);
    expect(out.get(2)).toEqual(['x']);
  });

  it('propage l\'erreur RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(
      interventionsImportApi.resolveByComposite(
        { rpc } as never,
        [{ line: 1, agence_id: null, date: '2024-06-15T00:00:00Z', adresse: 'a' }],
      ),
    ).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('resolveOwners', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls csv_intervention_import_resolve_owners with deduped arrays', async () => {
    const { client, rpc } = makeSupabaseRpc({ data: [], error: null });
    const owner: OwnerInfo = {
      telephone: '0701', email: 'o@x.fr', plain_nom_facturation: 'Owner Co', firstname: null, lastname: null,
    };
    await resolveOwners(
      client,
      [{ line: 1, mapped: makeMapped(null, owner) }],
      true,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('csv_intervention_import_resolve_owners');
    expect(args.p_telephones).toEqual(['0701']);
    expect(args.p_emails).toEqual(['o@x.fr']);
    expect(args.p_names).toEqual(['Owner Co']);
  });
});
