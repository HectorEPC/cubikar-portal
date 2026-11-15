-- ==============================================================================
-- CREACIÓN DE USUARIOS PARA TUTORIALES (CUBIKAR)
-- Ejecutar en: Supabase SQL Editor (https://supabase.com)
-- 
-- Cuentas creadas:
-- 1. tutorial.arq@cubikar.app   / Contraseña: Cubikar2026! (Plan Plus)
-- 2. tutorial.const@cubikar.app / Contraseña: Cubikar2026! (Plan Plus)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. USUARIO TUTORIAL ARQUITECTURA: tutorial.arq@cubikar.app
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_uid UUID := '11111111-1111-4111-a111-111111111111';
  v_empresa_id UUID := '11111111-1111-4111-a111-111111111112';
  v_email TEXT := 'tutorial.arq@cubikar.app';
  v_pass TEXT := 'Cubikar2026!';
BEGIN
  -- Insertar o actualizar en auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-4000-a000-000000000000',
    v_uid,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_pass, gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Arq. Demo Tutorial","empresa_nombre":"Estudio de Arquitectura Demo","plan":"plus","subscription":{"planId":"plus","billingCycle":"monthly"}}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt(v_pass, gen_salt('bf')),
    email_confirmed_at = now(),
    raw_user_meta_data = '{"full_name":"Arq. Demo Tutorial","empresa_nombre":"Estudio de Arquitectura Demo","plan":"plus","subscription":{"planId":"plus","billingCycle":"monthly"}}'::jsonb;

  -- Insertar identidad en auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_uid,
    v_uid,
    jsonb_build_object('sub', v_uid, 'email', v_email),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, id) DO NOTHING;

  -- Insertar empresa limpia con Plan Plus
  INSERT INTO public.empresas (
    id,
    nombre,
    plan,
    estado_suscripcion,
    acceso_arq,
    plan_arq,
    acceso_const,
    plan_const
  ) VALUES (
    v_empresa_id,
    'Estudio de Arquitectura Demo',
    'plus',
    'active',
    true,
    'plus',
    true,
    'plus'
  )
  ON CONFLICT (id) DO UPDATE SET
    plan = 'plus',
    estado_suscripcion = 'active',
    acceso_arq = true,
    plan_arq = 'plus',
    acceso_const = true,
    plan_const = 'plus';

  -- Insertar perfil
  INSERT INTO public.perfiles (
    id,
    empresa_id,
    nombre_completo,
    email,
    rol
  ) VALUES (
    v_uid,
    v_empresa_id,
    'Arq. Demo Tutorial',
    v_email,
    'owner'
  )
  ON CONFLICT (id) DO UPDATE SET
    empresa_id = v_empresa_id,
    nombre_completo = 'Arq. Demo Tutorial',
    rol = 'owner';
END $$;

-- ------------------------------------------------------------------------------
-- 2. USUARIO TUTORIAL CONSTRUCCIÓN: tutorial.const@cubikar.app
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_uid UUID := '22222222-2222-4222-a222-222222222221';
  v_empresa_id UUID := '22222222-2222-4222-a222-222222222222';
  v_email TEXT := 'tutorial.const@cubikar.app';
  v_pass TEXT := 'Cubikar2026!';
BEGIN
  -- Insertar o actualizar en auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-4000-a000-000000000000',
    v_uid,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_pass, gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ing. Demo Tutorial","empresa_nombre":"Constructora Modelo Demo","plan":"plus","subscription":{"planId":"plus","billingCycle":"monthly"}}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = crypt(v_pass, gen_salt('bf')),
    email_confirmed_at = now(),
    raw_user_meta_data = '{"full_name":"Ing. Demo Tutorial","empresa_nombre":"Constructora Modelo Demo","plan":"plus","subscription":{"planId":"plus","billingCycle":"monthly"}}'::jsonb;

  -- Insertar identidad en auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_uid,
    v_uid,
    jsonb_build_object('sub', v_uid, 'email', v_email),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, id) DO NOTHING;

  -- Insertar empresa limpia con Plan Plus
  INSERT INTO public.empresas (
    id,
    nombre,
    plan,
    estado_suscripcion,
    acceso_arq,
    plan_arq,
    acceso_const,
    plan_const
  ) VALUES (
    v_empresa_id,
    'Constructora Modelo Demo',
    'plus',
    'active',
    true,
    'plus',
    true,
    'plus'
  )
  ON CONFLICT (id) DO UPDATE SET
    plan = 'plus',
    estado_suscripcion = 'active',
    acceso_arq = true,
    plan_arq = 'plus',
    acceso_const = true,
    plan_const = 'plus';

  -- Insertar perfil
  INSERT INTO public.perfiles (
    id,
    empresa_id,
    nombre_completo,
    email,
    rol
  ) VALUES (
    v_uid,
    v_empresa_id,
    'Ing. Demo Tutorial',
    v_email,
    'owner'
  )
  ON CONFLICT (id) DO UPDATE SET
    empresa_id = v_empresa_id,
    nombre_completo = 'Ing. Demo Tutorial',
    rol = 'owner';
END $$;
