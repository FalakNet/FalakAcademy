/*
  # Add background image support for courses

  1. Changes
    - Add background_image_url column to courses table
    - This will store the URL/path to the background image in storage

  2. Security
    - Uses existing course management permissions
    - Background images stored in course-materials bucket
*/

-- Add background_image_url column to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS background_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN courses.background_image_url IS 'URL/path to the course background image stored in Supabase storage';