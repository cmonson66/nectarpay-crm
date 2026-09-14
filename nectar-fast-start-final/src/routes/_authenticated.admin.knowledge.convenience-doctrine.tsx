import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/convenience-doctrine")({
  head: () => ({
    meta: [
      { title: "The Convenience Doctrine · Nectar-PAY" },
      {
        name: "description",
        content:
          "Why Visa and Mastercard won — and the single bar Nectar-PAY & CryptoPOP must clear to win on Main Street.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Core Principle · Read First"
        title="The Convenience Doctrine."
        lede="Consumer incentive and convenience sit at the absolute top of our priority list. Above fees. Above ideology. Above features. If we forget this, this thing dies."
      />
      <DocBody>
        <h2>Why Visa and Mastercard actually won</h2>
        <p>
          A consumer walks into a shop. They don't think. They tap a card. It pays. The end. Game
          over. They even get a point or a mile out of it. That is the bar.
        </p>
        <p>
          The credit card networks spent <strong>billions of dollars over sixty years</strong> to
          make payment so frictionless that neither the consumer nor the merchant has to think
          about it. They did such a good job on convenience that merchants are now refusing cash —
          the 2–3% card fee is <em>less painful</em> than the cost of counting drawers, making
          deposits, and chasing change.
        </p>
        <blockquote>
          Merchants don't accept cards because they love banks. They don't accept cards because
          they love fees. They accept cards because of simplicity and convenience.
        </blockquote>

        <h2>The doctrine</h2>
        <p>
          We have to be <strong>at least as convenient</strong> as a card tap — for the merchant{" "}
          <em>and</em> the consumer — or none of the rest of our story matters. Lower fees, instant
          settlement, no chargebacks, local rewards: all of it is a rounding error if checkout
          takes one extra second of thought.
        </p>

        <h2>What this means at checkout</h2>
        <ul>
          <li>
            <strong>Tap or scan, pay, done.</strong> No app hunting, no copy-pasting addresses, no
            QR squinting in the dark.
          </li>
          <li>
            <strong>One gesture for the customer.</strong> If they have to be told what to do,
            we've already lost.
          </li>
          <li>
            <strong>One gesture for the cashier.</strong> The terminal does what their card reader
            does, in the same number of taps or fewer.
          </li>
          <li>
            <strong>No "first, let me explain crypto."</strong> Education happens off the line,
            never at the register.
          </li>
          <li>
            <strong>Receipts and rewards are automatic.</strong> POP accrues without the customer
            doing anything extra.
          </li>
        </ul>

        <h2>What this means for the merchant</h2>
        <ul>
          <li>
            <strong>Setup in minutes, not days.</strong> Out of the box to first sale should beat
            any traditional processor.
          </li>
          <li>
            <strong>Settlement they don't have to think about.</strong> Money lands. They don't
            reconcile, they don't wait, they don't worry.
          </li>
          <li>
            <strong>One number on the screen.</strong> Local currency price first. The crypto
            piece is implementation detail.
          </li>
          <li>
            <strong>Failure modes that don't strand a customer.</strong> If something hiccups, the
            fallback is obvious and fast.
          </li>
        </ul>

        <h2>What this means for the consumer</h2>
        <ul>
          <li>
            <strong>The wallet opens to "pay."</strong> Not to a portfolio, not to a chart, not to
            a news feed. Pay.
          </li>
          <li>
            <strong>Onboarding in under two minutes.</strong> Download, tap, you're in. Custodial
            training wheels are fine.
          </li>
          <li>
            <strong>Incentive is visible before the tap.</strong> "Pay here, earn X POP" — at the
            moment of decision, not buried in a menu.
          </li>
          <li>
            <strong>Rewards spend like cash.</strong> No tier charts, no blackout dates, no "see
            participating locations."
          </li>
        </ul>

        <h2>The convenience test</h2>
        <p>Every feature, every screen, every pitch is graded against three questions:</p>
        <ol>
          <li>
            Does the consumer have to think about it? <strong>If yes, fix it.</strong>
          </li>
          <li>
            Does the merchant have to explain it? <strong>If yes, fix it.</strong>
          </li>
          <li>
            Is the incentive visible <em>before</em> the moment of payment?{" "}
            <strong>If no, fix it.</strong>
          </li>
        </ol>

        <h2>What we will not do</h2>
        <ul>
          <li>Ship a checkout flow that's slower than a Visa tap.</li>
          <li>Ask the cashier to read a script to the customer.</li>
          <li>Make the consumer choose a network, a token, or a chain at the register.</li>
          <li>Gate rewards behind a multi-step claim.</li>
          <li>
            Trade convenience for ideological purity. Self-custody is the long road; the short
            road is "it just worked."
          </li>
        </ul>

        <p className="mt-10">
          Honest money only wins if it's also <em>easy</em> money to spend and accept. Every other
          page in this manual is downstream of this one.
        </p>
      </DocBody>
    </>
  );
}
