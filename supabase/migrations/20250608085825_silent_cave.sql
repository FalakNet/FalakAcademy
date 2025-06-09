/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Multiple overlapping policies on profiles table
    - Some policies use get_user_role(uid()) which queries profiles table
    - This creates infinite recursion when evaluating policies

  2. Solution
    - Drop all existing policies on profiles table
    - Create simple, non-recursive policies
    - Use auth.uid() directly instead of functions that query profiles

  3. New Policies
    - Users can read their own profile
    - Users can update their own profile
    - Users can insert their own profile on signup
    - Simple policy for reading all profiles (for basic functionality)
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can insert profile on signup" ON profiles;
DROP POLICY IF EXISTS "Superadmins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create simple, non-recursive policies
CREATE POLICY "Users can read their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow reading all profiles for basic app functionality
-- This is needed for course admins to see user names, etc.
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);