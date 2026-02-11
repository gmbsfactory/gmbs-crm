-- Vérifier et créer des données de test si nécessaire
-- Ce script s'assure qu'il y a des données pour tester l'application

-- 1. Vérifier les statuts d'intervention
INSERT INTO intervention_statuses (code, label, color, sort_order) VALUES 
('DEMANDE', 'Demandé', '#6B7280', 1),
('DEVIS_ENVOYE', 'Devis Envoyé', '#F59E0B', 2),
('EN_COURS', 'En Cours', '#3B82F6', 3),
('TERMINE', 'Terminé', '#10B981', 4)
ON CONFLICT (code) DO NOTHING;

-- 2. Vérifier les agences
INSERT INTO agencies (code, label, region) VALUES 
('PARIS', 'Paris', 'Île-de-France'),
('LYON', 'Lyon', 'Auvergne-Rhône-Alpes'),
('MARSEILLE', 'Marseille', 'Provence-Alpes-Côte d''Azur')
ON CONFLICT (code) DO NOTHING;

-- 3. Vérifier les métiers
INSERT INTO metiers (code, label, description) VALUES 
('PLOMBERIE', 'Plomberie', 'Réparations et installations de plomberie'),
('ELECTRICITE', 'Électricité', 'Installations et réparations électriques'),
('CHAUFFAGE', 'Chauffage', 'Installation et maintenance de chauffage')
ON CONFLICT (code) DO NOTHING;

-- 4. Créer des clients de test
INSERT INTO clients (firstname, lastname, email, telephone, adresse, ville, code_postal) VALUES 
('Jean', 'Dupont', 'jean.dupont@test.com', '0123456789', '123 Rue de la Paix', 'Paris', '75001'),
('Marie', 'Martin', 'marie.martin@test.com', '0987654321', '456 Avenue des Champs', 'Lyon', '69001'),
('Pierre', 'Durand', 'pierre.durand@test.com', '0555666777', '789 Boulevard de la République', 'Marseille', '13001')
ON CONFLICT (email) DO NOTHING;

-- 5. Créer des interventions de test
INSERT INTO interventions (
  id_inter, 
  agence_id, 
  client_id, 
  statut_id, 
  metier_id,
  date, 
  contexte_intervention, 
  adresse, 
  ville, 
  code_postal
) 
SELECT 
  'INT-' || generate_series(1, 10),
  (SELECT id FROM agencies LIMIT 1),
  (SELECT id FROM clients ORDER BY RANDOM() LIMIT 1),
  (SELECT id FROM intervention_statuses ORDER BY RANDOM() LIMIT 1),
  (SELECT id FROM metiers ORDER BY RANDOM() LIMIT 1),
  NOW() - (random() * interval '30 days'),
  'Intervention de test ' || generate_series(1, 10),
  'Adresse test ' || generate_series(1, 10),
  'Ville test',
  '75001'
WHERE NOT EXISTS (SELECT 1 FROM interventions LIMIT 1);

-- 6. Afficher le résumé
SELECT 
  'interventions' as table_name, 
  COUNT(*) as count 
FROM interventions
UNION ALL
SELECT 
  'clients' as table_name, 
  COUNT(*) as count 
FROM clients
UNION ALL
SELECT 
  'agencies' as table_name, 
  COUNT(*) as count 
FROM agencies
UNION ALL
SELECT 
  'metiers' as table_name, 
  COUNT(*) as count 
FROM metiers
UNION ALL
SELECT 
  'intervention_statuses' as table_name, 
  COUNT(*) as count 
FROM intervention_statuses;
