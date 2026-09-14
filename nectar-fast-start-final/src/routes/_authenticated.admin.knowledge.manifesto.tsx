import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/manifesto")({
  head: () => ({
    meta: [
      { title: "Manifesto · Honest Money" },
      {
        name: "description",
        content:
          "What we believe about money, merchants, and Main Street — the Nectar-PAY & honest.money manifesto.",
      },
    ],
  }),
  component: () => (
    <>
      <DocHeader
        eyebrow="Manifesto"
        title="Honest money, built for the people who actually use it."
        lede="A short statement of what we believe — and what we refuse to do — as we build the rails for the next era of local commerce."
      />
      <DocBody>
        <h2>We believe money should be fast.</h2>
        <p>
          If a customer hands a merchant value, that value should land in the merchant's account
          before the customer is out the door. Three business days is a relic of an older
          internet.
        </p>

        <h2>We believe money should be fair.</h2>
        <p>
          A 2–4% tax on every transaction, taken by a chain of intermediaries the merchant never
          meets, is not the cost of doing business. It is the cost of an older arrangement we are
          no longer obligated to accept.
        </p>

        <h2>We believe money should be final.</h2>
        <p>
          Chargebacks turned the honest merchant into the underwriter of every dispute. A
          completed payment should stay completed. Refunds are an act of the merchant, not the
          network.
        </p>

        <h2>We believe money should be local.</h2>
        <p>
          The dollars that change hands in a town should reward the people in that town.
          CryptoPOP is our answer to a loyalty system designed for hedge funds — a rewards
          economy that compounds for the neighborhood, not the airline.
        </p>

        <h2>We believe in the operator.</h2>
        <p>
          Coffee shops, salons, restaurants, churches, mechanics, makers. The people who unlock
          the door at 6am and lock it at 9pm. We are here because they deserve a better deal —
          and because no one else is going to give it to them.
        </p>

        <h2>We refuse to hold the money.</h2>
        <p>
          Nectar-PAY is non-custodial. Payments go directly from customer to merchant. We never
          touch the funds. That is not a feature — it is a principle.
        </p>

        <h2>We refuse to gate the future.</h2>
        <p>
          The technology stack — TEXITcoin, the Omni layer, the open-source bones of the wallet —
          is documented and accessible to anyone who wants to build with it. Honest money is not
          a moat. It is a commons.
        </p>

        <h2>We refuse to sell what isn't true.</h2>
        <p>
          No overpromised yield. No "guaranteed" customer counts. No "set it and forget it"
          income. We show merchants the math, and we let a better deal speak for itself.
        </p>

        <p className="mt-10 text-sm">
          Part of the{" "}
          <a
            href="https://honest.money"
            target="_blank"
            rel="noopener noreferrer"
            className="text-honey-deep underline-offset-4 hover:underline"
          >
            honest.money
          </a>{" "}
          ecosystem. Built on{" "}
          <a
            href="https://texitcoin.org/build"
            target="_blank"
            rel="noopener noreferrer"
            className="text-honey-deep underline-offset-4 hover:underline"
          >
            TEXITcoin and the Omni Layer 2
          </a>
          .
        </p>
      </DocBody>
    </>
  ),
});
