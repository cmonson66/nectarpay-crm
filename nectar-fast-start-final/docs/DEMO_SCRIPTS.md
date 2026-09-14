# /demo — video scripts

Shooting scripts for the four tiles on `/demo`. Each script has a target
runtime, a voice-over track (VO), an on-screen action track (SCREEN), and
b-roll notes. Voice = one working merchant, conversational, no sales gloss.
Assume ~150 wpm.

Common conventions:

- Cold-open on the hardware or the app — never on a talking head.
- No music under VO. Light beat only on stingers and end card.
- End card on every video: NectarPay hive mark + `nectar-pay.com/demo` +
  "Book a live demo" chip. Hold 2s.
- Lower-third on first speaker: name, "NectarPay merchant, {city}".
- Shoot 4K, 24fps, natural light where possible. Terminal screen captures
  should be screen-recorded from the device, not filmed — film the hands and
  hardware, cut to clean screencap for the UI beats.

---

## 1. Setting up a new account (~3:00)

**Goal:** Box open → POS on the counter → merchant ready to accept a payment.
Shows there is no back office, no bank call, no waiting.

### Beats

1. Unbox the POS terminal (0:00–0:20)
2. Power it on (0:20–0:35)
3. Open the NectarPay POS app (0:35–0:50)
4. Walk the onboarding steps (0:50–1:40)
5. Set up the Beekeeper wallet (1:40–2:20)
6. Accept the default settings (2:20–2:40)
7. Land on the POS transaction screen (2:40–3:00)

### Script

**[0:00 — UNBOX]**
SCREEN: Close-up of the NectarPay box on the counter. Hands lift the lid,
pull out the terminal, printer roll, and USB-C cable. Set them side by side.
VO: "This is everything you get. One terminal, one printer roll, one cable.
No merchant account paperwork, no waiting on an underwriter."

**[0:20 — POWER ON]**
SCREEN: Thumb holds the power button. NectarPay boot logo (hive mark) fades
in. Cut to the home screen.
VO: "Hold power for two seconds. The first boot takes about fifteen."

**[0:35 — OPEN APP]**
SCREEN: Tap the NectarPay POS icon. App splash → onboarding welcome screen.
VO: "The POS app is already installed. Tap it once — this is the last time
you'll ever have to open it manually, it launches on boot from here on."

**[0:50 — ONBOARDING]**
SCREEN: Screencap walk-through:
  - Enter email → magic link on the phone
  - Pick a store name
  - Confirm timezone and currency (USD pre-filled)
VO: "Onboarding is three screens. Your email — we send a magic link, no
password. Your store name — this shows up on the customer receipt. Your
currency — it defaults to whatever your device locale is."

**[1:40 — BEEKEEPER WALLET]**
SCREEN: "Set up your Beekeeper wallet" screen. Tap **Create new**. 12-word
seed phrase appears with a warning banner. Merchant writes each word on the
seed card that shipped in the box. Confirm seed by tapping the words in order.
VO: "This is the important part. The Beekeeper wallet is yours — we never
see the seed, we never hold your money. Write the twelve words down on the
card in the box. If you skip this step, you skip the whole reason NectarPay
exists. Confirm by tapping them back in order."

**[2:20 — DEFAULTS]**
SCREEN: Settings review screen. Chains toggled on: BTC, ETH, USDC, TEXITcoin.
Tip prompt: off. Signature: off. Email receipt: on. Print receipt: on.
Tap **Looks good**.
VO: "The defaults are what most merchants want on day one. You can turn tips,
signatures, or extras on later from settings — for now, tap 'Looks good'."

**[2:40 — POS SCREEN]**
SCREEN: The main POS transaction screen appears. Blinking cursor on the
amount field. Timer overlay in the corner reads "2:47".
VO: "That's it. From an unopened box to ready-to-charge in under three
minutes. Now let's ring a sale."

END CARD (hold 2s).

---

## 2. Processing a Crypto Transaction (~2:30)

**Goal:** The money shot. Show that a crypto sale is faster and simpler than
a card sale, from amount entry to funds landing.

### Beats

1. Type in the amount (0:00–0:15)
2. Show the QR code (0:15–0:35)
3. Toggle the extra-features button — tip, signature, email receipt, print
   receipt (0:35–1:00)
4. Tap-to-pay with a phone (NFC) (1:00–1:25)
5. Tap-to-pay with a Tangem card / wearable (1:25–1:50)
6. Telegram notification of the sale (1:50–2:10)
7. Wallet balance updates (2:10–2:30)

### Script

