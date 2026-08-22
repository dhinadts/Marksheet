ALTER TABLE "users" ADD COLUMN "username" VARCHAR(50);

UPDATE "users"
SET "username" = split_part("email", '@', 1)
WHERE "username" IS NULL;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
