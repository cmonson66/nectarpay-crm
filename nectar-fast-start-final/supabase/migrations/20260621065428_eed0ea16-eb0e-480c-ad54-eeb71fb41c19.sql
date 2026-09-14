UPDATE public.subscriptions SET plan_id = 'cheap'     WHERE plan_id IN ('starter','growth');
UPDATE public.subscriptions SET plan_id = 'unlimited' WHERE plan_id = 'scale';

INSERT INTO public.plans (id, name, monthly_price_usd, features, invoice_limit, volume_limit_usd)
VALUES
  ('cheap', 'Cheap', 19.00,
    to_jsonb(ARRAY['Everything in Free','Higher monthly transaction limit','CSV export (invoices, payouts)','Reports & analytics','Multiple stores','API keys & webhooks','Email support']),
    1000, 50000.00),
  ('unlimited', 'Unlimited', 99.00,
    to_jsonb(ARRAY['Everything in Cheap','Unlimited transactions','Priority chain support','SLA-backed webhook delivery','Team seats + audit log','Custom KYC rules','Priority support']),
    NULL, NULL)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      monthly_price_usd = EXCLUDED.monthly_price_usd,
      features = EXCLUDED.features,
      invoice_limit = EXCLUDED.invoice_limit,
      volume_limit_usd = EXCLUDED.volume_limit_usd;

UPDATE public.plans
   SET features = to_jsonb(ARRAY['Limited transactions per month','BTC, TEXITcoin, USDC/USDT (Ethereum + Base)','Merchant dashboard','WooCommerce plugin','Webhook delivery + retry','KYC-optional checkout','Community support'])
 WHERE id = 'free';

DELETE FROM public.plans WHERE id IN ('starter','growth','scale');