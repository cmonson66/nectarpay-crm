import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader, Stat } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/training/cryptopop")({
  head: () => ({
    meta: [
      { title: "CryptoPOP Participant Training" },
      {
        name: "description",
        content:
          "How to earn POP, climb the leaderboard, and recruit local merchants into Nectar-PAY.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Training Manual · Participants"
        title="Earn POP. Bring merchants. Build a city."
        lede="The complete guide for CryptoPOP participants — how the rewards economy works, how to climb the leaderboard, and how to turn introductions into real cash."
      />
      <DocBody>
        <h2>1. The POP economy</h2>
        <p>
          POP is the points currency of the CryptoPOP app. Earn it for participation, spend it on
          local rewards.
        </p>
        <div className="not-prose my-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat value="+10" label="App signup" />
          <Stat value="+10" label="Event attendance" />
          <Stat value="+10" label="Per friend brought" />
          <Stat value="+1" label="Per $1 spent" />
          <Stat value="+50" label="Merchant referral" />
        </div>

        <h2>2. The leaderboard</h2>
        <p>
          Each market has a daily leaderboard. Top point holders win prizes — shirts, NFC rings,
          hardware wallets, free meals from member merchants. Compete in your city.
        </p>

        <h2>3. How to earn fast</h2>
        <ol>
          <li>
            <strong>Show up to every sponsored event.</strong> Easy 10 POP and the chance to grab
            another 10 per friend.
          </li>
          <li>
            <strong>Pay with crypto everywhere you can.</strong> 1 POP per dollar adds up faster
            than you think.
          </li>
          <li>
            <strong>Recruit merchants.</strong> This is where the real money is — 50 POP + $50 cash
            per signup.
          </li>
          <li>
            <strong>Host your own pop-up.</strong> Trivia, run club, board game night — bring the
            people, we'll sponsor the round.
          </li>
        </ol>

        <h2>4. The merchant referral playbook</h2>
        <p>
          You're closer to a $50 bonus than you think. The merchants you already visit are the
          warmest leads in your city.
        </p>
        <h3>Step 1 — Pick three businesses</h3>
        <p>
          Coffee shops, salons, restaurants, churches, gyms. The ones you already love.
          Owner-operated is best.
        </p>
        <h3>Step 2 — Use the 30-second pitch</h3>
        <blockquote>
          "Hey — quick one. Do you guys take crypto yet? I'm part of CryptoPOP and we're rolling
          out a terminal called Nectar-PAY. No card fees, money lands instantly, no chargebacks.
          And it puts your shop on a rewards map I use every week. Can I send you a one-pager?"
        </blockquote>
        <h3>Step 3 — Send the merchant deck</h3>
        <p>
          Drop your unique referral link in a text. The deck does the rest. When the merchant
          signs, you get 50 POP + $50 in your wallet — and 1 POP on every dollar a customer spends
          there from then on.
        </p>

        <h2>5. Events you can run yourself</h2>
        <ul>
          <li>
            <strong>Trivia night</strong> at a sponsor bar — we cover the first round.
          </li>
          <li>
            <strong>Poker / bowling / pickleball night</strong> — sponsor the buy-in, hand out
            POP.
          </li>
          <li>
            <strong>"Crypto Coffee"</strong> — a Saturday morning at a member coffee shop to
            onboard newcomers.
          </li>
          <li>
            <strong>Adventure pop-ups</strong> — go-karts, zip line, axe throwing. Fun travels.
          </li>
        </ul>

        <h2>6. The rules of the hive</h2>
        <ul>
          <li>Never misrepresent Nectar-PAY's fees or features. Honest money means honest pitches.</li>
          <li>Never give financial, tax, or investment advice. Refer to a pro.</li>
          <li>Respect the merchant — they're doing you a favor by listening.</li>
          <li>Cash bonuses are paid after the merchant's terminal is live and processing.</li>
        </ul>

        <h2>7. Quick reference</h2>
        <ul>
          <li>
            App: <strong>CryptoPOP</strong> — wallet, scoreboard, map, events.
          </li>
          <li>
            Merchant deck: share <strong>/admin/knowledge/pitch/merchants</strong> from this
            manual.
          </li>
          <li>Support: ping your market lead in the community channel.</li>
        </ul>
      </DocBody>
    </>
  );
}
