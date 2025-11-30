-- ===== COMPTER LES ARTISANS =====
-- Nombre total d'artisans

-- 1. Nombre total d'artisans
SELECT COUNT(*) as total_artisans FROM artisans;

-- 2. Nombre d'artisans actifs vs inactifs
SELECT 
  is_active,
  COUNT(*) as count
FROM artisans 
GROUP BY is_active;

-- 3. Statistiques complètes des artisans
SELECT 
  COUNT(*) as total,
  COUNT(email) as with_email,
  COUNT(telephone) as with_phone,
  COUNT(siret) as with_siret,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive
FROM artisans;
