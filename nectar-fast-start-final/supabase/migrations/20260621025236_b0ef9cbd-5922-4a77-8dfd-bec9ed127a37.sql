ALTER TYPE public.chain_kind ADD VALUE IF NOT EXISTS 'tron';
ALTER TYPE public.chain_kind ADD VALUE IF NOT EXISTS 'sol';

INSERT INTO public.watcher_cursors (chain, last_height, last_run_at, last_status, last_error)
VALUES ('tron', 0, now(), 'pending', NULL), ('sol', 0, now(), 'pending', NULL)
ON CONFLICT (chain) DO NOTHING;