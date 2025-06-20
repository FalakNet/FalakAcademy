-- Add order_index to course_sections if not exists
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS order_index integer;

-- Add order_index to section_content if not exists
ALTER TABLE section_content ADD COLUMN IF NOT EXISTS order_index integer;

-- Set default order_index for existing rows (if needed)
-- Use row_number() to assign sequential order if id is uuid
WITH numbered_sections AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM course_sections WHERE order_index IS NULL
)
UPDATE course_sections SET order_index = ns.rn FROM numbered_sections ns WHERE course_sections.id = ns.id;

WITH numbered_content AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM section_content WHERE order_index IS NULL
)
UPDATE section_content SET order_index = nc.rn FROM numbered_content nc WHERE section_content.id = nc.id;

-- Create index for faster ordering (optional)
CREATE INDEX IF NOT EXISTS idx_course_sections_order ON course_sections (course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_section_content_order ON section_content (section_id, order_index);
