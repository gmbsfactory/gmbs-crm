-- Activer le realtime sur intervention_compta_checks
-- Permet la synchronisation en temps réel du surlignage vert entre utilisateurs
ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_compta_checks;
