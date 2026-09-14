import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader, Slide, Stat } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/pitch/consumers")({
  head: () => ({
    meta: [
      { title: "CryptoPOP for Consumers" },
      {
        name: "description",
        content:
          "Earn POP for showing up, paying with crypto, and bringing your friends. Spend it at the local shops you already love.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <DocHeader
        eyebrow="Pitch Deck · Consumers"
        title="Get rewarded for showing up."
        lede="CryptoPOP turns every coffee, beer, and meet-up into POP — points you can spend at the same local businesses that earned you them."
      />
      <DocBody>
        <Slide
          n={1}
          kicker="The Pitch"
          title="Loyalty for your whole town, not just one store."
          tone="honey"
        >
          <p>
            Punch cards are dead. CryptoPOP is one app, one wallet, one leaderboard — across every
            Nectar-PAY merchant in your city. Show up, pay, earn. Spend it anywhere on the map.
          </p>
        </Slide>

        <Slide n={2} kicker="How to Earn POP" title="Five ways to stack points.">
          <div className="mb-2 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat value="+10" label="Sign up" />
            <Stat value="+10" label="Attend event" />
            <Stat value="+10" label="Bring a friend" />
            <Stat value="+1" label="Per $1 spent" />
            <Stat value="+50" label="Refer a merchant" />
          </div>
          <p>
            Plus a <strong>$50 cash bonus</strong> every time a merchant you referred signs up to
            Nectar-PAY.
          </p>
        </Slide>

        <Slide n={3} kicker="What You Spend It On" title="Real rewards from real shops.">
          <ul>
            <li>Free coffee, pizza, drinks — from launch-week sponsor merchants.</li>
            <li>Tiered unlocks: branded shirts, NFC rings, hardware wallets.</li>
            <li>Daily leaderboard prizes for top point holders.</li>
            <li>Gift certificates from member merchants — funded by the businesses themselves.</li>
          </ul>
        </Slide>

        <Slide n={4} kicker="The App" title="Wallet, scoreboard, map." tone="dark">
          <ul>
            <li>
              <strong>Wallet</strong> — hold and spend crypto at any Nectar-PAY terminal.
            </li>
            <li>
              <strong>Scoreboard</strong> — see where you rank in your city today.
            </li>
            <li>
              <strong>Map</strong> — every member merchant near you, sorted by reward.
            </li>
            <li>
              <strong>Events</strong> — trivia nights, league nights, meet-ups happening this
              week.
            </li>
          </ul>
        </Slide>

        <Slide n={5} kicker="Events" title="We meet you where you already are.">
          <p>
            CryptoPOP hijacks the social calendar — poker nights, bowling leagues, trivia, run
            clubs. We sponsor the round. You earn POP for showing up, and another 10 POP for every
            friend you drag along.
          </p>
        </Slide>

        <Slide
          n={6}
          kicker="Why It Matters"
          title="Your dollars stay local. So do the rewards."
        >
          <p>
            Every time you pay with CryptoPOP at a member merchant, the shop keeps more of the
            sale (no card fee), you earn POP, and the rewards economy compounds. It's the
            opposite of an airline points program — designed for your neighborhood, not a hedge
            fund.
          </p>
        </Slide>

        <Slide
          n={7}
          kicker="Become an Ambassador"
          title="Turn POP into a real side hustle."
        >
          <p>
            If you can introduce Nectar-PAY to a local business, we'll pay you for it.{" "}
            <strong>50 POP + $50 cash</strong> per merchant signup. The Ambassador track turns
            regulars into a localized sales force.
          </p>
        </Slide>

        <Slide n={8} kicker="Get Started" title="Three steps. Two minutes." tone="honey">
          <ol>
            <li>
              Download the CryptoPOP app. <strong>+10 POP.</strong>
            </li>
            <li>
              RSVP to your first sponsored event. <strong>+10 POP.</strong>
            </li>
            <li>
              Bring a friend. <strong>+10 more POP.</strong>
            </li>
          </ol>
        </Slide>
      </DocBody>
    </>
  );
}
