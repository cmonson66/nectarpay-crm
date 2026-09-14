DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
  END LOOP;
END $$;

-- Public read for plans and rates_cache (anonymous browsing)
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.rates_cache TO anon;
GRANT SELECT ON public.chain_configs TO anon;