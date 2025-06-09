/*
  # Fix User Deletion RLS Policies

  1. Problem
    - Superadmins cannot delete user profiles due to missing RLS policy
    - DELETE operations appear to succeed but are silently blocked by RLS
    - This causes the "profile still exists after deletion" error

  2. Solution
    - Add explicit DELETE policy for superadmins on profiles table
    - Allow superadmins to delete any user profile except their own
    - Maintain security by restricting to superadmin role only

  3. Security
    - Only SUPERADMIN role can delete profiles
    - Users cannot delete their own profiles (prevents accidental self-deletion)
    - Regular users and course admins cannot delete profiles
*/

-- Add DELETE policy for superadmins on profiles table
CREATE POLICY "Superadmins can delete user profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    -- Only superadmins can delete profiles
    EXISTS (
      SELECT 1 FROM profiles current_user_profile
      WHERE current_user_profile.id = auth.uid()
      AND current_user_profile.role = 'SUPERADMIN'
    )
    -- Prevent users from deleting their own profile
    AND profiles.id != auth.uid()
  );