/*
  # Add DELETE policies for courses table

  1. Security Changes
    - Add DELETE policy for superadmins to delete any course
    - Add DELETE policy for course creators to delete their own courses
    - Add DELETE policy for course admins to delete courses they manage

  This migration adds the missing DELETE policies that are preventing course deletion.
*/

-- Allow superadmins to delete any course
CREATE POLICY "Superadmins can delete any course"
  ON courses
  FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'SUPERADMIN'::user_role);

-- Allow course creators to delete their own courses
CREATE POLICY "Course creators can delete their courses"
  ON courses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Allow course admins to delete courses they manage
CREATE POLICY "Course admins can delete their courses"
  ON courses
  FOR DELETE
  TO authenticated
  USING (is_course_admin(auth.uid(), id));