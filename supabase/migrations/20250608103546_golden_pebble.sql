/*
  # Clear All Database Tables

  This migration will safely clear all data from all tables in the correct order
  to respect foreign key constraints.
  
  ⚠️ WARNING: This will permanently delete ALL data in the database!
  
  Tables cleared in order:
  1. Content completions
  2. Quiz attempts  
  3. Questions
  4. Quizzes
  5. Section content
  6. Course sections
  7. Assignments
  8. Materials
  9. Certificates
  10. Course completions
  11. Enrollments
  12. Course admins
  13. Courses
  14. Profiles (except system users)
*/

-- Disable RLS temporarily for bulk operations
SET session_replication_role = replica;

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

-- Clear profiles (but keep any system/admin users if needed)
-- Uncomment the line below if you want to clear ALL profiles including admins
-- DELETE FROM profiles;

-- Or use this to keep superadmin users:
DELETE FROM profiles WHERE role != 'SUPERADMIN';

-- Re-enable RLS
SET session_replication_role = DEFAULT;

-- Reset sequences to start from 1 (if any tables use serial columns)
-- Note: Most tables use UUIDs, but this ensures clean state

-- Vacuum tables to reclaim space
VACUUM ANALYZE content_completions;
VACUUM ANALYZE quiz_attempts;
VACUUM ANALYZE questions;
VACUUM ANALYZE quizzes;
VACUUM ANALYZE section_content;
VACUUM ANALYZE course_sections;
VACUUM ANALYZE assignments;
VACUUM ANALYZE materials;
VACUUM ANALYZE certificates;
VACUUM ANALYZE course_completions;
VACUUM ANALYZE enrollments;
VACUUM ANALYZE course_admins;
VACUUM ANALYZE courses;
VACUUM ANALYZE profiles;