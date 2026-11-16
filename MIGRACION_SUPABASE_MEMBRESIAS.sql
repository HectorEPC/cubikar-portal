-- ==============================================================================
-- MIGRACIÓN DE MEMBRESÍAS INDEPENDIENTES Y ECOSISTEMA (CUBIKAR)
-- Ejecutar en Supabase SQL Editor (https://supabase.com)
-- ==============================================================================

-- 1. Actualizar tabla public.empresas con acceso independiente por producto
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS acceso_arq BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_arq VARCHAR(50) DEFAULT NULL, -- 'plus', 'pro'
  ADD COLUMN IF NOT EXISTS periodo_fin_arq TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS acceso_const BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_const VARCHAR(50) DEFAULT NULL, -- 'plus', 'pro'
  ADD COLUMN IF NOT EXISTS periodo_fin_const TIMESTAMPTZ DEFAULT NULL;

-- 1.1 Trigger: proteger campos de facturación/suscripción en public.empresas
CREATE OR REPLACE FUNCTION public.protect_empresa_billing_columns()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), auth.role(), '');
    v_email TEXT := LOWER(TRIM(COALESCE(auth.jwt()->>'email', '')));
BEGIN
    IF v_role IN ('service_role', 'supabase_admin')
       OR current_user IN ('postgres', 'supabase_admin')
       OR auth.uid() IS NULL
       OR v_email = 'hepc.90@gmail.com' THEN
        RETURN NEW;
    END IF;

    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
       OR NEW.estado_suscripcion IS DISTINCT FROM OLD.estado_suscripcion
       OR NEW.periodo_fin IS DISTINCT FROM OLD.periodo_fin
       OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
       OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
       OR NEW.acceso_arq IS DISTINCT FROM OLD.acceso_arq
       OR NEW.plan_arq IS DISTINCT FROM OLD.plan_arq
       OR NEW.periodo_fin_arq IS DISTINCT FROM OLD.periodo_fin_arq
       OR NEW.acceso_const IS DISTINCT FROM OLD.acceso_const
       OR NEW.plan_const IS DISTINCT FROM OLD.plan_const
       OR NEW.periodo_fin_const IS DISTINCT FROM OLD.periodo_fin_const THEN
        RAISE EXCEPTION 'No autorizado para modificar suscripción o facturación desde cliente.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_empresa_billing ON public.empresas;
CREATE TRIGGER trg_protect_empresa_billing
    BEFORE UPDATE ON public.empresas
    FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_billing_columns();

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
