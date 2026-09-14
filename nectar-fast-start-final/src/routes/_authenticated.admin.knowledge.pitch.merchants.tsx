import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader, Slide, Stat } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/pitch/merchants")({
  head: () => ({
    meta: [
      { title: "Nectar-PAY for Merchants" },
      {
        name: "description",
        content:
          "Accept crypto in person. No card fee, no chargebacks, instant settlement, plus a customer traffic engine built in.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Pitch Deck · Merchants"
        title="Sweeten every transaction."
        lede="A simple terminal that accepts crypto right at checkout — funds land directly in your wallet, no middleman holding your money."
      />
      <DocBody>
        <Slide
          n={1}
          kicker="The Problem"
          title="Every day, payments quietly cost you money."
          tone="honey"
        >
          <ul>
            <li>
              <strong>2–3% card fees</strong> skimmed off every single sale.
            </li>
            <li>
              <strong>Days</strong> of waiting to receive your own money.
            </li>
            <li>
              <strong>Chargebacks</strong> pulled back weeks after the sale is done.
            </li>
            <li>
              <strong>Crypto customers</strong> you currently have to turn away.
            </li>
          </ul>
        </Slide>

        <Slide
          n={2}
          kicker="The Opportunity"
          title="Crypto is going mainstream. Almost nobody takes it in person."
        >
          <p>
            Customer demand has grown five years running. Acceptance hasn't followed. The
            merchant who installs first becomes the destination for the entire local crypto
            community.
          </p>
        </Slide>

        <Slide n={3} kicker="What It Is" title="A terminal. A wallet. Done.">
          <ol>
            <li>Customer taps to pay with crypto.</li>
            <li>Funds go straight to your merchant wallet.</li>
            <li>Transaction settles in seconds.</li>
            <li>Hold it, spend it, or convert — your call.</li>
          </ol>
          <p className="mt-3">
            <strong>Non-custodial by design.</strong> Nectar-PAY never touches your money.
          </p>
        </Slide>

        <Slide n={4} kicker="Why Merchants Care" title="Six benefits, no asterisks.">
          <ul>
            <li>
              <strong>Lower payment costs</strong> — no traditional card fee on crypto sales.
            </li>
            <li>
              <strong>Instant settlement</strong> — seconds, not three business days.
            </li>
            <li>
              <strong>No chargebacks</strong> — final means final.
            </li>
            <li>
              <strong>Easy crypto acceptance</strong> — the terminal handles the hard part.
            </li>
            <li>
              <strong>New engagement</strong> — connect with motivated, tech-forward customers.
            </li>
            <li>
              <strong>New traffic via CryptoPOP</strong> — rewards bring people through your door.
            </li>
          </ul>
        </Slide>

        <Slide
          n={5}
          kicker="Side By Side"
          title="The difference at a glance."
          tone="dark"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/15 p-5">
              <div className="text-xs uppercase tracking-wider text-white/50">Credit Cards</div>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li>· 2–3% transaction fees</li>
                <li>· Chargeback risk</li>
                <li>· Delayed settlement</li>
                <li>· Bank dependency</li>
              </ul>
            </div>
            <div className="rounded-lg border border-honey/40 bg-honey/10 p-5">
              <div className="text-xs uppercase tracking-wider text-honey">Nectar-PAY</div>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li>· No traditional card fee</li>
                <li>· No chargebacks</li>
                <li>· Instant wallet settlement</li>
                <li>· Direct merchant control</li>
              </ul>
            </div>
          </div>
        </Slide>

        <Slide n={6} kicker="Pricing" title="One small investment.">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Stat value="$499" label="Terminal · one-time" />
            <Stat value="$19/mo" label="Service & support" />
          </div>
          <p>
            First year ≈ <strong>$727</strong>. After year one ≈ <strong>$228/yr</strong>. A small
            cost to unlock crypto payments — and the new customer traffic that comes with them.
          </p>
        </Slide>

        <Slide n={7} kicker="Built-In Traffic" title="Meet CryptoPOP — your customer engine.">
          <p>
            CryptoPOP rewards people for visiting participating businesses and paying with
            crypto. Real incentives bring new faces through your door — and keep them coming back.
          </p>
          <ul>
            <li>
              <strong>Incentivized visits</strong> point crypto users to local businesses like
              yours.
            </li>
            <li>
              <strong>Earned rewards</strong> as they pay make your checkout the better choice.
            </li>
            <li>
              <strong>Repeat traffic</strong> turns first visits into regulars.
            </li>
          </ul>
        </Slide>

        <Slide n={8} kicker="Real World" title="A local coffee shop, sweetened.">
          <ol>
            <li>Signs up for Nectar-PAY.</li>
            <li>CryptoPOP sends new customers through the door.</li>
            <li>Customers earn rewards while they buy.</li>
            <li>The shop saves on payment fees.</li>
            <li>Some become repeat regulars.</li>
          </ol>
        </Slide>

        <Slide n={9} kicker="Who It's For" title="If you take payments, you can take crypto.">
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            {[
              "Coffee shops",
              "Restaurants",
              "Salons",
              "Retail stores",
              "Churches & nonprofits",
              "Event venues",
              "Service businesses",
              "Crypto-friendly merchants",
            ].map((t) => (
              <div key={t} className="rounded-md border border-border bg-comb/40 px-3 py-2">
                {t}
              </div>
            ))}
          </div>
        </Slide>

        <Slide
          n={10}
          kicker="The Ask"
          title="Be one of the first Nectar-PAY merchants in your city."
          tone="honey"
        >
          <p>
            Start accepting crypto. Save on fees. Reward your customers. Sweeten every
            transaction.
          </p>
          <p className="mt-3 text-sm">
            <strong>nectar-pay.com</strong> · sales@nectar-pay.com
          </p>
        </Slide>
      </DocBody>
    </>
  );
}
