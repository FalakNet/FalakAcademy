/*
  # Add certificate option to courses

  1. New Columns
    - `enable_certificates` (boolean) - Whether this course should issue certificates upon completion
  
  2. Changes
    - Add enable_certificates column to courses table with default value of true
    - Update existing courses to have certificates enabled by default
    
  3. Notes
    - This allows course administrators to control whether certificates are issued for specific courses
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