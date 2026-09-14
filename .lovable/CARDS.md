# NectarPay POS — NFC Card Recommendation

The terminal reads any NDEF-formatted tag, but for **our own printed cards**
here's the spec to hand a vendor.

## Chip

**NTAG213** — the pragmatic default.
- 144 bytes usable NDEF memory
- ~£0.10 in bulk (Alibaba: £0.03–0.06, Western vendors: £0.10–0.30)
- ISO 14443A, 13.56 MHz — universally supported by phone NFC and by the
  Senraise terminal
- Read-only lockable after we write, so a card can't be tampered with

**NTAG216** — pick this if we want signed intents.
- 888 bytes usable — room for a JSON payload with an ECDSA signature and
  metadata (merchant, expiry, nonce)
- ~£0.15 in bulk
- Same physical properties as NTAG213

Avoid MIFARE Classic (proprietary, some phones can't read, cheaper only in
tiny quantities), MIFARE Ultralight (worse capacity/price than NTAG213), and
DESFire (overkill and 5x the price).

## Physical

- CR80 (credit-card size, 85.6 × 54 × 0.84 mm) laminated PVC — feels like
  a real card in the wallet
- 4-color offset print, matte laminate
- Chip embedded, not stuck on top
- Rounded corners

For a "tap-to-donate" or event-badge variant, PET/paper wristbands or
sticker discs work too — same chip, different form factor.

## NDEF payload we write

Two records per tag:

**Record 1 — MIME**
- Type: `application/vnd.nectar.pay+json`
- Body:
  ```json
  {
    "v": 1,
    "addr": "0x1234…",
    "chain": "base",
    "token": "USDC",
    "label": "Sarah's tips jar"
  }
  ```

**Record 2 — URI** (fallback for wallets that ignore the JSON)
- Chain-specific pay URI: `ethereum:0x1234…@8453` /
  `bitcoin:bc1q…?amount=0.001` / `solana:…?amount=1&spl-token=…`

The terminal reads both, prefers the JSON, and falls back to the URI if the
JSON is missing or malformed. See `android/app/src/main/java/money/honest/nectarpos/NdefRouter.java`.

## Recommended vendors

- **GoToTags** (US, gototags.com) — small-run, ships pre-encoded cards
  with our payload. Best for MVP: send them the JSON template and a CSV of
  addresses, they print + encode + ship. ~£0.90/card at 500 units.
- **Alibaba / Shenzhen Zhongyi** — bulk, cheap (~£0.20/card at 5k), we
  encode on-site with an Android phone + `NFC Tools Pro`. Best once we're
  at scale.
- **Seritag** (UK, seritag.com) — European alternative with pre-encoding.

## Encoding on-site (once we have blank stock)

We'll add an `/admin/cards/encode` page (deferred) that:
1. Takes a merchant + amount
2. Generates the two-record NDEF payload
3. Uses Web NFC (`NDEFReader.write(...)`) on any Android phone to write it
4. Optionally locks the tag

For now, "NFC Tools Pro" (Android app, £6) can write our payload from a
JSON export. I'll add the encoder page in the next pass once we have real
cards to test with.
