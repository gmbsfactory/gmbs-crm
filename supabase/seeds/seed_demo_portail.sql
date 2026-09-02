-- ============================================================================
-- Données de démo du portail artisans — BASE LOCALE UNIQUEMENT
-- ============================================================================
-- Contrat : docs/architecture/portail-demo-contrat-api.md (§5)
-- Chargement : scripts/demo/load-seed.sh (refuse toute base non locale)
-- Idempotent : UUID fixes + ON CONFLICT DO NOTHING (rejouable sans doublon).
-- Pré-requis : seed_essential.sql (référentiels, utilisateurs) et migration 99076.
--
-- Contenu :
--   * 1 agence, 1 propriétaire, 1 locataire fictifs
--   * 3 artisans (Karim Benali plombier, Sofia Martins électricienne,
--     Yanis Roux serrurier), statut CONFIRME, is_active = true
--   * 8 interventions DEMO-001…008 (3 ACCEPTE, 3 INTER_EN_COURS, 2 INTER_TERMINEE)
--     assignées au gestionnaire badr@gmbs.fr, adresses parisiennes géocodées
--   * intervention_artisans : Karim 6 (5 primary + 1 secondary sur DEMO-006),
--     Sofia 2 (primary), Yanis 1 (primary sur DEMO-008, pour que chaque
--     intervention ait un artisan)
--   * intervention_costs (cost_type = 'sst') sur chaque intervention
-- Toutes les données (noms, e-mails, téléphones, SIRET) sont fictives.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Agence, propriétaire, locataire
-- ----------------------------------------------------------------------------
INSERT INTO public.agencies (id, code, label, region, is_active)
VALUES ('d0000000-0000-4000-8000-0000000a0001', 'DEMO_PORTAIL', 'Agence Démo Portail', 'Île-de-France', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.owner (id, external_ref, owner_firstname, owner_lastname, plain_nom_facturation, telephone, email, adresse, ville, code_postal)
VALUES ('d0000000-0000-4000-8000-0000000b0001', 'DEMO-OWN-001', 'Hélène', 'Fournier', 'SCI Fournier Immobilier', '01 40 00 00 01', 'demo-proprietaire@example.invalid', '18 rue de Turbigo', 'PARIS', '75002')
ON CONFLICT DO NOTHING;

INSERT INTO public.tenants (id, external_ref, firstname, lastname, plain_nom_client, telephone, email, adresse, ville, code_postal)
VALUES ('d0000000-0000-4000-8000-0000000c0001', 'DEMO-TEN-001', 'Nadia', 'Lambert', 'Nadia Lambert', '06 00 00 00 01', 'demo-locataire@example.invalid', '18 rue de Turbigo', 'PARIS', '75002')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Artisans
-- ----------------------------------------------------------------------------
INSERT INTO public.artisans (
  id, prenom, nom, plain_nom, email, telephone, raison_sociale, siret, statut_juridique,
  adresse_siege_social, ville_siege_social, code_postal_siege_social,
  adresse_intervention, ville_intervention, code_postal_intervention,
  intervention_latitude, intervention_longitude, numero_associe,
  gestionnaire_id, statut_id, statut_dossier, date_ajout, is_active
) VALUES
  ('d0000000-0000-4000-8000-00000000a001', 'Karim', 'Benali', 'Karim Benali', 'karim.benali@example.invalid', '06 00 00 10 01',
   'BENALI PLOMBERIE', '90000000000101', 'AUTO ENTREPRENEUR',
   '4 rue des Pyrénées', 'PARIS', '75020', '4 rue des Pyrénées', 'PARIS', '75020', 48.8532, 2.4012, 'D01',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.artisan_statuses WHERE code = 'CONFIRME'),
   'INCOMPLET', CURRENT_DATE - 120, true),
  ('d0000000-0000-4000-8000-00000000a002', 'Sofia', 'Martins', 'Sofia Martins', 'sofia.martins@example.invalid', '06 00 00 10 02',
   'MARTINS ÉLEC', '90000000000102', 'SASU',
   '27 avenue Secrétan', 'PARIS', '75019', '27 avenue Secrétan', 'PARIS', '75019', 48.8807, 2.3775, 'D02',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.artisan_statuses WHERE code = 'CONFIRME'),
   'INCOMPLET', CURRENT_DATE - 90, true),
  ('d0000000-0000-4000-8000-00000000a003', 'Yanis', 'Roux', 'Yanis Roux', 'yanis.roux@example.invalid', '06 00 00 10 03',
   'ROUX SERRURERIE', '90000000000103', 'EI',
   '9 rue Oberkampf', 'PARIS', '75011', '9 rue Oberkampf', 'PARIS', '75011', 48.8646, 2.3702, 'D03',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.artisan_statuses WHERE code = 'CONFIRME'),
   'INCOMPLET', CURRENT_DATE - 60, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.artisan_metiers (id, artisan_id, metier_id, is_primary) VALUES
  ('d0000000-0000-4000-8000-00000000b101', 'd0000000-0000-4000-8000-00000000a001', (SELECT id FROM public.metiers WHERE code = 'PLOMBERIE'), true),
  ('d0000000-0000-4000-8000-00000000b102', 'd0000000-0000-4000-8000-00000000a002', (SELECT id FROM public.metiers WHERE code = 'ELECTRICITE'), true),
  ('d0000000-0000-4000-8000-00000000b103', 'd0000000-0000-4000-8000-00000000a003', (SELECT id FROM public.metiers WHERE code = 'SERRURERIE'), true)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Interventions DEMO-001 … DEMO-008
