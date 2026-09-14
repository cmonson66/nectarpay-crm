DO $$ BEGIN PERFORM cron.unschedule('texitpay-watcher-tick'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'texitpay-watcher-tick',
  '10 seconds',
  $$
  SELECT net.http_post(
    url := 'https://project--faa7c23e-4f75-4eed-8c8c-23234e4242f7.lovable.app/api/public/cron/watcher',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);