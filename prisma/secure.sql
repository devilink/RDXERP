-- Supabase publishes the public schema through its REST API. This app talks to
-- Postgres only through Prisma, as the table owner, which row-level security does
-- not restrict. So: enable RLS with no policies and remove API-role access, on
-- every table including ones added by later migrations. Safe to re-run.
DO $$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON public.%I FROM %I', t.tablename, r);
      END IF;
    END LOOP;
  END LOOP;
END $$;
