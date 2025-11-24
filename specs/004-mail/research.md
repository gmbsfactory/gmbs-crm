# Research: Système d'envoi d'email CRM

**Date**: 2025-01-19  
**Feature**: 004-mail  
**Status**: ✅ Complete

## Objectif

Rechercher et documenter les décisions techniques pour l'implémentation du système d'envoi d'email depuis le CRM vers les artisans.

## Décisions Techniques

### 1. Bibliothèque d'envoi d'email

**Décision**: Utiliser `nodemailer` pour l'envoi SMTP via Gmail

**Rationale**:
- Bibliothèque Node.js standard et largement utilisée
- Support natif pour SMTP avec authentification
- Gestion des pièces jointes (attachments) et images inline (CID)
- Documentation complète et communauté active
- Compatible avec Next.js API Routes

**Alternatives considérées**:
- `@sendgrid/mail` : Service payant, nécessite compte externe
- `@mailgun/mailgun-js` : Service payant, nécessite compte externe
- `resend` : Service moderne mais nécessite compte externe
- **Rejetées** car la spec exige l'utilisation de Gmail avec credentials utilisateur

**Références**:
- [Documentation nodemailer](https://nodemailer.com/about/)
- [Gmail SMTP Configuration](https://support.google.com/a/answer/176600)

---

### 2. Chiffrement des mots de passe

**Décision**: Utiliser AES-256-CBC avec Node.js `crypto` (built-in)

**Rationale**:
- Algorithme standard et sécurisé (AES-256)
- Support natif dans Node.js (pas de dépendance externe)
- Mode CBC approprié pour le chiffrement de données sensibles
- Clés et IV stockés dans variables d'environnement (jamais dans le code)

**Alternatives considérées**:
- `bcrypt` : Conçu pour les hash de mots de passe, pas pour le chiffrement réversible
- `argon2` : Conçu pour le hash, pas pour le chiffrement réversible
- Bibliothèques externes (`crypto-js`) : Inutile, Node.js a déjà `crypto`
- **Rejetées** car nécessitent un chiffrement réversible (déchiffrement nécessaire pour l'envoi SMTP)

**Implémentation**:
- Clé de chiffrement : `EMAIL_PASSWORD_ENCRYPTION_KEY` (32+ caractères)
- IV : `EMAIL_PASSWORD_ENCRYPTION_IV` (16 caractères)
- Stockage : Colonne `email_password_encrypted` dans table `users`

**Références**:
- [Node.js crypto.createCipheriv](https://nodejs.org/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv)
- [AES-256-CBC Best Practices](https://nodejs.org/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv)

---

### 3. Gestion des pièces jointes inline (logo GMBS)

**Décision**: Utiliser Content-ID (CID) avec nodemailer pour le logo inline

**Rationale**:
- Standard email pour les images inline
- Support natif dans nodemailer via `attachments` avec `cid`
- Référence dans le HTML via `cid:logoGM`
- Logo automatiquement inclus dans tous les emails (non modifiable par l'utilisateur)

**Alternatives considérées**:
- URL externe : Risque de blocage par les clients email, dépendance externe
- Base64 inline : Augmente la taille de l'email, peut être bloqué par certains clients
- **Rejetées** car le CID est la méthode standard et fiable pour les images inline

**Implémentation**:
- Logo stocké dans `public/logoGM.png`
- CID fixe : `logoGM`
- Référence dans templates HTML : `<img src="cid:logoGM" alt="GMBS Logo" />`

**Références**:
- [Nodemailer Attachments](https://nodemailer.com/message/attachments/)
- [RFC 2392: Content-ID](https://tools.ietf.org/html/rfc2392)

---

### 4. Stratégie de retry pour erreurs SMTP

**Décision**: Retry avec backoff exponentiel (3 tentatives maximum)

**Rationale**:
- Gestion des erreurs réseau temporaires (timeout, connexion perdue)
- Gestion du rate limiting Gmail (erreurs temporaires)
- Backoff exponentiel évite la surcharge du serveur SMTP
- 3 tentatives : équilibre entre fiabilité et performance

**Implémentation**:
- Tentative 1 : Immédiate
- Tentative 2 : Après 2 secondes (backoff: 2^1)
- Tentative 3 : Après 4 secondes (backoff: 2^2)
- Après 3 échecs : Log en statut 'failed' avec message d'erreur détaillé

**Alternatives considérées**:
- Retry linéaire : Moins efficace pour les erreurs réseau
- Retry fixe : Ne s'adapte pas aux erreurs temporaires
- File d'attente asynchrone : Complexité supplémentaire, non nécessaire pour v1
- **Rejetées** car le backoff exponentiel est la meilleure pratique pour les erreurs réseau

**Références**:
- [Exponential Backoff Pattern](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Gmail SMTP Rate Limits](https://support.google.com/a/answer/166852)

---

### 5. Gestion des timeouts

**Décision**: Timeout backend 60s, timeout frontend 70s

**Rationale**:
- Timeout backend 60s : Suffisant pour l'envoi SMTP + retry (3 tentatives max ~10s)
- Timeout frontend 70s : Supérieur au backend pour éviter les erreurs prématurées
- Feedback utilisateur pendant l'envoi (toast "Envoi en cours...")
- Message d'erreur clair en cas de timeout

**Alternatives considérées**:
- Timeout plus court (30s) : Risque d'échec prématuré sur connexions lentes
- Timeout plus long (120s) : Mauvaise UX, utilisateur attend trop longtemps
- **Rejetées** car 60s/70s est un équilibre optimal entre fiabilité et UX

---

### 6. Format des templates HTML

**Décision**: Templates HTML inline avec styles inline (pas de CSS externe)

**Rationale**:
- Compatibilité maximale avec les clients email (Gmail, Outlook, etc.)
- Styles inline requis par la plupart des clients email
- Pas de dépendance externe (CSS, images externes)
- Logo inline via CID (déjà décidé)

**Alternatives considérées**:
- CSS externe : Bloqué par la plupart des clients email
- Framework email (MJML, React Email) : Complexité supplémentaire, pas nécessaire pour 2 templates simples
- **Rejetées** car HTML inline est la méthode la plus fiable pour les emails

**Références**:
- [Email HTML Best Practices](https://www.campaignmonitor.com/dev-resources/guides/coding/)
- [Gmail HTML Support](https://developers.google.com/gmail/design/css)

---

### 7. Validation des données avant envoi

**Décision**: Validation stricte des champs obligatoires côté serveur

**Rationale**:
- Sécurité : Validation serveur obligatoire (validation client peut être contournée)
- Champs obligatoires : `nomClient`, `telephoneClient`, `adresseComplete`
- Champs optionnels : Valeurs par défaut explicites appliquées si manquants
- Message d'erreur clair si champs obligatoires manquants

**Alternatives considérées**:
- Validation uniquement côté client : Risque de sécurité, peut être contournée
- Envoi même avec données manquantes : Mauvaise UX, emails incomplets
- **Rejetées** car la validation serveur est une exigence de sécurité

---

### 8. Gestion du statut 'pending' dans email_logs

**Décision**: Statut 'pending' réservé pour future évolution asynchrone (non utilisé dans v1)

**Rationale**:
- v1 utilise uniquement les statuts 'sent' et 'failed'
- Statut 'pending' permettrait une file d'attente asynchrone dans le futur
- Migration future facilitée (pas besoin de modifier le schéma)
- Pas de complexité supplémentaire pour v1

**Alternatives considérées**:
- Implémenter file d'attente dès v1 : Complexité supplémentaire non nécessaire
- Supprimer le statut 'pending' : Limite les évolutions futures
- **Rejetées** car laisser 'pending' dans le schéma permet une évolution future sans migration

---

## Résumé des Décisions

| Décision | Choix | Statut |
|----------|-------|--------|
| Bibliothèque email | nodemailer | ✅ Décidé |
| Chiffrement | AES-256-CBC (Node.js crypto) | ✅ Décidé |
| Logo inline | CID avec nodemailer | ✅ Décidé |
| Retry | Backoff exponentiel (3 tentatives) | ✅ Décidé |
| Timeouts | Backend 60s, Frontend 70s | ✅ Décidé |
| Templates HTML | HTML inline avec styles inline | ✅ Décidé |
| Validation | Validation serveur stricte | ✅ Décidé |
| Statut 'pending' | Réservé pour future évolution | ✅ Décidé |

## Prochaines Étapes

1. ✅ Recherche terminée - Toutes les décisions techniques sont prises
2. → Phase 1 : Créer data-model.md, contracts/, quickstart.md
3. → Phase 2 : Créer tasks.md (via /speckit.tasks)