-- ----------------------------------------------------------------------------
INSERT INTO public.interventions (
  id, id_inter, agence_id, tenant_id, owner_id, assigned_user_id, statut_id, metier_id,
  date, date_prevue, date_termine, due_date,
  contexte_intervention, consigne_intervention, consigne_second_artisan, commentaire_agent,
  adresse, code_postal, ville, latitude, longitude, reference_agence, is_active
) VALUES
  -- Karim (plomberie)
  ('d0000000-0000-4000-8000-000000010001', 'DEMO-001', 'd0000000-0000-4000-8000-0000000a0001', 'd0000000-0000-4000-8000-0000000c0001', 'd0000000-0000-4000-8000-0000000b0001',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.intervention_statuses WHERE code = 'ACCEPTE'), (SELECT id FROM public.metiers WHERE code = 'PLOMBERIE'),
   now() + interval '1 day', date_trunc('day', now() + interval '1 day') + interval '9 hours', NULL, now() + interval '5 days',
   'Fuite sous l''évier de la cuisine, meuble gorgé d''eau.', 'Remplacer le siphon et vérifier le flexible. Photos avant/après demandées.', NULL, 'Locataire disponible le matin uniquement.',
   '18 rue de Turbigo', '75002', 'PARIS', 48.8656, 2.3520, 'DEMO-REF-001', true),
  ('d0000000-0000-4000-8000-000000010002', 'DEMO-002', 'd0000000-0000-4000-8000-0000000a0001', 'd0000000-0000-4000-8000-0000000c0001', 'd0000000-0000-4000-8000-0000000b0001',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.intervention_statuses WHERE code = 'ACCEPTE'), (SELECT id FROM public.metiers WHERE code = 'PLOMBERIE'),
   now() + interval '2 days', date_trunc('day', now() + interval '2 days') + interval '14 hours', NULL, now() + interval '6 days',
   'Chasse d''eau qui coule en continu.', 'Remplacer le mécanisme complet. Couper l''arrivée d''eau avant.', NULL, NULL,
   '35 rue du Faubourg Saint-Antoine', '75011', 'PARIS', 48.8523, 2.3728, 'DEMO-REF-002', true),
  ('d0000000-0000-4000-8000-000000010003', 'DEMO-003', 'd0000000-0000-4000-8000-0000000a0001', 'd0000000-0000-4000-8000-0000000c0001', 'd0000000-0000-4000-8000-0000000b0001',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.intervention_statuses WHERE code = 'INTER_EN_COURS'), (SELECT id FROM public.metiers WHERE code = 'PLOMBERIE'),
   now(), date_trunc('day', now()) + interval '10 hours', NULL, now() + interval '3 days',
   'Ballon d''eau chaude en panne, plus d''eau chaude depuis 2 jours.', 'Diagnostiquer la résistance et le thermostat. Devis si remplacement du ballon.', NULL, 'Prioritaire : famille avec enfants.',
   '12 boulevard de Belleville', '75020', 'PARIS', 48.8701, 2.3803, 'DEMO-REF-003', true),
  ('d0000000-0000-4000-8000-000000010004', 'DEMO-004', 'd0000000-0000-4000-8000-0000000a0001', 'd0000000-0000-4000-8000-0000000c0001', 'd0000000-0000-4000-8000-0000000b0001',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.intervention_statuses WHERE code = 'INTER_EN_COURS'), (SELECT id FROM public.metiers WHERE code = 'PLOMBERIE'),
   now(), date_trunc('day', now()) + interval '15 hours', NULL, now() + interval '3 days',
   'Robinet de salle de bain qui goutte.', 'Remplacer la cartouche céramique.', NULL, NULL,
   '7 rue de la Roquette', '75011', 'PARIS', 48.8537, 2.3720, 'DEMO-REF-004', true),
  ('d0000000-0000-4000-8000-000000010005', 'DEMO-005', 'd0000000-0000-4000-8000-0000000a0001', 'd0000000-0000-4000-8000-0000000c0001', 'd0000000-0000-4000-8000-0000000b0001',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.intervention_statuses WHERE code = 'INTER_TERMINEE'), (SELECT id FROM public.metiers WHERE code = 'PLOMBERIE'),
   now() - interval '7 days', date_trunc('day', now() - interval '7 days') + interval '9 hours', now() - interval '7 days', now() - interval '4 days',
   'Débouchage de la canalisation de la douche.', 'Furet mécanique, vérifier l''évacuation.', NULL, NULL,
   '40 rue de Ménilmontant', '75020', 'PARIS', 48.8676, 2.3844, 'DEMO-REF-005', true),
  -- Sofia (électricité) — Karim en second sur DEMO-006
  ('d0000000-0000-4000-8000-000000010006', 'DEMO-006', 'd0000000-0000-4000-8000-0000000a0001', 'd0000000-0000-4000-8000-0000000c0001', 'd0000000-0000-4000-8000-0000000b0001',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.intervention_statuses WHERE code = 'INTER_EN_COURS'), (SELECT id FROM public.metiers WHERE code = 'ELECTRICITE'),
   now(), date_trunc('day', now()) + interval '11 hours', NULL, now() + interval '2 days',
   'Disjoncteur qui saute dès que le chauffe-eau se met en route.', 'Contrôler le tableau et le circuit du chauffe-eau.', 'Vérifier le raccordement hydraulique du chauffe-eau après le passage de l''électricienne.', NULL,
   '21 rue de Crimée', '75019', 'PARIS', 48.8835, 2.3782, 'DEMO-REF-006', true),
  ('d0000000-0000-4000-8000-000000010007', 'DEMO-007', 'd0000000-0000-4000-8000-0000000a0001', 'd0000000-0000-4000-8000-0000000c0001', 'd0000000-0000-4000-8000-0000000b0001',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.intervention_statuses WHERE code = 'INTER_TERMINEE'), (SELECT id FROM public.metiers WHERE code = 'ELECTRICITE'),
   now() - interval '10 days', date_trunc('day', now() - interval '10 days') + interval '14 hours', now() - interval '10 days', now() - interval '6 days',
   'Prise de cuisine hors service.', 'Remplacer la prise et contrôler la ligne.', NULL, NULL,
   '3 rue Manin', '75019', 'PARIS', 48.8801, 2.3810, 'DEMO-REF-007', true),
  -- Yanis (serrurerie)
  ('d0000000-0000-4000-8000-000000010008', 'DEMO-008', 'd0000000-0000-4000-8000-0000000a0001', 'd0000000-0000-4000-8000-0000000c0001', 'd0000000-0000-4000-8000-0000000b0001',
   (SELECT id FROM public.users WHERE username = 'badr'), (SELECT id FROM public.intervention_statuses WHERE code = 'ACCEPTE'), (SELECT id FROM public.metiers WHERE code = 'SERRURERIE'),
   now() + interval '3 days', date_trunc('day', now() + interval '3 days') + interval '16 hours', NULL, now() + interval '7 days',
   'Serrure de porte palière bloquée, clé qui tourne dans le vide.', 'Remplacer le cylindre, fournir 3 clés.', NULL, NULL,
   '54 rue Oberkampf', '75011', 'PARIS', 48.8660, 2.3735, 'DEMO-REF-008', true)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Affectations artisans
