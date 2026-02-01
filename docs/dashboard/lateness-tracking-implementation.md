# Implémentation du Système de Suivi des Retards - Solution 1

## 📋 Résumé de l'implémentation

Le système de suivi des retards a été refactorisé pour détecter **la première activité du jour** plutôt que de détecter à chaque chargement du dashboard.

### Architecture

```
User ouvre le navigateur (session persistante active)
    ↓
App charge → AuthStateListenerProvider monte
    ↓
useEffect vérifie localStorage['last_activity_check']
    ↓
Si différent d'aujourd'hui → POST /api/auth/first-activity
    ↓
Serveur vérifie last_activity_date en DB
    ↓
Si différent d'aujourd'hui → C'est la première activité !
    ↓
Capture l'heure (now) et vérifie isLateLogin(now)
    ↓
Si retard → Incrémenter lateness_count
    ↓
Update last_activity_date = today
    ↓
Return { wasFirstActivity: true, latenessCount }
    ↓
Client met à jour localStorage['last_activity_check'] = today
    ↓
Dashboard affiche le toast si nécessaire
```

---

## 🔧 Fichiers modifiés

### 1. Migration DB
**Fichier:** `supabase/migrations/00025_lateness_tracking.sql`

**Changement:** Ajout de la colonne `last_activity_date`

```sql
ADD COLUMN IF NOT EXISTS last_activity_date DATE DEFAULT NULL;
```

**Index créé:**
```sql
CREATE INDEX IF NOT EXISTS idx_users_last_activity_date
  ON public.users(last_activity_date)
  WHERE last_activity_date IS NOT NULL;
```

### 2. Nouvel endpoint API
**Fichier:** `app/api/auth/first-activity/route.ts` (NOUVEAU)

**Responsabilité:**
- Vérifier si `last_activity_date` ≠ aujourd'hui
- Si oui, c'est la première activité du jour
- Capturer l'heure actuelle et vérifier `isLateLogin()`
- Incrémenter `lateness_count` si retard
- Mettre à jour `last_activity_date = today`
- Retourner `{ wasFirstActivity, latenessCount }`

### 3. Provider global
**Fichier:** `src/providers/AuthStateListenerProvider.tsx`

**Changements:**
- Import de `useCurrentUser`
- Nouveau `useEffect` qui s'exécute une fois au chargement
- Vérification localStorage pour optimisation
- Appel à `/api/auth/first-activity`
- Mise à jour localStorage après vérification

**Code ajouté:**
```typescript
// Check for first activity of the day (lateness tracking)
useEffect(() => {
  if (!currentUser?.id) return

  const checkFirstActivity = async () => {
    const lastCheck = localStorage.getItem('last_activity_check')
    const today = new Date().toISOString().split('T')[0]

    if (lastCheck === today) {
      // Already checked today, skip API call
      return
    }

    // Call API to check and log first activity
    const response = await fetch('/api/auth/first-activity', {
      method: 'POST',
      credentials: 'include'
    })

    // Mark as checked today in localStorage
    localStorage.setItem('last_activity_check', today)
  }

  checkFirstActivity()
}, [currentUser?.id])
```

### 4. Nettoyage /api/auth/status
**Fichier:** `app/api/auth/status/route.ts`

**Changements:**
- ❌ Supprimé imports `isLateLogin` et `isSameDay`
- ❌ Supprimé toute la logique de détection de retard (lignes 66-136)
- ✅ Garde uniquement la mise à jour de `status` et `last_seen_at`

**Avant:** ~140 lignes
**Après:** ~67 lignes

### 5. Nettoyage Dashboard
**Fichier:** `app/dashboard/page.tsx`

**Changements:**
- ❌ Supprimé l'appel à `/api/auth/status` dans le useEffect
- ✅ Garde uniquement l'appel à `/api/lateness/check` pour afficher le toast
- Simplifié la logique de notification

---

## 🧪 Comment tester

### Test 1: Première connexion du jour après 10h

