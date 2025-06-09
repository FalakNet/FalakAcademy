/*
  # Fix RLS policies for course progress calculation

  1. Policy Updates
    - Allow enrolled users to read unpublished sections for progress calculation
    - Allow enrolled users to read unpublished content for progress calculation
    - Maintain security while enabling progress tracking

  2. Security
    - Users can only read unpublished content from courses they're enrolled in
    - Admins maintain full access
    - Content interaction still requires published status
*/

-- Update course_sections policies to allow enrolled users to read unpublished sections for progress
DROP POLICY IF EXISTS "Enrolled users can read published sections" ON course_sections;

-- Allow enrolled users to read ALL sections (including unpublished) for progress calculation
CREATE POLICY "Enrolled users can read all sections for progress"
  ON course_sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.user_id = auth.uid()
      AND enrollments.course_id = course_sections.course_id
    )
    OR is_course_admin(auth.uid(), course_id)
    OR (get_user_role(auth.uid()) = 'SUPERADMIN'::user_role)
  );

-- Update section_content policies to allow enrolled users to read unpublished content for progress
DROP POLICY IF EXISTS "Enrolled users can read published content" ON section_content;

-- Allow enrolled users to read ALL content (including unpublished) for progress calculation
CREATE POLICY "Enrolled users can read all content for progress"
  ON section_content
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_sections cs
      JOIN enrollments e ON e.course_id = cs.course_id
      WHERE cs.id = section_content.section_id
      AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM course_sections cs
      WHERE cs.id = section_content.section_id
      AND (is_course_admin(auth.uid(), cs.course_id) OR (get_user_role(auth.uid()) = 'SUPERADMIN'::user_role))
    )
  );

-- Note: The application logic will still only allow interaction with published content
-- This change only allows reading unpublished content for progress calculation purposes