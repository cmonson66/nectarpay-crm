DROP TABLE IF EXISTS
  public.invoice_tap_nonces,
  public.tangem_pay_intents,
  public.kyc_verifications,
  public.transactions,
  public.webhook_deliveries,
  public.derived_addresses,
  public.chain_config_audit,
  public.chain_configs,
  public.api_keys,
  public.terminal_pairing_codes,
  public.terminals,
  public.wallet_link_codes,
  public.invoices,
  public.alchemy_webhooks,
  public.watcher_cursors,
  public.rates_cache,
  public.txc_credit_ledger,
  public.txc_deposit_addresses,
  public.affiliate_rewards,
  public.affiliate_external_sales,
  public.affiliate_clickouts,
  public.affiliate_attributions,
  public.affiliate_codes,
  public.kit_orders,
  public.usage_counters,
  public.subscriptions,
  public.plans,
  public.pos_releases,
  public.merchant_alerts,
  public.stores
CASCADE;

DROP SEQUENCE IF EXISTS public.txc_deposit_address_index_seq CASCADE;

DROP FUNCTION IF EXISTS public.txc_balance(uuid);
DROP FUNCTION IF EXISTS public.next_txc_deposit_index();
DROP FUNCTION IF EXISTS public.owns_store(uuid);
DROP FUNCTION IF EXISTS public.is_subscription_active(uuid);
DROP FUNCTION IF EXISTS public.get_merchant_map_pins();
DROP FUNCTION IF EXISTS public.increment_affiliate_click(text);
DROP FUNCTION IF EXISTS public.chain_configs_audit_xpub();

DROP TYPE IF EXISTS public.chain_kind;
DROP TYPE IF EXISTS public.invoice_status;
DROP TYPE IF EXISTS public.kyc_level;
DROP TYPE IF EXISTS public.kyc_status;
DROP TYPE IF EXISTS public.kyc_provider;
DROP TYPE IF EXISTS public.tangem_pay_intent_status;