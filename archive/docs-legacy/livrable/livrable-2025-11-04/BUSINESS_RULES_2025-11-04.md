# 📜 Règles Métier - GMBS CRM

**Version** : 1.0  
**Date** : 5 novembre 2025  
**Source** : Spécifications produit livrable du 04/11/2025  
**Objectif** : Centraliser toutes les règles métier et conditions bloquantes du CRM

---

## 🎯 Objectif du document

Ce fichier centralise **toutes les règles métier** du GMBS CRM. Chaque règle est :
- 🔒 **Bloquante** (empêche une action) ou
- ⚙️ **Automatique** (déclenche une action automatiquement)

Ces règles doivent être implémentées dans le code et testées unitairement.

---

## 📋 Table des matières

1. [Règles : Interventions](#règles--interventions)
2. [Règles : Statuts des interventions](#règles--statuts-des-interventions)
3. [Règles : Devis & Acomptes](#règles--devis--acomptes)
4. [Règles : Artisans](#règles--artisans)
5. [Règles : Agences](#règles--agences)
6. [Règles : Archivage](#règles--archivage)
7. [Règles : Permissions & Droits](#règles--permissions--droits)
8. [Règles : Logement vacant](#règles--logement-vacant)

---

## 📦 Règles : Interventions

### BR-INT-001 : Champs obligatoires à la création
**Type** : 🔒 Bloquante  
**Référence** : INT-001

**Règle** :
À la création d'une intervention, les champs suivants sont **obligatoires** :
- ✅ **Adresse** (`adresse`)
- ✅ **Contexte** (`contexte_intervention`)
- ✅ **Métier** (`metier_id`)
- ✅ **Statut** (`statut_id`)
- ✅ **Agence** (`agence_id`)

**Condition bloquante** :
```typescript
if (!intervention.adresse || 
    !intervention.contexte_intervention || 
    !intervention.metier_id || 
    !intervention.statut_id || 
    !intervention.agence_id) {
  throw new Error('Tous les champs obligatoires doivent être renseignés');
}
```

**Implémentation** :
- Frontend : Validation React Hook Form
- Backend : Validation Zod + contraintes BDD `NOT NULL`

**Test unitaire** :
```typescript
describe('BR-INT-001', () => {
  it('should block creation without required fields', () => {
    expect(() => createIntervention({ adresse: null })).toThrow();
  });
});
```

---

### BR-INT-002 : Contexte modifiable uniquement à la création
**Type** : 🔒 Bloquante  
**Référence** : INT-003

**Règle** :
- ✅ Le champ `contexte_intervention` est **modifiable à la création**
- 🔒 Après création, il est **en lecture seule** (sauf pour les Administrateurs)

**Exception** :
- Les utilisateurs avec le rôle `admin` peuvent modifier le contexte après création

**Condition bloquante** :
```typescript
if (!isCreating && !isAdmin && hasContexteChanged) {
  throw new Error('Seuls les administrateurs peuvent modifier le contexte après création');
}
```

**Implémentation** :
- `NewInterventionModalContent.tsx` → Champ éditable
- `InterventionModalContent.tsx` → Champ en lecture seule (sauf admin)

**Test unitaire** :
```typescript
describe('BR-INT-002', () => {
  it('should allow context edit only on creation', () => {
    const user = { role: 'gestionnaire' };
    expect(canEditContext(user, false)).toBe(false);
  });
  
  it('should allow admin to edit context after creation', () => {
    const admin = { role: 'admin' };
    expect(canEditContext(admin, false)).toBe(true);
  });
});
```

---

### BR-INT-003 : Logement vacant — Champs conditionnels
**Type** : ⚙️ Automatique  
**Référence** : INT-002

**Règle** :
Si la case **"Logement vacant"** est cochée (`logement_vacant = true`) :
- ❌ **Masquer** : Client (`tenant_id`), Téléphone
- ✅ **Afficher** : Information clef, Étage, N° appartement, Contexte (renforcé)

**Champs remplacés** :
```typescript
if (logement_vacant) {
  // Nouveaux champs
  fields = ['info_clef', 'etage', 'numero_appartement', 'contexte'];
} else {
  // Champs standard
  fields = ['tenant_id', 'telephone'];
}
```

**Implémentation** :
- Logique UI conditionnelle dans `NewInterventionModalContent.tsx`

**Test unitaire** :
```typescript
describe('BR-INT-003', () => {
  it('should display vacant-specific fields when logement_vacant is true', () => {
    render(<InterventionForm logement_vacant={true} />);
    expect(screen.getByLabelText('Information clef')).toBeInTheDocument();
    expect(screen.queryByLabelText('Client')).not.toBeInTheDocument();
  });
});
```

---

## 🔄 Règles : Statuts des interventions

### BR-STAT-001 : Due date dépassée → Statut "Check" automatique
**Type** : ⚙️ Automatique  
**Référence** : DAT-001

**Règle** :
Si **toutes** les conditions suivantes sont réunies :
1. ✅ `due_date < NOW()` (date limite dépassée)
2. ✅ `statut IN ('Visite technique', 'Intervention en cours')`

**Alors** :
- ⚙️ Le statut passe **automatiquement** à `"Check"`
- 💾 Le statut précédent est sauvegardé dans `previous_statut_id`

**Condition automatique** :
```sql
-- Job cron ou Edge Function
UPDATE interventions
SET 
  previous_statut_id = statut_id,
  statut_id = (SELECT id FROM intervention_statuses WHERE code = 'check')
WHERE 
  due_date < NOW()
  AND statut_id IN (
    SELECT id FROM intervention_statuses 
    WHERE code IN ('visite_technique', 'intervention_en_cours')
  );
```

**Implémentation** :
- Job automatique quotidien (Edge Function Supabase ou `pg_cron`)
- Logs des changements de statut

**Test unitaire** :
```typescript
describe('BR-STAT-001', () => {
  it('should auto-update to Check when due_date is passed', async () => {
    const intervention = {
      due_date: new Date('2025-01-01'),
      statut: { code: 'visite_technique' }
    };
    await runDueDateCheck();
    const updated = await getIntervention(intervention.id);
    expect(updated.statut.code).toBe('check');
  });
});
```

---

### BR-STAT-002 : Retour au statut précédent via modification de date_termine
**Type** : ⚙️ Automatique  
**Référence** : DAT-001

**Règle** :
Si un dossier est en statut `"Check"` suite à une due date dépassée :
- ✅ **Modification de `date_termine`** (prolongation) → Retour automatique au `previous_statut_id`

**Condition automatique** :
```typescript
if (statut.code === 'check' && 
    hasDateTermineChanged && 
    previous_statut_id) {
  intervention.statut_id = intervention.previous_statut_id;
  intervention.previous_statut_id = null;
}
```

**Implémentation** :
- Logique dans l'API `/api/interventions/[id]/route.ts`

**Test unitaire** :
```typescript
describe('BR-STAT-002', () => {
  it('should restore previous status when date_termine is updated', async () => {
    const intervention = {
      statut: { code: 'check' },
      previous_statut_id: 'uuid-visite-technique'
    };
    await updateIntervention(intervention.id, { date_termine: '2025-12-31' });
    const updated = await getIntervention(intervention.id);
    expect(updated.statut_id).toBe('uuid-visite-technique');
  });
});
```

---

### BR-STAT-003 : Due date obligatoire pour VT & EC
**Type** : 🔒 Bloquante  
**Référence** : DAT-001

**Règle** :
Les interventions avec statut `"Visite technique"` ou `"Intervention en cours"` **DOIVENT** avoir une `due_date` renseignée.

**Condition bloquante** :
```typescript
const statusRequiringDueDate = ['visite_technique', 'intervention_en_cours'];

if (statusRequiringDueDate.includes(statut.code) && !due_date) {
  throw new Error('La date limite est obligatoire pour ce statut');
}
```

**Implémentation** :
- Validation frontend (React Hook Form)
- Validation backend (Zod)

**Test unitaire** :
```typescript
describe('BR-STAT-003', () => {
  it('should require due_date for VT status', () => {
    expect(() => 
      createIntervention({ statut: 'visite_technique', due_date: null })
    ).toThrow('due_date obligatoire');
  });
});
```

---

## 💰 Règles : Devis & Acomptes

### BR-DEVI-001 : ID devis obligatoire avant statut "Devis envoyé"
**Type** : 🔒 Bloquante  
**Référence** : DEVI-001

**Règle** :
- 🔒 Sans `id_devis` → **Impossible** de passer au statut `"Devis envoyé"`
- 🚫 L'action "Passer à Devis envoyé" est **masquée** dans le menu contextuel

**Condition bloquante** :
```typescript
if (statut.code === 'demande' && newStatut.code === 'devis_envoye' && !id_devis) {
  throw new Error('L\'ID du devis doit être renseigné avant de passer à "Devis envoyé"');
}
```

**Implémentation** :
- Validation lors du changement de statut
- Menu contextuel : masquer l'option si `!id_devis`

**Test unitaire** :
```typescript
describe('BR-DEVI-001', () => {
  it('should block transition to devis_envoye without id_devis', () => {
    expect(() => 
      updateStatus({ from: 'demande', to: 'devis_envoye', id_devis: null })
    ).toThrow();
  });
});
```

---

### BR-DEVI-002 : Pas d'automatisation "Demandé → Devis envoyé"
**Type** : ℹ️ Informatif  
**Référence** : DEVI-001

**Règle** :
La saisie de `id_devis` **NE déclenche PAS** automatiquement le passage du statut `"Demandé"` à `"Devis envoyé"`.

**Comportement** :
- ✅ L'utilisateur saisit `id_devis` → Statut reste `"Demandé"`
- ✅ L'utilisateur **doit manuellement** passer à `"Devis envoyé"` (via menu contextuel)

---

### BR-ACPT-001 : Saisie montant acompte → Statut "Attente acompte"
**Type** : ⚙️ Automatique  
**Référence** : ACPT-001

**Règle** :
Lorsqu'un utilisateur **saisit le montant d'acompte réclamé** :
- ✅ Statut actuel = `"Accepté"`
- ⚙️ Statut passe automatiquement à `"Attente acompte"`

**Condition automatique** :
```typescript
if (statut.code === 'accepte' && montant_acompte_reclame > 0) {
  intervention.statut_id = getStatusId('attente_acompte');
}
```

**Implémentation** :
- Trigger ou logique applicative dans l'API

**Test unitaire** :
```typescript
describe('BR-ACPT-001', () => {
  it('should auto-update to attente_acompte when montant is set', async () => {
    const intervention = { statut: { code: 'accepte' } };
    await updateIntervention(intervention.id, { montant_acompte_reclame: 500 });
    const updated = await getIntervention(intervention.id);
    expect(updated.statut.code).toBe('attente_acompte');
  });
});
```

---

### BR-ACPT-002 : Acompte reçu → Date de réception obligatoire
**Type** : 🔒 Bloquante  
**Référence** : ACPT-001

**Règle** :
Lorsque la case `"Acompte reçu"` est cochée (`acompte_recu = true`) :
- 🔒 Le champ `date_reception_acompte` devient **obligatoire**
- 🔒 Impossible de passer au statut `"Accepté $"` sans cette date

**Condition bloquante** :
```typescript
if (acompte_recu && !date_reception_acompte) {
  throw new Error('La date de réception de l\'acompte est obligatoire');
}

if (statut.code === 'attente_acompte' && 
    newStatut.code === 'accepte_acompte_recu' && 
    !date_reception_acompte) {
  throw new Error('Date de réception obligatoire pour passer à "Accepté $"');
}
```

**Implémentation** :
- Validation frontend + backend

**Test unitaire** :
```typescript
describe('BR-ACPT-002', () => {
  it('should require date_reception when acompte_recu is checked', () => {
    expect(() => 
      updatePayment({ acompte_recu: true, date_reception_acompte: null })
    ).toThrow();
  });
});
```

---

### BR-ACPT-003 : Date saisie → Retour automatique "Accepté $"
**Type** : ⚙️ Automatique  
**Référence** : ACPT-001

**Règle** :
Une fois la `date_reception_acompte` saisie :
- ⚙️ Le statut repasse automatiquement à `"Accepté $"` (symbole $ pour indiquer réception)

**Condition automatique** :
```typescript
if (statut.code === 'attente_acompte' && date_reception_acompte) {
  intervention.statut_id = getStatusId('accepte_acompte_recu'); // "Accepté $"
}
```

**Implémentation** :
- Logique applicative dans l'API

**Test unitaire** :
```typescript
describe('BR-ACPT-003', () => {
  it('should auto-update to accepte_$ when date is set', async () => {
    const intervention = { statut: { code: 'attente_acompte' } };
    await updateIntervention(intervention.id, { 
      acompte_recu: true, 
      date_reception_acompte: '2025-11-05' 
    });
    const updated = await getIntervention(intervention.id);
    expect(updated.statut.code).toBe('accepte_acompte_recu');
  });
});
```

---

### BR-DUP-001 : Duplication "Devis supp" — Champs exclus
**Type** : ⚙️ Automatique  
**Référence** : DUP-001

**Règle** :
L'action `"Devis supp"` duplique l'intervention **sauf** les champs suivants :
- ❌ `id` (nouveau UUID généré)
- ❌ `id_inter` (nouveau ID généré)
- ❌ `contexte_intervention`
- ❌ `consigne_intervention`

**Comportement automatique** :
- ✅ Créer un commentaire : `"Devis supp avec l'ancien ID [id_inter]"`
- ✅ Nouveau statut : `"Demandé"` (par défaut)

**Implémentation** :
```typescript
async function duplicateIntervention(originalId: string) {
  const original = await getIntervention(originalId);
  
  const duplicate = {
    ...original,
    id: generateUUID(),
    id_inter: generateNewIdInter(),
    contexte_intervention: null,
    consigne_intervention: null,
    statut_id: getStatusId('demande'),
  };
  
  await createIntervention(duplicate);
  await addComment(duplicate.id, `Devis supp avec l'ancien ID ${original.id_inter}`);
}
```

**Test unitaire** :
```typescript
describe('BR-DUP-001', () => {
  it('should exclude contexte and consigne from duplication', async () => {
    const original = { contexte_intervention: 'Test', consigne_intervention: 'Urgent' };
    const duplicate = await duplicateIntervention(original.id);
    expect(duplicate.contexte_intervention).toBeNull();
    expect(duplicate.consigne_intervention).toBeNull();
  });
});
```

---

## 👷 Règles : Artisans

### BR-ART-001 : Statut "Incomplet" + Niveau "Novice" → "À compléter"
**Type** : ⚙️ Automatique  
**Référence** : ART-002

**Règle** :
Si **toutes** les conditions suivantes sont réunies :
1. ✅ `statut_dossier = "Incomplet"`
2. ✅ `niveau` passe à `"Novice"` (changement détecté)

**Alors** :
- ⚙️ Le `statut_dossier` passe automatiquement à `"À compléter"`

**Condition automatique** :
```sql
-- Trigger PostgreSQL
CREATE OR REPLACE FUNCTION update_artisan_statut_on_niveau_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.niveau != 'Novice' AND NEW.niveau = 'Novice' THEN
    IF EXISTS (
      SELECT 1 FROM artisan_statuses 
      WHERE id = NEW.statut_id AND code = 'incomplet'
    ) THEN
      NEW.statut_id := (
        SELECT id FROM artisan_statuses WHERE code = 'a_completer' LIMIT 1
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Implémentation** :
- Trigger PostgreSQL OU logique applicative

**Test unitaire** :
```typescript
describe('BR-ART-001', () => {
  it('should auto-update statut to a_completer when niveau becomes Novice', async () => {
    const artisan = { statut: { code: 'incomplet' }, niveau: 'Potentiel' };
    await updateArtisan(artisan.id, { niveau: 'Novice' });
    const updated = await getArtisan(artisan.id);
    expect(updated.statut.code).toBe('a_completer');
  });
});
```

---

### BR-ART-002 : IBAN — Saisie gestionnaire, validation admin uniquement
**Type** : 🔒 Bloquante  
**Référence** : ART-001

**Règle** :
- ✅ **Gestionnaires** peuvent **saisir** un IBAN
- 🔒 **Seuls les Administrateurs** peuvent **valider** l'IBAN
- 🔒 Un gestionnaire ne peut pas valider un IBAN qu'il a saisi

**Condition bloquante** :
```typescript
if (action === 'validate_iban' && user.role !== 'admin') {
  throw new Error('Seuls les administrateurs peuvent valider un IBAN');
}
```

**Implémentation** :
- Workflow : Saisie → État "En attente" → Validation admin
- UI : Bouton "Valider" visible uniquement pour les admins

**Test unitaire** :
```typescript
describe('BR-ART-002', () => {
  it('should allow gestionnaire to enter IBAN', () => {
    const user = { role: 'gestionnaire' };
    expect(canEnterIBAN(user)).toBe(true);
  });
  
  it('should block gestionnaire from validating IBAN', () => {
    const user = { role: 'gestionnaire' };
    expect(() => validateIBAN(user, 'FR76...').toThrow();
  });
  
  it('should allow admin to validate IBAN', () => {
    const admin = { role: 'admin' };
    expect(canValidateIBAN(admin)).toBe(true);
  });
});
```

---

## 🏢 Règles : Agences

### BR-AGN-001 : Référence agence obligatoire pour 3 agences
**Type** : 🔒 Bloquante  
**Référence** : AGN-001

**Règle** :
Les agences suivantes **requièrent obligatoirement** une `reference_agence` :
- ✅ **ImoDirect**
- ✅ **AFEDIM**
- ✅ **Locoro**

**Condition bloquante** :
```typescript
const agenciesRequiringRef = ['ImoDirect', 'AFEDIM', 'Locoro'];

if (agenciesRequiringRef.includes(agence.name) && !reference_agence) {
  throw new Error(`La référence agence est obligatoire pour ${agence.name}`);
}
```

**Implémentation** :
- Validation conditionnelle frontend + backend
- Table de configuration `agency_config` avec colonne `requires_reference`

**Test unitaire** :
```typescript
describe('BR-AGN-001', () => {
  it('should require reference_agence for ImoDirect', () => {
    expect(() => 
      createIntervention({ agence: 'ImoDirect', reference_agence: null })
    ).toThrow();
  });
  
  it('should not require reference_agence for other agencies', () => {
    expect(() => 
      createIntervention({ agence: 'AutreAgence', reference_agence: null })
    ).not.toThrow();
  });
});
```

---

## 🗄️ Règles : Archivage

### BR-ARC-001 : Commentaire obligatoire à l'archivage
**Type** : 🔒 Bloquante  
**Référence** : ARC-001

**Règle** :
À l'archivage d'un **artisan** ou d'une **intervention terminée** :
- 🔒 Un champ `archived_reason` (commentaire) est **obligatoire**
- 🔒 Le pop-up d'archivage est **bloquant** tant que le commentaire n'est pas saisi

**Condition bloquante** :
```typescript
if (action === 'archive' && !archived_reason) {
  throw new Error('Le motif d\'archivage est obligatoire');
}
```

**Champs BDD** :
- `archived_at` : timestamptz
- `archived_by` : uuid (user)
- `archived_reason` : text (obligatoire)
- `comments.reason_type` : text (`archive` | `done`) pour tracer l'origine du commentaire obligatoire

**Implémentation** :
- Pop-up modal avec textarea obligatoire
- Validation frontend + backend
- Insertion via `commentsApi.create` avec `reason_type` pour afficher un badge `archivage`/`terminé` dans `CommentSection`

**Test unitaire** :
```typescript
describe('BR-ARC-001', () => {
  it('should block archiving without reason', () => {
    expect(() => 
      archiveArtisan({ id: 'uuid', archived_reason: null })
    ).toThrow();
  });
  
  it('should allow archiving with reason', () => {
    expect(() => 
      archiveArtisan({ id: 'uuid', archived_reason: 'Ne répond plus' })
    ).not.toThrow();
  });
});
```

---

### BR-ARC-002 : Artisans archivés invisibles sur la carte
**Type** : ⚙️ Automatique  
**Référence** : ARC-002

**Règle** :
- ✅ **Artisans indisponibles** : Affichés avec pastille "Indisponible"
- ❌ **Artisans archivés** : **N'apparaissent PAS** sur la carte
- ℹ️ Un artisan archivé **conserve** son statut de compétence (Novice, Confirmé, etc.)

**Condition automatique** :
```typescript
// Requête de la carte
const artisans = await getArtisans({
  where: {
    is_active: true, // Exclut les archivés
  }
});
```

**Implémentation** :
- Filtre `is_active = true` sur la carte
- Affichage de la pastille "Indisponible" pour les `disponible = false`

---

## 🔐 Règles : Permissions & Droits

### BR-PERM-001 : "Je gère" — Attribution automatique
**Type** : ⚙️ Automatique  
**Référence** : UI-001

**Règle** :
L'action **"Je gère"** (dans le menu contextuel Market / Carte) :
- ⚙️ Attribue automatiquement le dossier à l'utilisateur ayant déclenché l'action
- ⚙️ Met à jour le champ `assigned_user_id`

**Condition automatique** :
```typescript
if (action === 'je_gere') {
  intervention.assigned_user_id = currentUser.id;
}
```

**Implémentation** :
- Bouton dans le menu contextuel
- API `/api/interventions/[id]/assign`

---

## 🏠 Règles : Logement vacant

Voir **BR-INT-003** ci-dessus.

---

## 🧪 Matrice de tests

| Règle | Type | Frontend | Backend | E2E | Priorité |
|-------|------|----------|---------|-----|----------|
| BR-INT-001 | Bloquante | ✅ | ✅ | ✅ | 🔴 Haute |
| BR-INT-002 | Bloquante | ✅ | ✅ | ⚠️ | 🟡 Moyenne |
| BR-INT-003 | UI | ✅ | ❌ | ✅ | 🟢 Faible |
| BR-STAT-001 | Auto | ❌ | ✅ | ✅ | 🔴 Haute |
| BR-STAT-002 | Auto | ❌ | ✅ | ✅ | 🔴 Haute |
| BR-STAT-003 | Bloquante | ✅ | ✅ | ✅ | 🔴 Haute |
| BR-DEVI-001 | Bloquante | ✅ | ✅ | ✅ | 🔴 Haute |
| BR-DEVI-002 | Info | ❌ | ❌ | ⚠️ | 🟢 Faible |
| BR-ACPT-001 | Auto | ❌ | ✅ | ✅ | 🔴 Haute |
| BR-ACPT-002 | Bloquante | ✅ | ✅ | ✅ | 🔴 Haute |
| BR-ACPT-003 | Auto | ❌ | ✅ | ✅ | 🔴 Haute |
| BR-DUP-001 | Auto | ❌ | ✅ | ✅ | 🟡 Moyenne |
| BR-ART-001 | Auto | ❌ | ✅ | ✅ | 🟡 Moyenne |
| BR-ART-002 | Bloquante | ✅ | ✅ | ⚠️ | 🔴 Haute |
| BR-AGN-001 | Bloquante | ✅ | ✅ | ✅ | 🔴 Haute |
| BR-ARC-001 | Bloquante | ✅ | ✅ | ✅ | 🟡 Moyenne |
| BR-ARC-002 | UI | ✅ | ❌ | ⚠️ | 🟢 Faible |
| BR-PERM-001 | Auto | ✅ | ✅ | ⚠️ | 🟡 Moyenne |

---

## 📝 Conventions de nommage

### Format des identifiants de règles :
```
BR-[DOMAINE]-[NUMERO]
```

**Exemples** :
- `BR-INT-001` : Business Rule - Interventions - 001
- `BR-STAT-002` : Business Rule - Statuts - 002
- `BR-ART-001` : Business Rule - Artisans - 001

### Types de règles :
- 🔒 **Bloquante** : Empêche une action
- ⚙️ **Automatique** : Déclenche une action automatiquement
- ℹ️ **Informatif** : Clarification sans logique technique

---

## 🔗 Liens utiles
- [Analyse de classification des tâches](/docs/ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md)
- [Spécifications HTML source](/livrable-specs-interventions-artisans_2025-11-04.html)
- [Tests unitaires](/tests/unit/)

---

**Dernière mise à jour** : 5 novembre 2025  
**Maintenu par** : Équipe Dev GMBS CRM  
**Version** : 1.0
