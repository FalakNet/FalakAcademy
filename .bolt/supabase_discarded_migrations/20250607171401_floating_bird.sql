/*
  # Add Superadmin User

  1. Updates
    - Update the current user's role to SUPERADMIN
    - This migration will find the first user and make them a superadmin
    - If you need to target a specific user, you can modify the WHERE clause

  2. Security
    - This is a one-time migration to bootstrap the first superadmin
    - After this, superadmins can manage other users through the UI
*/

-- Update the first user to be a superadmin (you can modify this to target a specific email if needed)
UPDATE profiles 
SET role = 'SUPERADMIN'::user_role 
WHERE id = (
  SELECT id 
  FROM profiles 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- Alternative: If you know your email, you can use this instead:
-- UPDATE profiles 
-- SET role = 'SUPERADMIN'::user_role 
-- WHERE id IN (
--   SELECT id FROM auth.users WHERE email = 'your-email@example.com'
-- );