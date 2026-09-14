import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader, Slide, Stat } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/pitch/new-markets")({
  head: () => ({
    meta: [
      { title: "New Markets Deck · Nectar-PAY" },
      {
        name: "description",
        content:
          "Franchise pitch: how to launch Nectar-PAY & CryptoPOP in your region as a regional partner.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Pitch Deck · Franchise · New Markets"
        title="Own your city's payment rails."
        lede="A turnkey regional franchise to launch Nectar-PAY (merchant) and CryptoPOP (consumer) in your market. We supply the playbook, the tech, and the brand. You build the network and share in every recurring dollar it produces."
      />
      <DocBody>
        <Slide
          n={1}
          kicker="The Opportunity"
          title="Become the crypto payment rails of an entire city."
          tone="honey"
        >
          <p>
            Card processors built billion-dollar businesses one zip code at a time. Crypto
            acceptance on Main Street is the same arbitrage — twenty years earlier in its curve.
            Pick your market. Plant the flag.
          </p>
        </Slide>

        <Slide n={2} kicker="The Model" title="One territory, two products, one team.">
          <ul>
            <li>
              <strong>Nectar-PAY (merchant side)</strong> — sign local businesses to the terminal
              + subscription. Earn on every sale and every recurring fee.
            </li>
            <li>
              <strong>CryptoPOP (consumer side)</strong> — run the events, the rewards, the foot
              traffic engine that makes merchants want to stay.
            </li>
            <li>
              One regional leadership pair owns both sides — because the flywheel only spins when
              both turn together.
            </li>
          </ul>
        </Slide>

        <Slide n={3} kicker="What We Provide" title="Everything but the handshake.">
          <ul>
            <li>Hardware terminals at cost, drop-shipped to your merchants.</li>
            <li>Brand, marketing kits, pitch decks, ambassador playbook.</li>
            <li>$24,000 launch bootstrap fund for consumer acquisition coupons.</li>
            <li>The CryptoPOP app, the POP economy, the leaderboard, the rewards.</li>
            <li>Sales training, weekly coaching, founder Slack access.</li>
          </ul>
        </Slide>

        <Slide
          n={4}
          kicker="What You Bring"
          title="Local credibility and a relentless work ethic."
        >
          <ul>
            <li>Knowledge of your city's small business + community scene.</li>
            <li>Capacity to recruit and manage 10–25 ambassadors.</li>
            <li>An appetite for performance-based upside over a salary floor.</li>
            <li>
              The personality to run events, hand out free coffee, and pitch a microphone.
            </li>
          </ul>
        </Slide>

        <Slide
          n={5}
          kicker="Pilot Markets"
          title="Five flags going in the ground."
          tone="dark"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {["Los Angeles", "Denver", "Salt Lake", "Nashville", "Dallas–Fort Worth"].map((m) => (
              <div
                key={m}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-medium"
              >
                {m}
              </div>
            ))}
          </div>
          <p className="mt-5">
            Each market launches with one Nectar-PAY lead and one CryptoPOP lead operating as
            partners. Dallas is already spoken for (Lauren Waller, CryptoPOP).
          </p>
        </Slide>

        <Slide n={6} kicker="The Economics" title="Recurring, compounding, yours.">
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat value="$499" label="Terminal / merchant" />
            <Stat value="$19" label="Mo. subscription" />
            <Stat value="20%" label="Ambassador share" />
            <Stat value="~$196" label="1st-yr / merchant" />
          </div>
          <p>
            A regional partner takes an override on every ambassador in the territory plus direct
            economics on the merchants they personally sign. 100 merchants = a real business.
            1,000 = a market position.
          </p>
        </Slide>

        <Slide n={7} kicker="The Launch Plan" title="80 days from signing to self-sustaining.">
          <ol>
            <li>
              <strong>Weeks 1–2:</strong> Hire and train 5 founding ambassadors. Identify 50
              sponsor-able community events.
            </li>
            <li>
              <strong>Weeks 3–6:</strong> Sign first 10 anchor merchants. Begin distributing
              CryptoPOP launch coupons (100/day).
            </li>
            <li>
              <strong>Weeks 7–10:</strong> Host 2 original events per week. Activate the merchant
              referral bounty ($50 + 50 POP).
            </li>
            <li>
              <strong>Weeks 11–12:</strong> Leaderboard goes live. Tiered rewards (shirts, NFC
              rings) ship to top participants.
            </li>
            <li>
              <strong>Day 80:</strong> Coupon fund fully deployed. Organic POP economy carries the
              market.
            </li>
          </ol>
        </Slide>

        <Slide
          n={8}
          kicker="The Vision"
          title="The largest crypto payment network in the world — built block by block."
          tone="honey"
        >
          <p>
            Bitay processes ~220 in-person crypto transactions per day, globally. One coffee shop
            on a busy block does more card transactions than that. Our ceiling is the entire daily
            volume of Main Street. Yours is your city.
          </p>
        </Slide>

        <Slide
          n={9}
          kicker="Next Step"
          title="A 30-minute conversation with Tim."
          tone="dark"
        >
          <p>
            Bring (1) the list of community events you'd sponsor in your first quarter, and (2)
            the names of the first three ambassadors you'd recruit. That's the interview.
          </p>
        </Slide>
      </DocBody>
    </>
  );
}
