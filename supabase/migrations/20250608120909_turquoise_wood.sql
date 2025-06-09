/*
  # Create Storage Buckets

  1. Storage Buckets
    - certificate-templates: For storing custom certificate PDF templates
    - course-materials: For storing course files and materials
    - user-uploads: For storing user-submitted assignments and files

  2. Security
    - Certificate templates: Only admins can upload, authenticated users can read
    - Course materials: Only admins can upload, enrolled users can read
    - User uploads: Users can upload their own files, admins can read all
*/

-- Create certificate-templates bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificate-templates', 'certificate-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Create course-materials bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-materials', 'course-materials', false)
ON CONFLICT (id) DO NOTHING;

-- Create user-uploads bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Certificate Templates Policies
-- Allow admins to upload certificate templates
CREATE POLICY "Admins can upload certificate templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificate-templates' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
  )
);

-- Allow admins to update certificate templates
CREATE POLICY "Admins can update certificate templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'certificate-templates' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
  )
);

-- Allow admins to delete certificate templates
CREATE POLICY "Admins can delete certificate templates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'certificate-templates' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
  )
);

-- Allow authenticated users to read certificate templates
CREATE POLICY "Authenticated users can read certificate templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'certificate-templates');

-- Course Materials Policies
-- Allow admins to upload course materials
CREATE POLICY "Admins can upload course materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
  )
);

-- Allow admins to update course materials
CREATE POLICY "Admins can update course materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
  )
);

-- Allow admins to delete course materials
CREATE POLICY "Admins can delete course materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
  )
);

-- Allow enrolled users to read course materials
CREATE POLICY "Enrolled users can read course materials"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-materials' AND
  (
    -- Allow admins to read all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
    )
    OR
    -- Allow enrolled users to read materials from their courses
    EXISTS (
      SELECT 1 FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = auth.uid()
      -- Note: In practice, you'd want to link materials to specific courses
      -- This is a simplified policy for now
    )
  )
);

-- User Uploads Policies
-- Allow users to upload their own files
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files and admins to read all
CREATE POLICY "Users can read own files, admins can read all"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-uploads' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('COURSE_ADMIN', 'SUPERADMIN')
    )
  )
);