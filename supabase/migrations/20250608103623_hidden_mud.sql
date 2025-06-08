/*
  # Clear all database tables

  This migration will clear all data from the database tables while preserving the schema.
  
  ## What gets cleared:
  1. Content completions - User progress tracking
  2. Quiz attempts - All quiz submissions
  3. Questions - All quiz questions
  4. Quizzes - All quiz definitions
  5. Section content - All course content items
  6. Course sections - All course structure
  7. Assignments - All submitted assignments
  8. Materials - All course materials
  9. Certificates - All issued certificates
  10. Course completions - All completion records
  11. Enrollments - All student enrollments
  12. Course admins - All admin assignments
  13. Courses - All courses
  14. Profiles - All user profiles (except superadmins)

  ## Safety:
  - Preserves SUPERADMIN users
  - Respects foreign key constraints
  - Clears data in correct dependency order
*/

-- Clear dependent tables first (respecting foreign key constraints)

-- Clear content completions
DELETE FROM content_completions;

-- Clear quiz attempts
DELETE FROM quiz_attempts;

-- Clear questions
DELETE FROM questions;

-- Clear quizzes
DELETE FROM quizzes;

-- Clear section content
DELETE FROM section_content;

-- Clear course sections
DELETE FROM course_sections;

-- Clear assignments
DELETE FROM assignments;

-- Clear materials
DELETE FROM materials;

-- Clear certificates
DELETE FROM certificates;

-- Clear course completions
DELETE FROM course_completions;

-- Clear enrollments
DELETE FROM enrollments;

-- Clear course admins
DELETE FROM course_admins;

-- Clear courses
DELETE FROM courses;

-- Clear profiles (but keep superadmin users)
DELETE FROM profiles WHERE role != 'SUPERADMIN';

-- Reset any sequences if needed (most tables use UUIDs, but this ensures clean state)
-- Note: Since we're using UUIDs for primary keys, there are no sequences to reset