# NectarPay for PrestaShop 8.x

Non-custodial crypto payments (BTC, TEXITcoin, stablecoins) for PrestaShop 8.0–8.2.

## Install

1. Zip this folder as `nectarpay.zip` (the root of the zip must be the `nectarpay/` folder).
2. In PrestaShop admin → **Modules → Module Manager → Upload a module**, upload the zip.
3. Click **Configure** and paste:
   - **API key** — from your NectarPay dashboard → API keys
   - **Store ID** — from your NectarPay dashboard → Stores
   - **Webhook secret** — from your NectarPay dashboard → API keys → Webhook secret
   - **API base URL** — leave as `https://nectar-pay.com`

## Endpoints registered

| Purpose | URL |
| --- | --- |
| Redirect to hosted pay page | `/index.php?fc=module&module=nectarpay&controller=redirect` |
| Signed webhook receiver     | `/index.php?fc=module&module=nectarpay&controller=webhook`  |
| Shopper return              | `/index.php?fc=module&module=nectarpay&controller=return`   |

Point the webhook URL you paste into the NectarPay dashboard at the `webhook` URL above.

## Compatibility

- PrestaShop 1.7.6 → 8.2 (tested on 8.1 and 8.2)
- PHP 7.4+
- Requires the shop to serve non-plain URLs (default in 8.x)

## License

MIT.
