-- Réinitialise toutes les coordonnées latitude et longitude des interventions
-- Y compris celles à 0,0

UPDATE interventions 
SET latitude = NULL, longitude = NULL 
WHERE latitude IS NOT NULL OR longitude IS NOT NULL;