-- ----------------------------------------------------------------------------
INSERT INTO public.intervention_artisans (id, intervention_id, artisan_id, role, is_primary) VALUES
  ('d0000000-0000-4000-8000-000000020001', 'd0000000-0000-4000-8000-000000010001', 'd0000000-0000-4000-8000-00000000a001', 'primary', true),
  ('d0000000-0000-4000-8000-000000020002', 'd0000000-0000-4000-8000-000000010002', 'd0000000-0000-4000-8000-00000000a001', 'primary', true),
  ('d0000000-0000-4000-8000-000000020003', 'd0000000-0000-4000-8000-000000010003', 'd0000000-0000-4000-8000-00000000a001', 'primary', true),
  ('d0000000-0000-4000-8000-000000020004', 'd0000000-0000-4000-8000-000000010004', 'd0000000-0000-4000-8000-00000000a001', 'primary', true),
  ('d0000000-0000-4000-8000-000000020005', 'd0000000-0000-4000-8000-000000010005', 'd0000000-0000-4000-8000-00000000a001', 'primary', true),
  ('d0000000-0000-4000-8000-000000020006', 'd0000000-0000-4000-8000-000000010006', 'd0000000-0000-4000-8000-00000000a002', 'primary', true),
  ('d0000000-0000-4000-8000-000000020007', 'd0000000-0000-4000-8000-000000010006', 'd0000000-0000-4000-8000-00000000a001', 'secondary', false),
  ('d0000000-0000-4000-8000-000000020008', 'd0000000-0000-4000-8000-000000010007', 'd0000000-0000-4000-8000-00000000a002', 'primary', true),
  ('d0000000-0000-4000-8000-000000020009', 'd0000000-0000-4000-8000-000000010008', 'd0000000-0000-4000-8000-00000000a003', 'primary', true)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Coûts sous-traitant (cost_type = 'sst')
