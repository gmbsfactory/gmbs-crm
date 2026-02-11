# 🧪 Test du Rafraîchissement en Temps Réel

## Comment tester

### 1. Ouvrir l'application
```bash
npm run dev
```

### 2. Ouvrir la console du navigateur
- Chrome/Edge : `F12` ou `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)
- Firefox : `F12` ou `Ctrl+Shift+K` (Windows/Linux) / `Cmd+Option+K` (Mac)

### 3. Naviguer vers la page des interventions
```
http://localhost:3000/interventions
```

### 4. Modifier une intervention

1. Cliquez sur une intervention dans la TableView
2. Modifiez un champ (par exemple, le statut ou l'adresse)
3. Cliquez sur "Enregistrer"
4. **Observez** :
   - ⚡ La TableView se met à jour **instantanément** (< 100ms)
   - Le modal se ferme avec une animation fluide
   - Dans la console, vous devriez voir :
     ```
     ⚡ Mise à jour optimiste détectée pour [id]
     ⚡ Mise à jour optimiste de l'intervention [id]
     🔄 Rafraîchissement en arrière-plan après mise à jour optimiste
     🔄 Cache invalidé : X entrées supprimées
     ✅ Intervention mise à jour avec succès
     ```

### 5. Vérifier la cohérence

1. Rafraîchissez la page entière (`F5`)
2. Vérifiez que les modifications sont bien persistées
3. ✅ Les données doivent correspondre exactement

## Logs attendus

### Mise à jour réussie
```
⚡ Mise à jour optimiste détectée pour 123e4567-e89b-12d3-a456-426614174000
⚡ Mise à jour optimiste de l'intervention 123e4567-e89b-12d3-a456-426614174000
🔄 Rafraîchissement en arrière-plan après mise à jour optimiste
🔄 Cache invalidé : 3 entrées supprimées
✅ Intervention mise à jour avec succès
```

### Erreur (rare)
Si vous voyez des erreurs, vérifiez :
- La connexion à la base de données Supabase
- Les permissions de l'utilisateur
- La validité des données envoyées

## Temps de réponse attendus

| Action | Temps | Description |
|--------|-------|-------------|
| Clic sur "Enregistrer" → Mise à jour visuelle | < 100ms | Mise à jour optimiste |
| Fermeture du modal | 300ms | Animation fluide |
| Rafraîchissement en arrière-plan | +500ms | Confirmation depuis l'API |
| **TOTAL perçu par l'utilisateur** | **< 100ms** | ⚡ Instantané |

## Résolution de problèmes

### La TableView ne se met pas à jour
1. Vérifiez que les logs apparaissent dans la console
2. Si aucun log `⚡ Mise à jour optimiste` :
   - L'événement n'est pas émis → vérifier `InterventionModalContent.tsx`
3. Si log `⚡` mais pas de mise à jour visuelle :
   - Le hook `useInterventions` n'écoute pas → vérifier `app/interventions/page.tsx`

### Les données sont incohérentes après mise à jour
- Le rafraîchissement en arrière-plan corrigera automatiquement après 500ms
- Si le problème persiste, vider le cache : `sessionStorage.clear()` dans la console

### Performance dégradée
- Vérifiez le nombre d'entrées en cache : 
  ```javascript
  Object.keys(sessionStorage).filter(k => k.startsWith('interventions-')).length
  ```
- Devrait être < 10. Si > 50, le nettoyage automatique ne fonctionne pas correctement.

## Comparaison Avant/Après

### Avant les modifications
```
[Enregistrer] → ... → ... → ... (1.5s) → [TableView mise à jour]
                └─ Temps d'attente visible ❌
```

### Après les modifications
```
[Enregistrer] → [TableView mise à jour immédiatement] ⚡
                └─ < 100ms, ressenti instantané ✅
```



