import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy · Nectar-PAY" },
      {
        name: "description",
        content: "Internal draft of the Nectar-PAY & CryptoPOP privacy policy.",
      },
    ],
  }),
  component: () => (
    <>
      <DocHeader
        eyebrow="Legal · Draft v1.0"
        title="Privacy Policy"
        lede="A plain-language draft of how Nectar-PAY and CryptoPOP handle data. Subject to review by counsel before public publication."
      />
      <DocBody>
        <p className="text-sm italic">Last updated: pilot launch · draft</p>

        <h2>What we believe about your data</h2>
        <p>
          We collect what we need to run the Services. We don't sell it. We don't use it to build
          advertising profiles. Crypto transactions are recorded on the public blockchain — that
          is outside our control by design, and is one of the reasons we built on these rails.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Merchants:</strong> business name, contact info, public wallet address,
            transaction metadata (amount, timestamp, terminal ID).
          </li>
          <li>
            <strong>CryptoPOP users:</strong> account email or phone, public wallet address, event
            RSVPs, POP balance, leaderboard activity.
          </li>
          <li>
            <strong>Ambassadors:</strong> contact info, payout details, referral activity.
          </li>
          <li>
            <strong>Site & app telemetry:</strong> standard logs, device type, IP address (used
            for security and rate-limiting only).
          </li>
        </ul>

        <h2>What we don't collect</h2>
        <ul>
          <li>Your wallet recovery phrase. Ever. We can't recover it for you.</li>
          <li>Customer identity at point of sale. Crypto payments are pseudonymous.</li>
          <li>Card numbers or banking credentials.</li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To operate the Services (process payments, award POP, send rewards).</li>
          <li>To support you (respond to questions, resolve issues).</li>
          <li>To improve the product (aggregate, de-identified analytics).</li>
          <li>To comply with legal obligations.</li>
        </ul>

        <h2>Who we share it with</h2>
        <ul>
          <li>
            Service providers we use to run the Services (hosting, email, customer support) —
            bound by data agreements.
          </li>
          <li>Regulators or law enforcement when legally required.</li>
          <li>Never: advertisers, data brokers, or third parties for marketing.</li>
        </ul>

        <h2>Your rights</h2>
        <p>
          You can request a copy of your account data, correct it, or delete it. Some records
          (transaction history) may need to be retained for legal and accounting reasons. Note:
          on-chain transactions cannot be deleted from the blockchain by anyone.
        </p>

        <h2>Security</h2>
        <p>
          We use industry-standard encryption in transit and at rest. The most important security
          control — your wallet recovery phrase — is in your hands. Keep it offline and in two
          locations.
        </p>

        <h2>Children</h2>
        <p>
          The Services are not directed to children under 13 and we do not knowingly collect data
          from them.
        </p>

        <h2>Contact</h2>
        <p>
          Questions: <strong>privacy@nectar-pay.com</strong>.
        </p>
      </DocBody>
    </>
  ),
});
