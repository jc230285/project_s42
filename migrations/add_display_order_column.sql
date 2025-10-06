-- Add display_order column to pages table for drag-and-drop reordering
-- Run this SQL in your MySQL database

ALTER TABLE pages 
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Set initial display_order based on current id
UPDATE pages 
SET display_order = id 
WHERE display_order = 0;

-- Verify the column was added
SELECT id, name, category, display_order 
FROM pages 
ORDER BY display_order;
