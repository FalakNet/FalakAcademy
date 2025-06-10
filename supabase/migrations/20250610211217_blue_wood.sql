/*
  # Add certificate issuance option for courses

  1. Changes
    - Add `enable_certificates` column to courses table
    - Set default to true to maintain existing behavior
    - Update existing courses to enable certificates by default

  2. Security
    - No changes to RLS policies needed
*/

-- Add enable_certificates column to courses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'enable_certificates'
  ) THEN
    ALTER TABLE courses ADD COLUMN enable_certificates boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Update existing courses to enable certificates by default
UPDATE courses SET enable_certificates = true WHERE enable_certificates IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN courses.enable_certificates IS 'Whether this course should issue certificates upon completion';