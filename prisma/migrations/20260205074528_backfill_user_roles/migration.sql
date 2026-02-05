-- Seed roles (one-time)
INSERT INTO "roles" ("key") VALUES ('admin');
INSERT INTO "roles" ("key") VALUES ('doctor');

-- Backfill user_roles from legacy users.is_admin
-- Everyone is a doctor
INSERT OR IGNORE INTO "user_roles" ("user_id", "role_id")
SELECT u."id", r."id"
FROM "users" u
JOIN "roles" r ON r."key" = 'doctor';

-- Legacy admins get admin role too
INSERT OR IGNORE INTO "user_roles" ("user_id", "role_id")
SELECT u."id", r."id"
FROM "users" u
JOIN "roles" r ON r."key" = 'admin'
WHERE u."is_admin" = 1;
-- This is an empty migration.