**[0:00 — AMOUNT]**
SCREEN: POS screen. Merchant types `1 8 . 7 5` on the number pad. Amount
displays as **$18.75** in large type at the top.
VO: "Ring the sale like any register. Eighteen seventy-five for a large cold
brew and a scone."

**[0:15 — QR]**
SCREEN: Tap **Charge**. Screen flips to a big QR code with the amount,
chain selector across the bottom (BTC, ETH, USDC, TEXITcoin), and a "waiting
for payment" pulse.
VO: "Present the screen. The QR carries the amount and every chain you accept.
The customer picks whichever coin they want to pay in — that's their choice,
not yours."

**[0:35 — EXTRA FEATURES]**
SCREEN: Tap the small **⋯ Extras** button in the top-right. Panel slides up
with four toggles: **Ask for tip**, **Ask for signature**, **Email receipt**,
**Print receipt**. Flip **Ask for tip** on, then back off.
VO: "One button hides the extras. Tips, signature capture, email receipts,
printed receipts. Turn any of them on per sale or leave them off for speed —
the terminal remembers your defaults."

**[1:00 — NFC TAP (PHONE)]**
SCREEN: Cut to over-the-shoulder. Customer holds their phone flat to the top
of the terminal. Phone screen shows their wallet app confirming $18.75 in
USDC. They tap **Send**. Terminal plays the confirmation chime, prints the
receipt.
VO: "Tap to pay works exactly like it does on a card reader. Phone to the
terminal, confirm on the phone, done. From tap to receipt in about three
seconds."

**[1:25 — TANGEM / WEARABLE]**
SCREEN: Second customer taps a Tangem card (or ring) to the terminal.
Terminal shows "Tangem detected → signing → confirmed". Chime, receipt.
VO: "Same flow with a Tangem card or a Tangem-enabled ring or watch. No
phone, no app, no signal — the card signs the transaction on contact."

**[1:50 — TELEGRAM]**
SCREEN: Cut to the merchant's phone. Telegram notification banner slides in:
"🐝 NectarPay — $18.75 USDC · Store: Honey & Oat · 2s ago". Tap it — full
sale detail with a link.
VO: "If you've hooked up the Telegram bot, every sale pings you the moment
it settles. Amount, coin, store, and a link back to the ledger."

**[2:10 — WALLET UPDATE]**
SCREEN: Merchant opens the Beekeeper wallet on the same phone. USDC balance
ticks up by $18.75 in real time.
VO: "And there it is in your wallet. Not pending, not batched overnight —
settled. You could spend that money on your next order before the customer
finishes their coffee."

END CARD.

---

## 3. The Velocity of Money (~3:30)

**Goal:** The argument video. Reframe "instant settlement" as a growth tool,
not a novelty. Talk the merchant out of hitting the cash-out button.

### Beats

1. The money lands immediately — you can use it immediately (0:00–0:30)
2. Kneejerk: hit "Cash out" (0:30–1:00)
3. Resist. Extend the benefit by *spending* the crypto, not converting it
   (1:00–1:40)
4. Make a list of the places you'd like to go — we'll help bring them in
   (1:40–2:20)
5. Because funds are available now, you can support another business now,
   and they can support you back five minutes later (2:20–3:00)
6. The faster money moves around a local market, the more benefit it creates
   (3:00–3:30)

### Script

**[0:00 — INSTANT AVAILABILITY]**
SCREEN: Split screen — left: NectarPay wallet balance ticking up in real time
after a sale. Right: a traditional card processor dashboard showing "Pending
– 2 business days".
VO: "With NectarPay the money lands the second the customer taps. Not
'pending', not 'batched Friday' — it's yours, right now, on the counter."

**[0:30 — THE KNEEJERK]**
SCREEN: Merchant's finger hovers over the big **Cash out** button in the app.
Freeze the frame.
VO: "The first instinct every merchant has is to hit this button. Turn the
crypto back into dollars and move it to the bank, because that's what the old
system trained you to do. Wait — don't tap it yet."

**[1:00 — RESIST]**
SCREEN: Pull back from the button. Cut to the merchant closing the app and
walking out from behind the counter, wallet on phone in hand.
VO: "You have a benefit here — settled money, no chargeback, no fee to move
it. You can extend that benefit by *spending* the crypto instead of
converting it. Every conversion is a haircut. Every direct spend is a
compounding advantage."

