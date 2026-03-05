-- Add weekly_order column to workouts for user-defined rotation sequence
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS weekly_order integer DEFAULT NULL;
