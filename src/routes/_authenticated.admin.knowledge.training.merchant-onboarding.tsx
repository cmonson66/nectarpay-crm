import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader } from "@/components/knowledge-shell";

export const Route = createFileRoute(
  "/_authenticated/admin/knowledge/training/merchant-onboarding",
)({
  head: () => ({
    meta: [
      { title: "Merchant Onboarding Manual · Nectar-PAY" },
      {
        name: "description",
        content:
          "Eight steps from yes to first crypto transaction — the official Nectar-PAY merchant onboarding workflow.",
      },
    ],
  }),
  component: Page,
});

const STEPS: Array<{ n: string; t: string; d: string }> = [
  {
    n: "01",
    t: "Confirm the agreement",
    d: "Walk through the terminal cost ($499), subscription ($19/mo), and the $250 first-year gift-certificate option in lieu of service fees. Get a clear yes before you unbox anything.",
  },
  {
    n: "02",
    t: "Set up the merchant wallet",
    d: "Help the owner install the Honest Money wallet. Generate a fresh non-custodial wallet. Write down the recovery phrase together — twice — in a place they will not lose.",
  },
  {
    n: "03",
    t: "Pair the terminal",
    d: "Power on the Nectar-PAY terminal. Connect to the shop's WiFi. Scan the wallet QR to bind the device. One indicator light = paired.",
  },
  {
    n: "04",
    t: "Configure tax & display",
    d: "Set the shop's tax rate and preferred fiat display currency (USD by default). Confirm the receipt printer if one is attached.",
  },
  {
    n: "05",
    t: "Run a $1 test payment",
    d: "Ring a $1 sale. Pay it from your own CryptoPOP wallet. Watch the funds appear in the merchant's wallet in real time. This is the magic moment — pause for it.",
  },
  {
    n: "06",
    t: "Train the staff",
    d: "Show every shift lead the three buttons they will actually use: New Sale, Refund, End of Day. Five minutes is enough. Leave the one-page cheat sheet on the counter.",
  },
  {
    n: "07",
    t: "Launch CryptoPOP listing",
    d: "Add the merchant to the CryptoPOP map. Pick the launch reward (free coffee, $5 off, etc.) and the $ amount of gift certificates contributed. Take a hero photo for the listing.",
  },
  {
    n: "08",
    t: "Book the 7-day check-in",
    d: "Don't leave without a calendar invite on the books for day 7. Most churn happens in the first week — most retention does too.",
  },
];

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Training Manual · Merchant Onboarding"
        title="Eight steps from yes to first transaction."
        lede="Use this checklist every time you onboard a Nectar-PAY merchant. Don't skip steps — the order is what makes the first week work."
      />
      <DocBody>
        <ol className="not-prose mb-10 space-y-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="flex gap-5 rounded-xl border border-border bg-card p-5"
            >
              <div className="font-display text-2xl font-semibold text-honey-deep">{s.n}</div>
              <div>
                <div className="font-semibold text-ink">{s.t}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2>What to leave behind</h2>
        <ul>
          <li>Printed terminal cheat sheet (3 buttons, taped near the register).</li>
          <li>Wallet recovery phrase, written twice, stored in two locations.</li>
          <li>Window decal: "Crypto Accepted — CryptoPOP rewards here."</li>
          <li>Your direct phone number for the first 30 days.</li>
        </ul>

        <h2>The first 30 days</h2>
        <ol>
          <li>
            <strong>Day 1:</strong> First live sale. You're there for it if at all possible.
          </li>
          <li>
            <strong>Day 3:</strong> Text check-in. Any glitches? Any questions from staff?
          </li>
          <li>
            <strong>Day 7:</strong> Calendar visit. Review the dashboard together. Push at least
            one local CryptoPOP event toward their door.
          </li>
          <li>
            <strong>Day 14:</strong> Ask for the testimonial and the first referral.
          </li>
          <li>
            <strong>Day 30:</strong> Celebrate the first month's savings. Hand them the framed
            "Founding Merchant" certificate.
          </li>
        </ol>

        <h2>Common first-week issues</h2>
        <ul>
          <li>
            <strong>Staff forgets the flow:</strong> Print a second cheat sheet. Walk it through
            with the next shift in person.
          </li>
          <li>
            <strong>Customer wallet doesn't scan:</strong> Usually a brightness issue. Bump the
            customer's phone brightness to max.
          </li>
          <li>
            <strong>Owner anxiety about price volatility:</strong> Show the one-tap auto-convert
            setting in the wallet.
          </li>
          <li>
            <strong>"Where's the money?":</strong> It's already there. Open the wallet with them.
            Show the transaction.
          </li>
        </ul>

        <h2>What success looks like at day 30</h2>
        <ul>
          <li>5+ live crypto transactions per week.</li>
          <li>Listed on the CryptoPOP map with an active reward.</li>
          <li>At least one merchant referral submitted.</li>
          <li>A written testimonial we can use in marketing.</li>
        </ul>
      </DocBody>
    </>
  );
}
