-- Expand store categories constraint
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_category_check;
