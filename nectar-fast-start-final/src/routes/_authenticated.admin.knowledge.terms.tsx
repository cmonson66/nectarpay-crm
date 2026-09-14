import { createFileRoute } from "@tanstack/react-router";
import { DocBody, DocHeader } from "@/components/knowledge-shell";

export const Route = createFileRoute("/_authenticated/admin/knowledge/terms")({
  head: () => ({
    meta: [
      { title: "Terms · Nectar-PAY" },
      {
        name: "description",
        content:
          "Internal draft of Nectar-PAY terms of service — for review by ambassadors and operators.",
      },
    ],
  }),
  component: () => (
    <>
      <DocHeader
        eyebrow="Legal · Draft v1.0"
        title="Terms of Service"
        lede="This is a working draft for internal review. Final terms will be reviewed by counsel before public publication."
      />
      <DocBody>
        <p className="text-sm italic">Last updated: pilot launch · draft</p>

        <h2>1. Acceptance</h2>
        <p>
          By accessing the Nectar-PAY terminal, the CryptoPOP application, or any associated
          service ("Services"), you agree to these terms. If you do not agree, do not use the
          Services.
        </p>

        <h2>2. The Service</h2>
        <p>
          Nectar-PAY provides hardware and software that enables in-person merchants to accept
          cryptocurrency payments. Payments are processed on the underlying blockchain network and
          routed non-custodially to the merchant's designated wallet. Nectar-PAY does not at any
          time take custody of funds.
        </p>

        <h2>3. Merchant responsibilities</h2>
        <ul>
          <li>
            Maintain the security of the wallet recovery phrase. Lost phrases cannot be recovered
            by Nectar-PAY.
          </li>
          <li>
            Comply with all applicable tax and reporting obligations in the merchant's
            jurisdiction.
          </li>
          <li>Maintain accurate business information in the CryptoPOP merchant directory.</li>
        </ul>

        <h2>4. Fees</h2>
        <p>
          Hardware is sold at the stated price. Subscription fees are billed monthly. Network
          (blockchain) fees are passed through and are not retained by Nectar-PAY.
        </p>

        <h2>5. Ambassador program</h2>
        <p>
          Ambassadors are independent contractors, not employees. Commissions are paid on
          confirmed, active merchant subscriptions per the rates published in the Ambassador
          Playbook. Earnings projections shown in training material are illustrative and not
          guaranteed.
        </p>

        <h2>6. CryptoPOP rewards</h2>
        <p>
          POP points are an in-app loyalty currency with no cash value outside the CryptoPOP
          ecosystem. Rewards, gift certificates, and physical items are subject to availability
          and may be modified at any time.
        </p>

        <h2>7. No financial advice</h2>
        <p>
          Nothing in the Services constitutes investment, tax, or legal advice. Users are
          responsible for their own decisions and should consult appropriate professionals.
        </p>

        <h2>8. Disclaimers</h2>
        <p>
          The Services are provided "as is" without warranties of any kind, express or implied.
          Cryptocurrency transactions are irreversible.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Nectar-PAY's liability is limited to the fees
          paid to Nectar-PAY in the twelve months preceding the claim.
        </p>

        <h2>10. Changes</h2>
        <p>
          We may update these terms. Material changes will be communicated to active merchants and
          ambassadors at least 30 days in advance.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about these terms: <strong>sales@nectar-pay.com</strong>.
        </p>
      </DocBody>
    </>
  ),
});