**[1:40 — YOUR LIST]**
SCREEN: Cut to a notebook or the notes app on a phone. Merchant writes a
short list: "Coffee roaster · Bakery flour supplier · Printer for menus ·
Barber next door · Farmers market booth". Camera pans across the list.
VO: "Write down every business you already pay — your suppliers, your
neighbors, the shops you'd go to on a day off. Send that list to us. We'll
reach out and help each one turn on NectarPay too, at no cost to them. That's
how you grow the pool of places you can spend directly."

**[2:20 — 5 MINUTES LATER]**
SCREEN: Cut back to the counter. Merchant taps to pay the bakery next door
for the morning's croissant order — same wallet, USDC out. Cut to the bakery
across the street; five minutes later, the baker walks over and buys lunch
from our merchant. Same coin, same wallet, back and forth.
VO: "Because your money is available *now*, you can support another business
*now*. And because their money is available *now*, they can support you back
five minutes later. That never happens with cards — the money is trapped in
a settlement queue for days."

**[3:00 — WHY VELOCITY MATTERS]**
SCREEN: Simple animated diagram — same $100 bouncing between four local
businesses in a single afternoon. Counter in the corner: "Local GDP created:
$400 from $100 in circulation."
VO: "This is what economists call the velocity of money. The faster a dollar
— or a coin — moves around a local market, the more economic activity it
creates from the same starting pool. Cashing out slows the coin down. Spending
it speeds it up. NectarPay is built to make spending it the easy default."

END CARD.

---

## 4. Cashing Out to Your Bank (~2:30)

**Goal:** Kill the "how do I actually get dollars" objection with an honest
walkthrough. Set expectations: it's a couple of steps, and it's not instant
to the bank.

### Beats

1. Money arrives across multiple wallets and coins (0:00–0:30)
2. Round it up to your main wallet — may take a few transfers (0:30–1:15)
3. Once it's consolidated, tap **Cash out** (1:15–1:40)
4. First time: add your ACH routing + account numbers (1:40–2:10)
5. Funds reach your bank in a few hours (2:10–2:30)

### Script

**[0:00 — MULTIPLE WALLETS]**
SCREEN: Beekeeper wallet home. Balances visible across four rows: BTC · ETH ·
USDC · TEXITcoin. Each has a different number.
VO: "Your customers pay in whatever coin they want, which means at the end of
a busy day you've got money sitting across several wallets. That's normal."

**[0:30 — ROUND UP]**
SCREEN: Tap the BTC row → **Send to main wallet**. Tap ETH row → **Send to
main wallet**. Repeat for TEXITcoin. USDC is already the main wallet — leave
it. Watch the main USDC balance climb after each swap.
VO: "Before you cash out, round everything into your main wallet. Tap each
coin, hit 'Send to main', confirm. Depending on the chain it takes a few
seconds to a couple of minutes to land. Do this once at end of day, or once
a week — whatever fits your rhythm."

**[1:15 — CASH OUT]**
SCREEN: Back on the main wallet. Now a single consolidated USDC balance.
Tap the big **Cash out** button.
VO: "Now the cash-out button does what you'd expect. It'll ask how much of
your balance you want to send to the bank — all of it, or a specific dollar
amount."

**[1:40 — ADD BANK]**
SCREEN: First-time flow. Form with two fields: **ACH routing number** and
**Account number**. Small print: "We use a licensed payout partner. Your bank
details are stored with them, not with NectarPay." Merchant types both,
taps **Save**.
VO: "The first time you cash out, you'll enter your bank's ACH routing number
and your account number. We're not the ones holding that — a licensed payout
partner does. You do this once, and it's saved for next time. This feature is
rolling out market by market; if you don't see it yet, you're on the wait
list automatically."

**[2:10 — ARRIVAL]**
SCREEN: Confirmation screen: "Payout initiated — $842.10 → Chase •••4471.
Expected arrival: today by 4pm." Cut to the merchant's banking app a few
hours later showing the deposit.
VO: "ACH takes a few hours to a business day to hit your account, same as
any bank transfer. That's the one part of the flow we can't make instant —
the banking rails are still the banking rails. Everything up to that button
is."

END CARD.

---

## Production checklist

- [ ] Book a real working merchant (DFW preferred — coffee, barber, or
      quick-serve) for on-camera in videos 2 and 3.
- [ ] Line up a second cooperating merchant across the street for the
      back-and-forth beat in video 3.
- [ ] Record screencaps on a device with a clean store — no test transactions
      in the ledger, no debug banner.
- [ ] Shoot in the same location on the same day to keep continuity between
      videos.
- [ ] End card asset: hive mark PNG + URL in the brand font. Same 2-second
      hold on all four.
