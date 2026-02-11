-- Add notes column to workout_sets for per-set observations
ALTER TABLE public.workout_sets ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;