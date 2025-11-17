-- backend/seeds/admin.sql
-- NOTE: Ran directly in Supabase SQL Editor (could not use psql locally).
-- Use these statements if needing to re-seed admin users.

-- Personal account (already seeded)
INSERT INTO profiles (id, email, is_admin)
VALUES ('45bb595a-1d0f-4fab-a94e-9f32e1aa2fc1', 'nicolastraver93@gmail.com', true)
ON CONFLICT (id) DO UPDATE
SET is_admin = EXCLUDED.is_admin;

-- Production account (domain email)
INSERT INTO profiles (id, email, is_admin)
VALUES (gen_random_uuid(), 'hello@tabfair.com', true)
ON CONFLICT (email) 
DO UPDATE SET is_admin = true;


