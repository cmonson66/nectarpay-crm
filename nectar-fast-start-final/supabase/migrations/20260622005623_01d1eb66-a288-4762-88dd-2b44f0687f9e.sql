ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS token_symbol text;
COMMENT ON COLUMN public.transactions.token_symbol IS 'Asset symbol that landed (e.g. ETH, USDC, USDT, PYUSD). NULL = native chain coin.';
CREATE INDEX IF NOT EXISTS transactions_token_symbol_idx ON public.transactions(token_symbol);