-- ==============================================================================
-- CUBIKAR SUB ORIGINAL (RESTAURACIÓN AL MODO COMERCIAL OFICIAL EN SUPABASE)
-- Ejecutar en: Supabase SQL Editor (https://supabase.com)
-- Objetivo: Vuelve a asignar el Plan Inicial ('free') a nuevos registros
--           y restablece la lógica comercial estándar.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_empresa_id UUID;
    user_name TEXT;
BEGIN
    user_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

    -- Crea empresa asignando Plan Inicial estándar
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
        user_name || ' - Empresa', 
        'free', 
        'trialing',
        false,
        NULL,
        false,
        NULL
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

-- Recrear el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
