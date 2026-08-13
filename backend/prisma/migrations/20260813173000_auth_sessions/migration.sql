ALTER TABLE "users"
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMPTZ(6),
  ADD COLUMN "last_login_at" TIMESTAMPTZ(6),
  ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "parent_session_id" UUID,
  "replaced_by_id" UUID,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "revocation_reason" VARCHAR(120),
  "ip_address" INET,
  "user_agent" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMPTZ(6),
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE UNIQUE INDEX "auth_sessions_replaced_by_id_key" ON "auth_sessions"("replaced_by_id");
CREATE INDEX "auth_sessions_tenant_id_user_id_expires_at_idx" ON "auth_sessions"("tenant_id", "user_id", "expires_at");
CREATE INDEX "auth_sessions_tenant_id_family_id_idx" ON "auth_sessions"("tenant_id", "family_id");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_parent_session_id_fkey"
  FOREIGN KEY ("parent_session_id") REFERENCES "auth_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_replaced_by_id_fkey"
  FOREIGN KEY ("replaced_by_id") REFERENCES "auth_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_valid_expiry"
  CHECK ("expires_at" > "created_at");
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_sha256_format"
  CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

CREATE TRIGGER "tenant_guard_user_id" BEFORE INSERT OR UPDATE OF tenant_id, user_id
  ON "auth_sessions" FOR EACH ROW EXECUTE FUNCTION assert_same_tenant('users', 'user_id');
CREATE TRIGGER "tenant_guard_user_id" BEFORE INSERT OR UPDATE OF tenant_id, user_id
  ON "user_roles" FOR EACH ROW EXECUTE FUNCTION assert_same_tenant('users', 'user_id');
CREATE TRIGGER "tenant_guard_role_id" BEFORE INSERT OR UPDATE OF tenant_id, role_id
  ON "user_roles" FOR EACH ROW EXECUTE FUNCTION assert_same_tenant('roles', 'role_id');
CREATE TRIGGER "tenant_guard_role_id" BEFORE INSERT OR UPDATE OF tenant_id, role_id
  ON "role_permissions" FOR EACH ROW EXECUTE FUNCTION assert_same_tenant('roles', 'role_id');

CREATE FUNCTION "validate_auth_session_rotation"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent_family uuid;
  parent_user uuid;
BEGIN
  IF NEW.parent_session_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT family_id, user_id INTO parent_family, parent_user
  FROM "auth_sessions" WHERE id = NEW.parent_session_id;
  IF parent_family IS DISTINCT FROM NEW.family_id OR parent_user IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'rotated sessions must remain in the same user and token family'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "auth_sessions_validate_rotation"
  BEFORE INSERT OR UPDATE ON "auth_sessions"
  FOR EACH ROW EXECUTE FUNCTION "validate_auth_session_rotation"();
