-- ==============================================================================
-- CUBIKAR SUB TEST (ACTIVACIÓN DE MODO PRUEBA EN SUPABASE)
-- Ejecutar en: Supabase SQL Editor (https://supabase.com)
-- Objetivo: Todo nuevo registro recibe automáticamente Plan Plus y acceso total
--           a Cubikar Construcción y Cubikar Arquitectura sin costo alguno.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_empresa_id UUID;
    user_name TEXT;
BEGIN
    user_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

    -- Crea empresa asignando Plan Plus gratuito por Modo Cubikar Sub Test
    INSERT INTO public.empresas (
        nombre, 
        plan, 
        estado_suscripcion, 
        acceso_arq, 
        plan_arq, 
        acceso_const, 
        plan_const
    )
    VALUES (
        user_name || ' - Empresa (Test)', 
        'plus',
        'active',
        true,
        'plus',
        true,
        'plus'
    )
    RETURNING id INTO new_empresa_id;

    -- Crea el registro de perfil
    INSERT INTO public.perfiles (id, empresa_id, nombre_completo, email, rol, avatar_url)
    VALUES (
        new.id,
        new_empresa_id,
        user_name,
        new.email,
        'owner',
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger para asegurar su activación
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Actualizar empresas de prueba existentes (opcional: eleva cuentas ya creadas a Plus)
UPDATE public.empresas
SET 
    plan = 'plus',
    estado_suscripcion = 'active',
    acceso_arq = true,
    plan_arq = 'plus',
    acceso_const = true,
    plan_const = 'plus'
WHERE plan = 'free' OR plan = 'inicial';
