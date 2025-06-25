-- Add view_answers column to quizzes table
ALTER TABLE quizzes ADD COLUMN view_answers boolean NOT NULL DEFAULT false;
