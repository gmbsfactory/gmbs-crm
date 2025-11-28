-- Requête pour obtenir les 20 interventions avec les plus grosses sommes totales
-- Regroupe les paiements par intervention_id et somme les montants
-- Jointure fainéante (LEFT JOIN) avec la table interventions pour récupérer des informations supplémentaires

SELECT 
    ip.intervention_id,
    i.id_inter,
    SUM(ip.amount) AS total_cost,
    i.date,
    i.adresse,
    i.ville,
    i.code_postal,
    i.statut_id,
    i.metier_id
FROM 
    public.intervention_payments ip
LEFT JOIN 
    public.interventions i ON ip.intervention_id = i.id
WHERE 
    ip.intervention_id IS NOT NULL
GROUP BY 
    ip.intervention_id,
    i.id_inter,
    i.date,
    i.adresse,
    i.ville,
    i.code_postal,
    i.statut_id,
    i.metier_id
ORDER BY 
    total_cost DESC
LIMIT 20;

