-- Migration 00082: Touch intervention.updated_at when child tables change
--
-- Purpose: When a child record (cost, payment, artisan, comment) is modified,
-- update the parent intervention's updated_at timestamp. This causes the existing
-- Realtime subscription on `interventions` to fire, propagating changes to all
-- connected clients without adding any new Realtime channels.
--
-- Tables affected:
--   intervention_costs    → FK: intervention_id
--   intervention_payments → FK: intervention_id
--   intervention_artisans → FK: intervention_id
--   comments              → polymorphic: entity_id + entity_type = 'intervention'

-- Function for child tables with direct intervention_id FK
CREATE OR REPLACE FUNCTION touch_intervention_on_child_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE interventions
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.intervention_id, OLD.intervention_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function for comments (polymorphic entity_id + entity_type)
CREATE OR REPLACE FUNCTION touch_intervention_on_comment_change()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type text;
  v_entity_id uuid;
BEGIN
  v_entity_type := COALESCE(NEW.entity_type, OLD.entity_type);
  v_entity_id := COALESCE(NEW.entity_id, OLD.entity_id);
  IF v_entity_type = 'intervention' THEN
    UPDATE interventions SET updated_at = NOW() WHERE id = v_entity_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on intervention_costs
CREATE TRIGGER trg_touch_intervention_on_cost_change
  AFTER INSERT OR UPDATE OR DELETE ON intervention_costs
  FOR EACH ROW EXECUTE FUNCTION touch_intervention_on_child_change();

-- Trigger on intervention_payments
CREATE TRIGGER trg_touch_intervention_on_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON intervention_payments
  FOR EACH ROW EXECUTE FUNCTION touch_intervention_on_child_change();

-- Trigger on intervention_artisans
CREATE TRIGGER trg_touch_intervention_on_artisan_change
  AFTER INSERT OR UPDATE OR DELETE ON intervention_artisans
  FOR EACH ROW EXECUTE FUNCTION touch_intervention_on_child_change();

-- Trigger on comments (only for intervention entities)
CREATE TRIGGER trg_touch_intervention_on_comment_change
  AFTER INSERT OR UPDATE OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION touch_intervention_on_comment_change();
