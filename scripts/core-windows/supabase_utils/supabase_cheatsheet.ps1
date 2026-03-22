# Lister les projets disponibles
supabase projects list

# CHeck login 
supabase login

# 1. S'assurer d'être lié au bon projet
supabase link --project-ref <project-ref>

# 2. Pousser les migrations en production
supabase db push

# 3. (Si schéma modifié) Régénérer les types TypeScript
npm run types:generate
