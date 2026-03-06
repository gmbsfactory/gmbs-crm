-- Activer le realtime sur intervention_compta_checks
-- Permet la synchronisation en temps réel du surlignage vert entre utilisateurs
ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_compta_checks;

-- REPLICA IDENTITY FULL nécessaire pour que les événements DELETE
-- incluent intervention_id (pas seulement la clé primaire id)
ALTER TABLE public.intervention_compta_checks REPLICA IDENTITY FULL;
