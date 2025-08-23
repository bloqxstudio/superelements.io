-- Add phone column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN phone TEXT;

-- Update the handle_new_user function to save phone from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, phone)
  VALUES (
    NEW.id,
    NEW.email,
    'free',
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  );
  RETURN NEW;
END;
$$;