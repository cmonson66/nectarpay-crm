import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader, Stat } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/executive-summary")({
  head: () => ({
    meta: [
      { title: "Executive Summary · Nectar-PAY" },
      {
        name: "description",
        content:
          "Nectar-PAY & CryptoPOP — the strategy, the numbers, and the playbook to become the largest crypto payment network on Main Street.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Executive Summary · v1.0"
        title="Honest money for Main Street."
        lede="Nectar-PAY accepts crypto in person, in seconds, with no fees and no chargebacks. CryptoPOP rewards the customers who show up. Together they form the consumer + merchant flywheel of the honest.money ecosystem."
      />
      <DocBody>
        <div className="not-prose mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat value="741M" label="Crypto holders ('25)" />
          <Stat value="2–4%" label="Card fees we replace" />
          <Stat value="$499" label="Terminal · one-time" />
          <Stat value="5" label="Pilot markets" />
        </div>

        <div className="not-prose mb-8 rounded-lg border-l-4 border-honey bg-honey/10 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-honey-deep">
            Prime Directive
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            <strong>
              Consumer incentive and convenience come first — above fees, above ideology, above
              features.
            </strong>{" "}
            Visa won by making the tap thoughtless. We have to clear the same bar for the merchant
            and the customer, or none of this works.{" "}
            <a
              href="/admin/knowledge/convenience-doctrine"
              className="text-honey-deep underline underline-offset-4"
            >
              Read the Convenience Doctrine →
            </a>
          </p>
        </div>

        <h2>The thesis</h2>
        <p>
          Card processing is a 60-year-old tax on local commerce. 2–4% per swipe, two-to-three day
          settlement, and chargebacks weeks later. A growing base of{" "}
          <strong>741M crypto holders</strong> wants to spend — and almost no Main Street merchant
          can accept them. We close that gap.
        </p>

        <h2>The two products, one flywheel</h2>
        <ul>
          <li>
            <strong>Nectar-PAY</strong> — a $499 in-person terminal + $19/mo service that drops
            crypto directly into the merchant's non-custodial wallet. No card fee. No chargebacks.
            Instant.
          </li>
          <li>
            <strong>CryptoPOP</strong> — a consumer wallet + rewards layer. Users earn POP for
            attending events, paying at member merchants, and recruiting new businesses. Merchants
            get a stream of motivated, repeat customers.
          </li>
        </ul>

        <h2>Go-to-market: regional franchises</h2>
        <p>
          We're not building a sales org from a single HQ. Each pilot market —
          <strong> LA, Denver, Salt Lake, Nashville, Dallas–Fort Worth</strong> — gets a local
          Nectar-PAY + CryptoPOP leadership pair operating as a franchise. They own the territory,
          recruit ambassadors, run events, and share in the recurring revenue they generate.
        </p>

        <h2>Unit economics (pilot)</h2>
        <ul>
          <li>
            Terminal: <strong>$499</strong> one-time · Subscription: <strong>$19/mo</strong> ·
            First-year merchant cost ≈ <strong>$727</strong>.
          </li>
          <li>
            Ambassador commission: <strong>20%</strong> recurring on subscription, year one —
            roughly <strong>$196 per merchant</strong> in first-year earnings.
          </li>
          <li>
            Year-one acquisition incentive:{" "}
            <strong>$250 in merchant gift certificates</strong> in lieu of service fees, recycled
            as CryptoPOP rewards.
          </li>
        </ul>

        <h2>What CryptoPOP launches with</h2>
        <ul>
          <li>
            <strong>$24,000 bootstrap fund</strong> to seed coupons (free coffee, free pizza) to
            100 people/day across 80 days per market.
          </li>
          <li>
            <strong>Event hijack model</strong> — sponsor existing poker nights, trivia, leagues;
            host two original events per week per market.
          </li>
          <li>
            <strong>POP scoring</strong> — 10 POP for sign-up, 10 for event attendance, 10 per
            friend brought, 1 POP per $1 spent at a member merchant, 50 POP + $50 cash per
            merchant referral.
          </li>
        </ul>

        <h2>Why now</h2>
        <p>
          On-ramps are mainstream, fees on modern rails are negligible, and a generation of
          customers expects to pay — and be rewarded — in crypto. The competitor terminal on the
          next block still can't take their money. Twelve months from now, that's no longer true.
          We want to be the rails when it isn't.
        </p>

        <h2>What we're asking for</h2>
        <ul>
          <li>
            <strong>Regional partners</strong> — operators in each pilot market to lead Nectar-PAY
            and CryptoPOP locally.
          </li>
          <li>
            <strong>Ambassadors</strong> — community members who want to earn recurring income
            building a portfolio of local merchants.
          </li>
          <li>
            <strong>Anchor merchants</strong> — the first ten yes-es in each market that anchor
            the rewards map.
          </li>
        </ul>

        <blockquote>
          Honest money, built for the people who actually use it. — Bobby Gray, Founder
        </blockquote>
      </DocBody>
    </>
  );
}
