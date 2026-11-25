-- =============================================================================
-- Migración: funcionalidades sociales
-- Proyecto: Pawnder (Ionic/Angular + Supabase)
-- Fecha: 2026-11-23
--
-- Se puede ejecutar varias veces: todos los objetos se crean con IF NOT EXISTS
-- o se reemplazan con DROP POLICY IF EXISTS. No incluye datos de prueba,
-- no borra tablas, no elimina columnas y no modifica columnas existentes.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) Perfiles: añadir avatar_url y bio (solo si no existen)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN bio text;
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 2) Comentarios: soporte de respuestas de varios niveles (parent_id)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'report_comments'
      AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.report_comments
      ADD COLUMN parent_id uuid NULL
      REFERENCES public.report_comments(id) ON DELETE CASCADE;
  END IF;

  -- Si la columna ya existía de una ejecución anterior sin la FK, la añadimos.
  -- Esto no modifica la columna, solo garantiza la relación.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.report_comments'::regclass
      AND c.contype = 'f'
      AND a.attname = 'parent_id'
  ) THEN
    ALTER TABLE public.report_comments
      ADD CONSTRAINT report_comments_parent_id_fkey
      FOREIGN KEY (parent_id)
      REFERENCES public.report_comments(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Índice para consultar rápido las respuestas de un comentario.
CREATE INDEX IF NOT EXISTS report_comments_parent_id_idx
  ON public.report_comments (parent_id);


-- -----------------------------------------------------------------------------
-- 3) Tabla de fotos múltiples por reporte
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dog_report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.dog_reports(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  photo_path text,
  position integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dog_report_photos IS
  'Fotos asociadas a un reporte; admite varias fotos y una principal por reporte.';

-- Orden de las fotos dentro de un reporte.
CREATE INDEX IF NOT EXISTS dog_report_photos_report_id_position_idx
  ON public.dog_report_photos (report_id, position);

-- Como máximo una foto principal por reporte.
CREATE UNIQUE INDEX IF NOT EXISTS dog_report_photos_one_primary_per_report_idx
  ON public.dog_report_photos (report_id)
  WHERE is_primary;


-- -----------------------------------------------------------------------------
-- 4) Backfill: pasar la foto existente de dog_reports como foto principal
--    Solo se inserta si ese reporte todavía no tiene filas en dog_report_photos.
-- -----------------------------------------------------------------------------
INSERT INTO public.dog_report_photos
  (report_id, photo_url, photo_path, position, is_primary)
SELECT
  dr.id,
  dr.photo_url,
  dr.photo_path,
  0,
  true
FROM public.dog_reports AS dr
WHERE dr.photo_url IS NOT NULL
  AND btrim(dr.photo_url) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.dog_report_photos AS p
    WHERE p.report_id = dr.id
  );


-- -----------------------------------------------------------------------------
-- 5) Storage: bucket público 'avatars' y políticas por carpeta de usuario
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;  -- Si ya existía, nos aseguramos de que siga público.

-- Supabase ya trae RLS habilitado en storage.objects; repetirlo es inofensivo.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Lectura pública de los avatares.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Subir archivos solo dentro de la carpeta con el uid del usuario.
DROP POLICY IF EXISTS "avatars_insert_own_folder" ON storage.objects;
CREATE POLICY "avatars_insert_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Actualizar solo archivos propios (se valida la fila antigua y la nueva).
DROP POLICY IF EXISTS "avatars_update_own_folder" ON storage.objects;
CREATE POLICY "avatars_update_own_folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Borrar solo archivos propios.
DROP POLICY IF EXISTS "avatars_delete_own_folder" ON storage.objects;
CREATE POLICY "avatars_delete_own_folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- -----------------------------------------------------------------------------
-- 6) RLS de las tablas de la aplicación
--    Las políticas RESTRICTIVE se añaden como salvaguarda: así, aunque existan
--    otras políticas permisivas, ninguna puede ampliar el acceso a filas ajenas.
-- -----------------------------------------------------------------------------

