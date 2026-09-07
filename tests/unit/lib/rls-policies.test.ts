import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Garde-fou contre la reintroduction de l'anti-pattern RLS corrige par
 * la migration 99076.
 *
 * Dans ce projet `auth.users.id` != `public.users.id` pour la majorite des
 * comptes. Une policy qui compare `auth.uid()` a une colonne referencant
 * `public.users(id)` est donc silencieusement fausse : elle ne renvoie aucune
 * ligne et bloque l'utilisateur, sans erreur explicite. C'est ce qui avait
 * casse user_preferences et email_logs, puis conduit a desactiver la RLS a la
 * main en production (alerte `rls_disabled_in_public` du Security Advisor).
 *
 * On ne verifie pas l'historique - les migrations fautives font partie du
 * passe et sont corrigees par 99076. On verifie que les migrations
 * *posterieures* ne le reintroduisent pas.
 *
 * Voir docs/database/rls-policies.md > Points de vigilance.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')
const FIX_MIGRATION = '99076_rls_unify_identity_and_restore_user_tables.sql'
const LOCK_MIGRATION = '99077_rls_lock_remaining_public_tables.sql'

/** Toute migration dont le prefixe numerique est >= celui du correctif. */
const FIX_PREFIX = 99076

function migrationPrefix(filename: string): number {
  const match = /^(\d+)/.exec(filename)
  return match ? Number(match[1]) : Number.NaN
}

function listMigrations(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8')
}

/**
 * Retire les commentaires SQL (lignes `--` et blocs) pour ne pas declencher
 * sur les explications, qui citent volontairement l'anti-pattern.
 */
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
}

/**
 * `auth.uid()` compare a une colonne qui, dans ce schema, refere a
 * public.users(id). Couvre les deux sens de la comparaison et le cast ::text
 * qui servait a masquer l'incoherence de type.
 */
const FORBIDDEN_COMPARISONS = [
  /auth\.uid\(\)\s*(?:::\s*text\s*)?=\s*\(?\s*(?:user_id|sent_by|created_by|updated_by|assigned_to)\b/i,
  /\b(?:user_id|sent_by|created_by|updated_by|assigned_to)\s*(?:::\s*text\s*)?=\s*auth\.uid\(\)/i,
  /auth\.uid\(\)\s*=\s*ANY\s*\(\s*mentioned_user_ids/i,
]

describe('RLS policies - resolution d\'identite', () => {
  it('la migration corrective 99076 est presente', () => {
    expect(listMigrations()).toContain(FIX_MIGRATION)
  })

  it('unifie get_public_user_id() sur les trois chemins de resolution', () => {
    const sql = readMigration(FIX_MIGRATION)

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_public_user_id()')
    // Ordre de resolution : mapping -> colonne de liaison -> email
    expect(sql).toContain('auth_user_mapping')
    expect(sql).toContain('u.auth_user_id = auth.uid()')
    expect(sql).toMatch(/lower\(au\.email\)\s*=\s*lower\(u\.email\)/)
    // get_current_user_id() ne doit plus porter sa propre logique
    expect(sql).toMatch(/get_current_user_id\(\)[\s\S]*SELECT public\.get_public_user_id\(\)/)
  })

  it('reactive la RLS sur les trois tables signalees par le Security Advisor', () => {
    const sql = readMigration(FIX_MIGRATION)

    for (const table of ['user_preferences', 'intervention_reminders', 'email_logs']) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    }
  })

  it('ne compare jamais auth.uid() a une colonne referencant public.users', () => {
    const offenders: string[] = []

    for (const file of listMigrations()) {
      if (migrationPrefix(file) < FIX_PREFIX) continue

      const sql = stripSqlComments(readMigration(file))
      for (const pattern of FORBIDDEN_COMPARISONS) {
        if (pattern.test(sql)) {
          offenders.push(`${file} (${pattern.source})`)
        }
      }
    }

    expect(
      offenders,
      'Utiliser public.get_public_user_id() plutot que auth.uid() : ' +
        'voir docs/database/rls-policies.md > Points de vigilance',
    ).toEqual([])
  })

  it('99077 verrouille les tables publiques restantes', () => {
    const sql = readMigration(LOCK_MIGRATION)

    const tables = [
      // Regime A : atteintes par le navigateur, donc avec policies
      'zones',
      'artisan_metiers',
      'agency_config',
      // Regime B : aucun acces applicatif, deny-all assume
      'tasks',
      'task_statuses',
      'sync_logs',
      'podium_periods',
      'search_views_refresh_flags',
    ]
    for (const table of tables) {
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`),
      )
    }

    // Les tables lues en embed PostgREST doivent avoir une policy SELECT,
    // sinon l'embed renvoie null en silence (cf. bug des avatars, 99057).
    for (const table of ['zones', 'artisan_metiers', 'agency_config']) {
      expect(sql).toContain(`${table}_select_authenticated`)
    }
  })

  it('99077 corrige le contexte d\'execution des fonctions traversant la RLS', () => {
    const sql = readMigration(LOCK_MIGRATION)

    // Triggers ecrivant dans search_views_refresh_flags : sans SECURITY DEFINER,
    // leur UPDATE toucherait 0 ligne SANS erreur et la recherche se figerait.
    for (const fn of ['flag_interventions_search_refresh', 'flag_artisans_search_refresh']) {
      const declaration = new RegExp(
        `CREATE OR REPLACE FUNCTION public\\.${fn}\\(\\)[\\s\\S]{0,200}?SECURITY DEFINER`,
      )
      expect(sql, `${fn} doit etre SECURITY DEFINER`).toMatch(declaration)
    }

    // La meme table est LUE par search_global() (99073), STABLE et non
    // SECURITY DEFINER. Une lecture se resout par une policy SELECT, pas en
    // elargissant les droits de la fonction : moins de privileges accordes.
    expect(sql).toContain('search_views_refresh_flags_select_authenticated')

    // search_path fige sur toute fonction SECURITY DEFINER (durcissement).
    // Commentaires retires : l'en-tete explicatif mentionne SECURITY DEFINER
    // sans qu'il s'agisse d'une declaration.
    const code = stripSqlComments(sql)
    const secDefFunctions = code.match(/SECURITY DEFINER/g) ?? []
    const searchPaths = code.match(/SET search_path = public, pg_temp/g) ?? []
    expect(searchPaths.length).toBeGreaterThanOrEqual(secDefFunctions.length)
  })

  it('declare TO authenticated sur chaque policy creee apres le correctif', () => {
    const offenders: string[] = []

    for (const file of listMigrations()) {
      if (migrationPrefix(file) < FIX_PREFIX) continue

      const sql = stripSqlComments(readMigration(file))
      // Une policy sans clause de role s'applique aussi a `anon`,
      // c'est-a-dire a la cle publique embarquee dans le bundle JS.
      const policies = sql.match(/CREATE POLICY[\s\S]*?(?=;)/gi) ?? []
      for (const policy of policies) {
        if (!/\bTO\s+(authenticated|service_role)\b/i.test(policy)) {
          const name = /CREATE POLICY\s+("[^"]+"|\S+)/i.exec(policy)?.[1] ?? '?'
          offenders.push(`${file} -> ${name}`)
        }
      }
    }

    expect(
      offenders,
      'Une policy sans clause TO s\'applique au role anon (cle publique)',
    ).toEqual([])
  })
})
