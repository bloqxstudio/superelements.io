-- Drop the overly permissive policy
DROP POLICY "Allow email verification for auth flow" ON public.profiles;

-- Create a function to safely check email existence
CREATE OR REPLACE FUNCTION public.email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = check_email
  );
$$;

-- Grant execute permission to anonymous users for the function
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon;