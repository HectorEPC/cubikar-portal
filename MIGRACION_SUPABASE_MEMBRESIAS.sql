-- ==============================================================================
-- MIGRACIÓN DE MEMBRESÍAS INDEPENDIENTES Y ECOSISTEMA (CUBIKAR)
-- Ejecutar en Supabase SQL Editor (https://supabase.com)
-- ==============================================================================

-- 1. Actualizar tabla public.empresas con acceso independiente por producto
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS acceso_arq BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_arq VARCHAR(50) DEFAULT NULL, -- 'plus', 'pro'
  ADD COLUMN IF NOT EXISTS periodo_fin_arq TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS acceso_const BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_const VARCHAR(50) DEFAULT NULL, -- 'plus', 'pro'
  ADD COLUMN IF NOT EXISTS periodo_fin_const TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.empresas.acceso_arq IS 'Indica si la empresa tiene activa la membresía de Cubikar Arquitectura';
COMMENT ON COLUMN public.empresas.acceso_const IS 'Indica si la empresa tiene activa la membresía de Cubikar Construcción';

-- 2. Asignar acceso de prueba por defecto a las empresas existentes (opcional)
-- UPDATE public.empresas SET acceso_arq = true, plan_arq = 'plus', acceso_const = true, plan_const = 'plus' WHERE plan IN ('plus', 'pro');

-- 3. Crear Storage Bucket para respaldos y archivos si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('cubikar-archivos', 'cubikar-archivos', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Política de almacenamiento privado (solo el usuario puede ver su carpeta)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Usuarios acceden únicamente a su carpeta de Cubikar'
  ) THEN
    CREATE POLICY "Usuarios acceden únicamente a su carpeta de Cubikar"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'cubikar-archivos' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'cubikar-archivos' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
