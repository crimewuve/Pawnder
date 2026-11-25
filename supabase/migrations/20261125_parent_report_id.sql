-- =============================================================================
-- Migración: Relación explícita con la alerta original (parent_report_id)
-- Proyecto: Pawnder (Ionic/Angular + Supabase)
-- Fecha: 2026-11-25
--
-- Añade la columna opcional `parent_report_id` a la tabla `public.dog_reports`
-- para distinguir alertas iniciales (raíces) de publicaciones posteriores (seguimientos).
-- Las alertas originales tienen `parent_report_id IS NULL`.
-- Las publicaciones de actualización/seguimiento tienen `parent_report_id = <id de la alerta original>`.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dog_reports'
      AND column_name = 'parent_report_id'
  ) THEN
    ALTER TABLE public.dog_reports ADD COLUMN parent_report_id uuid NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.dog_reports'::regclass
      AND c.contype = 'f'
      AND a.attname = 'parent_report_id'
  ) THEN
    ALTER TABLE public.dog_reports
      ADD CONSTRAINT dog_reports_parent_report_id_fkey
      FOREIGN KEY (parent_report_id) REFERENCES public.dog_reports(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dog_reports_parent_report_id_idx ON public.dog_reports (parent_report_id);
