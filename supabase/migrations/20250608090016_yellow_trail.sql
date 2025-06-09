/*
  # Fix Profile Emails

  1. Updates
    - Update existing profiles with email addresses from auth.users
    - Ensure all profiles have proper email addresses
  
  2. Security
    - Uses secure function to access auth.users table
    - Maintains existing RLS policies
*/

-- Create a function to safely update profile emails from auth.users
CREATE OR REPLACE FUNCTION update_profile_emails()
RETURNS void AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Loop through all auth users and update corresponding profiles
  FOR user_record IN 
    SELECT id, email FROM auth.users WHERE email IS NOT NULL
  LOOP
    UPDATE public.profiles 
    SET email = user_record.email, updated_at = now()
    WHERE id = user_record.id AND (email IS NULL OR email != user_record.email);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to update existing profiles
SELECT update_profile_emails();

-- Drop the function as it's no longer needed
DROP FUNCTION update_profile_emails();

-- Ensure the trigger functions are properly set up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'), 
    NEW.email, 
    'USER'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = NEW.email,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to handle email updates
CREATE OR REPLACE FUNCTION handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if email actually changed
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.profiles
    SET email = NEW.email, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger for email updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_user_email_update();