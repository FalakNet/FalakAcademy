/*
  # Deploy delete-user Edge Function

  This migration deploys the delete-user Edge Function to handle user deletion
  by superadmins. The function provides secure user deletion with proper
  authorization checks.

  1. Function Features
     - Validates superadmin permissions
     - Prevents self-deletion
     - Uses service role for admin operations
     - Proper CORS handling

  2. Security
     - Requires valid JWT token
     - Verifies SUPERADMIN role
     - Prevents users from deleting themselves
*/

-- Note: Edge Functions are typically deployed via CLI, but this migration
-- documents the function deployment requirement.
-- The actual function code is in supabase/functions/delete-user/index.ts

-- Create a record to track function deployment status
CREATE TABLE IF NOT EXISTS edge_function_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL UNIQUE,
  deployed_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending'
);

-- Insert deployment record for delete-user function
INSERT INTO edge_function_deployments (function_name, status)
VALUES ('delete-user', 'required')
ON CONFLICT (function_name) DO NOTHING;

-- Enable RLS on the deployment tracking table
ALTER TABLE edge_function_deployments ENABLE ROW LEVEL SECURITY;

-- Allow superadmins to read deployment status
CREATE POLICY "Superadmins can read function deployments"
  ON edge_function_deployments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'SUPERADMIN'
    )
  );