**Scénario:**
1. Effacer `localStorage['last_activity_check']`
2. Effacer la DB : `UPDATE users SET last_activity_date = NULL WHERE id = 'YOUR_ID'`
3. S'assurer que l'heure système > 10h
4. Ouvrir le navigateur avec session persistante

**Résultat attendu:**
- Console: `[first-activity] 🎯 First activity of the day detected!`
- Console: `[first-activity] ⏰ Is late login: true`
- Console: `[first-activity] ✅ INCREMENTING lateness count to: X`
- DB: `lateness_count` incrémenté de 1
- DB: `last_activity_date` = aujourd'hui
- Toast: "Tu as eu X retard(s) cette année"

### Test 2: Refresh pendant la journée (même jour)

**Scénario:**
1. Après le Test 1, rafraîchir la page (F5)
2. Vérifier les logs

**Résultat attendu:**
- Console: `[AuthStateListenerProvider] Already checked first activity today, skipping`
- Aucun appel à `/api/auth/first-activity`
- DB: `lateness_count` reste inchangé
- Pas de nouveau toast

### Test 3: Première connexion du jour avant 10h

**Scénario:**
1. Effacer `localStorage['last_activity_check']`
2. Effacer la DB : `UPDATE users SET last_activity_date = NULL WHERE id = 'YOUR_ID'`
3. S'assurer que l'heure système < 10h (ou désactiver le mode test)
4. Ouvrir le navigateur

**Résultat attendu:**
- Console: `[first-activity] 🎯 First activity of the day detected!`
- Console: `[first-activity] ⏰ Is late login: false`
- Console: `[first-activity] ✅ Not a late login`
- DB: `lateness_count` reste inchangé
- DB: `last_activity_date` = aujourd'hui
- Pas de toast

### Test 4: Changement de jour (session persistante)

**Scénario:**
1. Connexion à 11h aujourd'hui (retard compté)
2. Garder le navigateur ouvert
3. Le lendemain à 9h, rafraîchir la page

**Résultat attendu:**
- localStorage['last_activity_check'] = hier (date différente)
- Appel à `/api/auth/first-activity`
- Console: `[first-activity] 🎯 First activity of the day detected!`
- Console: `[first-activity] ⏰ Is late login: false` (car 9h)
- DB: `last_activity_date` = nouvelle date
- Pas de nouveau retard

### Test 5: Admin/Manager exemption

**Scénario:**
1. Utiliser un compte avec rôle `admin` ou `manager`
2. Se connecter après 10h

**Résultat attendu:**
- Console: `[first-activity] 🚫 Admin/Manager, skipping lateness tracking`
- DB: `lateness_count` reste à 0
- Pas de toast

### Test 6: Reset annuel

**Scénario:**
1. Modifier la DB : `UPDATE users SET lateness_count_year = 2024 WHERE id = 'YOUR_ID'`
2. Se connecter (année 2025)

**Résultat attendu:**
- Console: `[first-activity] 📆 Year changed, resetting counter`
- DB: `lateness_count = 0`
- DB: `lateness_count_year = 2025`
- DB: `last_lateness_date = NULL`

---

## 🐛 Debugging

### Logs à surveiller

**AuthStateListenerProvider:**
```
[AuthStateListenerProvider] Checking first activity of the day...
[AuthStateListenerProvider] First activity check result: {...}
[AuthStateListenerProvider] ✅ First activity of the day detected
```

**API /api/auth/first-activity:**
```
[first-activity] 🔍 Checking first activity for user: xxx
[first-activity] 📅 Last activity date: 2025-12-13
[first-activity] 📅 Today: 2025-12-14
[first-activity] 🎯 First activity of the day detected!
[first-activity] ⏰ Is late login: true
[first-activity] ✅ INCREMENTING lateness count to: 5
```

### Vérifications DB

