-- =====================================================================
-- 99085_portal_payment_states.sql  (lot L6)
-- Les cinq etats de paiement d'un artisan sur une intervention.
--
-- POURQUOI CETTE MIGRATION. La 99078 avait pose quatre valeurs
-- (not_applicable, awaiting_invoice, in_progress, paid). Le suivi reel de la
-- comptabilite en demande deux de plus, et ces deux-la ne sont pas des nuances
-- de presentation :
--   - invoice_received : la facture de l'artisan est arrivee mais n'est pas
--     encore programmee au paiement. Sans cet etat, « en attente de votre
--     facture » reste affiche a un artisan qui a DEJA envoye sa facture — et il
--     rappelle le gestionnaire, ce qui est exactement le coup de telephone que
--     le portail doit supprimer ;
--   - disputed : un litige gele le paiement. Le ranger dans « paiement en
--     cours » serait un mensonge, et le laisser en « en attente de facture »
--     ferait redeposer la facture.
--
-- « Programme » n'ajoute pas un cinquieme code : c'est in_progress, dont le
-- libelle artisan (« Paiement en cours ») est fixe par la specification §6.3 et
-- deja livre. Renommer un libelle en production pour un synonyme n'a aucune
-- valeur pour l'artisan.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS : elle ne touche NI intervention_payments
-- NI acompte_sst. is_received y designe un encaissement CLIENT ; deriver le
-- paiement de l'artisan de cette colonne afficherait « paye » a un artisan
-- parce que le client a regle GMBS.
--
-- IDEMPOTENTE : DROP CONSTRAINT IF EXISTS puis ADD, sous le meme nom que celui
-- genere par le CHECK en ligne de la 99078.
-- =====================================================================

ALTER TABLE public.intervention_artisans
  DROP CONSTRAINT IF EXISTS intervention_artisans_payment_status_check;

ALTER TABLE public.intervention_artisans
  ADD  CONSTRAINT intervention_artisans_payment_status_check
  CHECK (payment_status IN (
    'not_applicable',    -- rien a afficher a l'artisan (defaut)
    'awaiting_invoice',  -- « En attente de votre facture »
    'invoice_received',  -- « Facture recue »
    'in_progress',       -- « Paiement en cours » (= programme)
    'paid',              -- « Paye le JJ/MM » — paid_at obligatoire (garde applicative)
    'disputed'           -- « En litige »
  ));

COMMENT ON COLUMN public.intervention_artisans.payment_status IS
  'Statut de paiement de CET artisan sur cette intervention, SAISI par le gestionnaire depuis la '
  'page Comptabilite. Six valeurs (99085). JAMAIS derive d''intervention_payments.is_received : '
  'c''est un encaissement CLIENT, et acompte_sst n''a pas d''artisan_order (donc faux des qu''une '
  'intervention porte deux artisans). Les libelles montres a l''artisan vivent dans le module pur '
  'src/lib/interventions/payment-status.ts, cote CRM uniquement.';

-- L'index partiel de la 99078 (WHERE payment_status <> 'not_applicable') reste valide :
-- son predicat ne cite aucune des valeurs ajoutees.
