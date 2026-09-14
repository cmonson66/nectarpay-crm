import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader, Stat } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/training/sales-reps")({
  head: () => ({
    meta: [
      { title: "Sales Rep Field Manual · Nectar-PAY" },
      {
        name: "description",
        content:
          "The complete Nectar-PAY sales rep playbook — pipeline, conversation arc, objections, pricing, and how to build a recurring portfolio.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Training Manual · Ambassadors & Sales Reps"
        title="The field manual."
        lede="Everything you need to confidently introduce Nectar-PAY to local businesses — and onboard merchants who stay. Read it once cover to cover. Keep the quick reference in your back pocket."
      />
      <DocBody>
        <h2>1. Your role, in one sentence</h2>
        <blockquote>
          You're not selling software. You're handing local businesses a faster, fairer way to get
          paid — and a customer traffic engine they didn't have yesterday.
        </blockquote>

        <h2>2. The elevator pitch</h2>
        <p className="text-lg">
          <em>
            "Nectar-PAY is a terminal that lets your shop accept crypto. No card fee, no
            chargebacks, money lands instantly in your wallet. And it plugs you into a rewards app
            that sends you new customers. $499 terminal, $19 a month."
          </em>
        </p>

        <h2>3. Where prospects come from</h2>
        <ol>
          <li>
            <strong>Your wallet</strong> — every business you already give money to.
          </li>
          <li>
            <strong>Walk-ins</strong> — main streets, food halls, farmers markets.
          </li>
          <li>
            <strong>Referrals</strong> — from every onboarded merchant, every time.
          </li>
          <li>
            <strong>CryptoPOP events</strong> — the owner of the venue is your warmest lead.
          </li>
          <li>
            <strong>Community boards</strong> — local subreddits, Facebook groups, Nextdoor.
          </li>
          <li>
            <strong>Industry meetups</strong> — restaurant associations, salon expos.
          </li>
          <li>
            <strong>Cold canvassing</strong> — Tuesday 10am–noon, two blocks at a time.
          </li>
        </ol>

        <h2>4. The conversation arc (5 minutes)</h2>
        <ol>
          <li>
            <strong>0:00 — Open.</strong> "Quick one — what are you paying on cards right now? 2 or
            3 percent?"
          </li>
          <li>
            <strong>0:45 — Listen.</strong> Let them complain. They will.
          </li>
          <li>
            <strong>1:30 — Show.</strong> Pull out the merchant deck. Hit the four pain points.
          </li>
          <li>
            <strong>3:00 — Math.</strong> Plug in their volume. Show the annual savings.
          </li>
          <li>
            <strong>4:00 — Price.</strong> "$499 terminal, $19 a month. First year about $727."
            Then shut up.
          </li>
          <li>
            <strong>5:00 — Ask.</strong> "Want me to set you up this week?"
          </li>
        </ol>

        <h2>5. The six objections you'll hear</h2>
        <h3>"I don't take crypto."</h3>
        <p>
          → "Right — that's the whole point. There are 700 million crypto holders looking for
          places to spend. You'd be the first on this block."
        </p>
        <h3>"Sounds risky."</h3>
        <p>
          → "The terminal auto-converts to dollars the second the payment lands, if you want. Zero
          exposure."
        </p>
        <h3>"Too expensive."</h3>
        <p>
          → "$499 is one month of card fees on $20k in volume. After that the savings are yours."
        </p>
        <h3>"My customers won't use it."</h3>
        <p>
          → "That's exactly what CryptoPOP solves. The app actively sends crypto-paying customers
          to merchants like you."
        </p>
        <h3>"I need to think about it."</h3>
        <p>
          → "Of course. What's the one thing you'd want to be sure of before saying yes? Let's
          settle that now."
        </p>
        <h3>"Talk to my partner."</h3>
        <p>→ "Smart. Can I leave the one-pager and book ten minutes with both of you Thursday?"</p>

        <h2>6. Pricing</h2>
        <div className="not-prose my-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat value="$499" label="Terminal · one-time" />
          <Stat value="$19/mo" label="Subscription" />
          <Stat value="$727" label="Year 1 total" />
          <Stat value="$228" label="Year 2+ /yr" />
        </div>
        <p>
          If the merchant balks at the service fee, you have one alternative:{" "}
          <strong>$250 in gift certificates</strong> in lieu of year-one subscription. Those
          certificates fuel the CryptoPOP rewards economy back into their door.
        </p>

        <h2>7. What you earn</h2>
        <div className="not-prose my-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat value="20%" label="Recurring · year 1" />
          <Stat value="~$196" label="Est. 1st-yr / merchant" />
          <Stat value="$50" label="Bounty per referral" />
        </div>
        <p>
          Chasers chase. Builders compound. Sign 5 merchants a month for a year and you've built
          ~$1k/mo in recurring revenue, without selling anything new in year two.
        </p>

        <h2>8. The onboarding checklist</h2>
        <p>
          See the <em>Merchant Onboarding</em> manual for the full eight-step flow. Never skip
          step 8 — book the 7-day check-in before you leave the shop.
        </p>

        <h2>9. After the sale</h2>
        <ul>
          <li>Day 3, day 7, day 14, day 30 follow-up cadence.</li>
          <li>Ask for the testimonial in week two.</li>
          <li>Ask for the referral every single visit.</li>
          <li>Push at least one CryptoPOP event toward their door in the first month.</li>
        </ul>

        <h2>10. Six habits of a great ambassador</h2>
        <ul>
          <li>
            <strong>Show up early.</strong> The shop's quietest hour is your best window.
          </li>
          <li>
            <strong>Listen more than you pitch.</strong> The objection you address is the sale you
            close.
          </li>
          <li>
            <strong>Follow up like a professional.</strong> Calendar invites, not "I'll text you
            sometime."
          </li>
          <li>
            <strong>Build the relationship before the portfolio.</strong> Merchants stay for
            people, not platforms.
          </li>
          <li>
            <strong>Stay honest.</strong> Never overstate features or savings. Show the math.
          </li>
          <li>
            <strong>Stay compliant.</strong> No tax, legal, or investment advice — refer to a pro.
          </li>
        </ul>

        <h2>11. Quick reference card</h2>
        <ul>
          <li>Elevator pitch — committed to memory by week one.</li>
          <li>Merchant deck link — saved to your home screen.</li>
          <li>Support: ping your market lead in the community channel.</li>
          <li>
            Daily target: <strong>10 conversations, 3 demos booked, ∞ referrals requested.</strong>
          </li>
        </ul>
      </DocBody>
    </>
  );
}
