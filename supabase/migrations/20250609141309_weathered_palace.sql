/*
  # Create storage bucket for course background images

  1. Storage Bucket
    - course-backgrounds: For storing course background images
    
  2. Security Policies
    - Only admins can upload/update/delete background images
    - All authenticated users can view background images
    - Public read access for better performance
*/

-- Create course-backgrounds bucket (public for better performance)
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-backgrounds', 'course-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload course background images
CREATE POLICY "Admins can upload course backgrounds"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-backgrounds' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
  )
);

-- Allow admins to update course background images
CREATE POLICY "Admins can update course backgrounds"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-backgrounds' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
  )
);

-- Allow admins to delete course background images
CREATE POLICY "Admins can delete course backgrounds"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-backgrounds' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
  )
);

-- Allow public read access to course background images
CREATE POLICY "Public can view course backgrounds"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-backgrounds');