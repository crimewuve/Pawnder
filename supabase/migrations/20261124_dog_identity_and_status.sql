-- =============================================================================
-- Migración: identidad explícita de perros + estado solo del autor
-- Proyecto: Pawnder (Ionic/Angular + Supabase)
-- Fecha: 2026-11-24
--
-- Ejecutar DESPUÉS de 20261123_social_features.sql.
-- Es idempotente: no borra tablas, columnas ni datos.
-- Los reportes antiguos quedan sin perro asignado (dog_id = NULL): nunca se
-- agrupan automáticamente por coordenadas, fotos ni texto.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) Entidad explícita "dogs"
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  breed text,
  size text,
  photo_url text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dogs IS
  'Identidad de un perro creada explícitamente por un usuario. Nunca se infiere de fotos ni GPS.';

CREATE INDEX IF NOT EXISTS dogs_name_idx ON public.dogs (lower(name));
CREATE INDEX IF NOT EXISTS dogs_breed_idx ON public.dogs (lower(breed));


-- -----------------------------------------------------------------------------
-- 2) Relación opcional de cada reporte con un perro conocido
--    un perro puede tener muchos reportes independientes de autores distintos.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dog_reports'
      AND column_name = 'dog_id'
  ) THEN
    ALTER TABLE public.dog_reports ADD COLUMN dog_id uuid NULL;
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
      AND a.attname = 'dog_id'
  ) THEN
    ALTER TABLE public.dog_reports
      ADD CONSTRAINT dog_reports_dog_id_fkey
      FOREIGN KEY (dog_id) REFERENCES public.dogs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dog_reports_dog_id_idx ON public.dog_reports (dog_id);


-- -----------------------------------------------------------------------------
-- 3) RLS de dogs: lectura pública, escritura solo del creador
-- -----------------------------------------------------------------------------
ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dogs_select_public" ON public.dogs;
CREATE POLICY "dogs_select_public"
  ON public.dogs AS PERMISSIVE FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "dogs_insert_own" ON public.dogs;
CREATE POLICY "dogs_insert_own"
  ON public.dogs AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "dogs_update_own" ON public.dogs;
CREATE POLICY "dogs_update_own"
  ON public.dogs AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "dogs_delete_own" ON public.dogs;
CREATE POLICY "dogs_delete_own"
  ON public.dogs AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Salvaguardas: aunque aparezca otra política permisiva, nadie escribe perros ajenos.
DROP POLICY IF EXISTS "dogs_insert_owner_guard" ON public.dogs;
CREATE POLICY "dogs_insert_owner_guard"
  ON public.dogs AS RESTRICTIVE FOR INSERT
  TO public
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "dogs_update_owner_guard" ON public.dogs;
CREATE POLICY "dogs_update_owner_guard"
  ON public.dogs AS RESTRICTIVE FOR UPDATE
  TO public
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "dogs_delete_owner_guard" ON public.dogs;
CREATE POLICY "dogs_delete_owner_guard"
  ON public.dogs AS RESTRICTIVE FOR DELETE
  TO public
  USING (created_by = auth.uid());


-- -----------------------------------------------------------------------------
-- 4) report_status: solo el autor del reporte puede cambiarlo
--    (además de las políticas restrictivas de UPDATE ya existentes).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dog_reports_status_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'No puedes cambiar el autor del reporte.' USING ERRCODE = '42501';
  END IF;

  IF NEW.report_status IS DISTINCT FROM OLD.report_status THEN
    IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Solo el autor puede cambiar el estado del reporte.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dog_reports_status_owner_guard ON public.dog_reports;
CREATE TRIGGER dog_reports_status_owner_guard
  BEFORE UPDATE OF report_status, user_id ON public.dog_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.dog_reports_status_owner_guard();


-- -----------------------------------------------------------------------------
-- 5) Realtime: publicar dogs para que el mapa reaccione a nuevas identidades
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dogs'
  )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dogs;
  END IF;
END $$;


-- Fin de la migración.
