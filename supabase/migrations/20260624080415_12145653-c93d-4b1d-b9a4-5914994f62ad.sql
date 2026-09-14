ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS mempool_accept_fast boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mempool_accept_slow boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stores.mempool_accept_fast IS 'Accept 0-conf (mempool) on fast-finality chains: Base, BSC, Solana, Tron. Capped by mempool_max_usd.';
COMMENT ON COLUMN public.stores.mempool_accept_slow IS 'Accept 0-conf (mempool) on slow-finality chains: Bitcoin, Ethereum L1, TXC. Capped by mempool_max_usd.';