-- 6.1) profiles: UPDATE solo del propio usuario (USING + WITH CHECK).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_owner_guard" ON public.profiles;
CREATE POLICY "profiles_update_owner_guard"
  ON public.profiles AS RESTRICTIVE FOR UPDATE
  TO public
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- 6.2) dog_reports: UPDATE y DELETE solo del autor del reporte.
ALTER TABLE public.dog_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dog_reports_update_own" ON public.dog_reports;
CREATE POLICY "dog_reports_update_own"
  ON public.dog_reports AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dog_reports_delete_own" ON public.dog_reports;
CREATE POLICY "dog_reports_delete_own"
  ON public.dog_reports AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "dog_reports_update_owner_guard" ON public.dog_reports;
CREATE POLICY "dog_reports_update_owner_guard"
  ON public.dog_reports AS RESTRICTIVE FOR UPDATE
  TO public
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dog_reports_delete_owner_guard" ON public.dog_reports;
CREATE POLICY "dog_reports_delete_owner_guard"
  ON public.dog_reports AS RESTRICTIVE FOR DELETE
  TO public
  USING (user_id = auth.uid());


-- 6.3) dog_report_photos: SELECT público (las fotos ya son públicas en Storage);
--      INSERT/UPDATE/DELETE solo si el reporte existe y es del usuario actual.
ALTER TABLE public.dog_report_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dog_report_photos_select_authenticated" ON public.dog_report_photos;
DROP POLICY IF EXISTS "dog_report_photos_select_public" ON public.dog_report_photos;
CREATE POLICY "dog_report_photos_select_public"
  ON public.dog_report_photos AS PERMISSIVE FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "dog_report_photos_insert_owner" ON public.dog_report_photos;
CREATE POLICY "dog_report_photos_insert_owner"
  ON public.dog_report_photos AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "dog_report_photos_update_owner" ON public.dog_report_photos;
CREATE POLICY "dog_report_photos_update_owner"
  ON public.dog_report_photos AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "dog_report_photos_delete_owner" ON public.dog_report_photos;
CREATE POLICY "dog_report_photos_delete_owner"
  ON public.dog_report_photos AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  );

-- Salvaguardas restrictivas de escritura para fotos.
DROP POLICY IF EXISTS "dog_report_photos_insert_owner_guard" ON public.dog_report_photos;
CREATE POLICY "dog_report_photos_insert_owner_guard"
  ON public.dog_report_photos AS RESTRICTIVE FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "dog_report_photos_update_owner_guard" ON public.dog_report_photos;
CREATE POLICY "dog_report_photos_update_owner_guard"
  ON public.dog_report_photos AS RESTRICTIVE FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "dog_report_photos_delete_owner_guard" ON public.dog_report_photos;
CREATE POLICY "dog_report_photos_delete_owner_guard"
  ON public.dog_report_photos AS RESTRICTIVE FOR DELETE
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  );


-- 6.4) report_comments: DELETE solo del autor.
--      No se tocan las políticas existentes de INSERT ni de SELECT.
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;

-- El autor puede borrar sus comentarios; el autor del reporte puede borrar
-- los comentarios al eliminar su publicación (necesario para el ON DELETE CASCADE).
DROP POLICY IF EXISTS "report_comments_delete_own" ON public.report_comments;
CREATE POLICY "report_comments_delete_own"
  ON public.report_comments AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "report_comments_delete_owner_guard" ON public.report_comments;
CREATE POLICY "report_comments_delete_owner_guard"
  ON public.report_comments AS RESTRICTIVE FOR DELETE
  TO public
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.dog_reports AS dr
      WHERE dr.id = report_id
        AND dr.user_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 7) Realtime: añadir dog_report_photos a supabase_realtime si no está ya
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dog_report_photos'
  )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dog_report_photos;
  END IF;
END $$;


-- Fin de la migración.
