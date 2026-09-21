-- Enforce the aggregate invariants that protect ordered, non-empty prescription items.
ALTER TABLE "prescription_items"
  ADD CONSTRAINT "prescription_items_position_nonnegative_check"
    CHECK ("position" >= 0),
  ADD CONSTRAINT "prescription_items_medication_name_nonempty_check"
    CHECK (length(btrim("medication_name")) > 0);
