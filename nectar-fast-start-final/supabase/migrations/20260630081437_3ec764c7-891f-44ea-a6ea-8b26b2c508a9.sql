DO $$
DECLARE uid uuid := '1d6e891a-5d61-4f85-bde4-8aea9b3b9f23';
BEGIN
  DELETE FROM public.wallet_accounts WHERE user_id = uid;
  DELETE FROM public.terminal_pairing_codes WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid);
  DELETE FROM public.wallet_link_codes WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid);
  DELETE FROM public.terminals WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid);
  DELETE FROM public.invoice_tap_nonces WHERE invoice_id IN (SELECT id FROM public.invoices WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid));
  DELETE FROM public.transactions WHERE invoice_id IN (SELECT id FROM public.invoices WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid));
  DELETE FROM public.webhook_deliveries WHERE invoice_id IN (SELECT id FROM public.invoices WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid));
  DELETE FROM public.invoices WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid);
  DELETE FROM public.derived_addresses WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid);
  DELETE FROM public.chain_config_audit WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid);
  DELETE FROM public.chain_configs WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid);
  DELETE FROM public.api_keys WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = uid);
  DELETE FROM public.stores WHERE owner_id = uid;
  DELETE FROM public.notification_prefs WHERE user_id = uid;
  DELETE FROM public.notification_log WHERE user_id = uid;
  DELETE FROM public.telegram_bind_codes WHERE user_id = uid;
  DELETE FROM public.txc_credit_ledger WHERE user_id = uid;
  DELETE FROM public.txc_deposit_addresses WHERE user_id = uid;
  DELETE FROM public.usage_counters WHERE user_id = uid;
  DELETE FROM public.subscriptions WHERE user_id = uid;
  DELETE FROM public.user_roles WHERE user_id = uid;
  DELETE FROM public.profiles WHERE user_id = uid;
  DELETE FROM auth.users WHERE id = uid;
END $$;