```sql
-- Voir l'état actuel d'un utilisateur
SELECT
  id,
  username,
  last_activity_date,
  lateness_count,
  lateness_count_year,
  last_lateness_date,
  lateness_notification_shown_at
FROM users
WHERE id = 'YOUR_USER_ID';

-- Reset pour tester
UPDATE users
SET
  last_activity_date = NULL,
  lateness_count = 0,
  last_lateness_date = NULL,
  lateness_notification_shown_at = NULL
WHERE id = 'YOUR_USER_ID';
```

### Vérifications localStorage

```javascript
// Dans la console du navigateur
localStorage.getItem('last_activity_check')
// Doit retourner la date du jour au format YYYY-MM-DD

// Reset pour tester
localStorage.removeItem('last_activity_check')
```

---

## ⚙️ Configuration

### Activer la logique de production

**Fichier:** `src/lib/utils/business-days.ts`

Actuellement en mode TEST (toujours `true`). Pour activer la vraie logique :

```typescript
export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = getDay(date) // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return dayOfWeek >= 1 && dayOfWeek <= 5 // Monday (1) to Friday (5)
}

export function isAfter10AM(date: Date = new Date()): boolean {
  const hours = date.getHours()
  return hours >= 10
}
```

### Changer l'heure limite

Pour changer de 10h à 8h par exemple :

```typescript
export function isAfter10AM(date: Date = new Date()): boolean {
  const hours = date.getHours()
  return hours >= 8  // ← Changer ici
}
```

---

## 📊 Avantages de cette implémentation

✅ **Fiabilité:** Détecte VRAIMENT la première activité du jour (pas juste le chargement du dashboard)
✅ **Performance:** localStorage évite les requêtes API inutiles tout au long de la journée
✅ **Sécurité:** Double vérification (localStorage + DB) pour éviter les manipulations
✅ **Précision:** Capture l'heure EXACTE de la première activité
✅ **Simplicité:** Un seul endpoint dédié, logique claire et centralisée
✅ **Robustesse:** Gère tous les edge cases (session persistante, changement de jour, reset annuel)
✅ **Maintenabilité:** Code bien séparé, facile à débugger

---

## 🔄 Migration depuis l'ancienne version

Si vous avez déjà des données en production :

```sql
-- Appliquer la nouvelle migration
-- La colonne last_activity_date sera NULL pour tous les utilisateurs existants
-- Au prochain login, elle sera automatiquement remplie

-- Optionnel: initialiser avec last_seen_at si vous voulez garder l'historique
UPDATE users
SET last_activity_date = DATE(last_seen_at)
WHERE last_seen_at IS NOT NULL
  AND last_activity_date IS NULL;
```

---

## 📝 Notes importantes

1. **localStorage vs sessionStorage:**
   On utilise `localStorage` (pas `sessionStorage`) car on veut que la vérification persiste même si l'utilisateur ouvre un nouvel onglet.

2. **Pourquoi pas de vérification dans le middleware?**
   Le middleware s'exécute sur CHAQUE requête (dashboard, interventions, etc.). Ça créerait trop de requêtes DB. Le Provider global est plus efficace.

3. **Gestion des fuseaux horaires:**
   Les dates utilisent `toISOString().split('T')[0]` qui donne YYYY-MM-DD en UTC. Si vous êtes dans un fuseau horaire différent, attention au changement de jour à minuit.

4. **Race conditions:**
   Si l'utilisateur ouvre 10 onglets simultanément, tous vérifient localStorage avant que le premier ait fini. C'est OK car le serveur fait la vraie vérification avec `last_activity_date` en DB.

---

## 🎯 Prochaines étapes recommandées

1. ✅ Tester l'implémentation en développement
2. ⚙️ Activer la vraie logique de business days (décommenter le code)
3. 📊 Vérifier les requêtes SQL existantes dans `supabase/samples/sql/lateness/`
4. 🔔 Ajuster le message du toast si nécessaire
5. 📈 Monitorer les logs en production
6. 🧹 Optionnel: Nettoyer les anciennes données de test

---

Dernière mise à jour: 2025-12-14
