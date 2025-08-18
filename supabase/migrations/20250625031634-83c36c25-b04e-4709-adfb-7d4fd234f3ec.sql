
-- First, let's check the current structure and fix the profiles table
-- The profiles table doesn't have a role column yet, so we need to add it properly

-- Create the app_role enum (this should work)
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('free', 'pro', 'admin');

-- Add the role column to profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role DEFAULT 'free';

-- Update existing records to have the 'free' role (since they were 'pro_user' before)
UPDATE public.profiles SET role = 'free' WHERE role IS NULL;

-- Make the role column NOT NULL
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

-- Update the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'free'  -- Default role for new users is now 'free'
  );
  RETURN NEW;
END;
$$;

-- Update the get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Add access_level field to connections table
ALTER TABLE public.connections ADD COLUMN IF NOT EXISTS access_level public.app_role DEFAULT 'free';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connections_access_level ON public.connections(access_level);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