-- ----------------------------------------------------------------------------
INSERT INTO public.intervention_costs (id, intervention_id, cost_type, label, amount, currency, artisan_order) VALUES
  ('d0000000-0000-4000-8000-000000030001', 'd0000000-0000-4000-8000-000000010001', 'sst', 'Coût SST plomberie', 120.00, 'EUR', 1),
  ('d0000000-0000-4000-8000-000000030002', 'd0000000-0000-4000-8000-000000010002', 'sst', 'Coût SST plomberie', 95.00, 'EUR', 1),
  ('d0000000-0000-4000-8000-000000030003', 'd0000000-0000-4000-8000-000000010003', 'sst', 'Coût SST plomberie', 180.00, 'EUR', 1),
  ('d0000000-0000-4000-8000-000000030004', 'd0000000-0000-4000-8000-000000010004', 'sst', 'Coût SST plomberie', 80.00, 'EUR', 1),
  ('d0000000-0000-4000-8000-000000030005', 'd0000000-0000-4000-8000-000000010005', 'sst', 'Coût SST plomberie', 110.00, 'EUR', 1),
  ('d0000000-0000-4000-8000-000000030006', 'd0000000-0000-4000-8000-000000010006', 'sst', 'Coût SST électricité', 150.00, 'EUR', 1),
  ('d0000000-0000-4000-8000-000000030007', 'd0000000-0000-4000-8000-000000010006', 'sst', 'Coût SST plomberie (second artisan)', 60.00, 'EUR', 2),
  ('d0000000-0000-4000-8000-000000030008', 'd0000000-0000-4000-8000-000000010007', 'sst', 'Coût SST électricité', 90.00, 'EUR', 1),
  ('d0000000-0000-4000-8000-000000030009', 'd0000000-0000-4000-8000-000000010008', 'sst', 'Coût SST serrurerie', 140.00, 'EUR', 1)
ON CONFLICT DO NOTHING;

COMMIT;
