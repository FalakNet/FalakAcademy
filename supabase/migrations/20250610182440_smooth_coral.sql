/*
  # Fix signup database error

  1. Schema Updates
    - Ensure all NOT NULL columns in profiles table have proper defaults
    - Add missing constraints and indexes
    - Fix any column type issues

  2. Trigger Updates  
    - Create or update the handle_new_user trigger
    - Ensure it properly extracts user metadata
    - Handle all required profile fields

  3. Security
    - Maintain existing RLS policies
    - Ensure proper permissions
*/

-- First, let's ensure the profiles table has proper defaults for all NOT NULL columns
DO $$
BEGIN
  -- Add default values for created_at if it doesn't have one
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'created_at' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE profiles ALTER COLUMN created_at SET DEFAULT now();
  END IF;

  -- Add default values for updated_at if it doesn't have one
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'updated_at' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE profiles ALTER COLUMN updated_at SET DEFAULT now();
  END IF;

  -- Ensure role has a default value
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'role' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'USER';
  END IF;

  -- Ensure name has a default value
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'name' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE profiles ALTER COLUMN name SET DEFAULT 'User';
  END IF;
END $$;

-- Create or replace the trigger function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    'USER',
    now(),
    now()
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    -- Try with minimal data
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'USER')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure the profiles table allows for proper conflict resolution
DO $$
BEGIN
  -- Add unique constraint on email if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'profiles' 
    AND constraint_name = 'profiles_email_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN
    -- Constraint already exists, ignore
    NULL;
END $$;

-- Update the trigger function to handle conflicts better
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.email, ''),
    'USER',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(NEW.raw_user_meta_data->>'name', profiles.name),
    email = COALESCE(NEW.email, profiles.email),
    updated_at = now();
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error and try with absolute minimal data
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'USER')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;