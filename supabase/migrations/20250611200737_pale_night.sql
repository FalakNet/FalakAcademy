/*
  # Add user consents table

  1. New Tables
    - `user_consents` - Tracks user acceptance of terms and privacy policy
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `terms_accepted_at` (timestamp)
      - `privacy_accepted_at` (timestamp)
      - `terms_version` (text)
      - `privacy_version` (text)
      - `created_at` (timestamp)
      - `ip_address` (text)
      - `user_agent` (text)

  2. Security
    - Enable RLS on `user_consents` table
    - Add policies for authenticated users to read their own consents
    - Add policies for service role to insert consents
*/

-- Create user_consents table
CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  terms_accepted_at timestamptz DEFAULT now(),
  privacy_accepted_at timestamptz DEFAULT now(),
  terms_version text DEFAULT '1.0',
  privacy_version text DEFAULT '1.0',
  created_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE(user_id, terms_version, privacy_version)
);

-- Enable Row Level Security
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read their own consents"
  ON user_consents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert consents"
  ON user_consents
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can insert their own consents"
  ON user_consents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Add function to automatically record consent on signup
CREATE OR REPLACE FUNCTION record_user_consent()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_consents (
    user_id,
    terms_accepted_at,
    privacy_accepted_at
  ) VALUES (
    NEW.id,
    NEW.created_at,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically record consent on profile creation
DROP TRIGGER IF EXISTS trigger_record_user_consent ON profiles;
CREATE TRIGGER trigger_record_user_consent
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION record_user_consent();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);