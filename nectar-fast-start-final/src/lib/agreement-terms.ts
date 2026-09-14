/**
 * Single source of truth for the customer-facing agreement text.
 *
 * Both the signing step in the Log Sale modal and the generated PDF
 * (`deal-documents.server.ts`) render these sections, so the merchant signs
 * exactly what the filed document says.
 */

export type AgreementSection = [title: string, body: string];

export const agreementMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function trialAgreementSections(input: {
  serial: string;
  trialStart: string;
  trialEnd: string;
  trialDays: number;
  hardwareAmount: number;
  subscriptionMonthly: number;
}): AgreementSection[] {
  return [
    [
      "1. What is provided",
      `NectarPay loans the Merchant one payment terminal, serial ${input.serial}, for a trial. The terminal includes its built-in receipt printer and handheld. The Merchant supplies the internet connection and the thermal receipt paper.`,
    ],
    [
      "2. How long",
      `The trial runs ${input.trialStart} through ${input.trialEnd} (${input.trialDays} days). Either party may end it earlier by telling the other.`,
    ],
    [
      "3. What it costs",
      "Nothing. No terminal charge, no monthly subscription, and no percentage of any sale for the length of the trial.",
    ],
    [
      "4. Who owns the terminal",
      "The terminal remains the property of NectarPay throughout the trial. Ownership does not pass to the Merchant unless and until the Merchant purchases it.",
    ],
    [
      "5. The Merchant's money",
      "Payments settle directly to a cryptocurrency wallet the Merchant owns and controls. NectarPay does not hold, custody, or have access to those funds at any point. Cryptocurrency payments are final and cannot be reversed or charged back.",
    ],
    [
      "6. Taking care of it",
      "The Merchant agrees to keep the terminal powered and reasonably secure, not to open or modify it, and to tell NectarPay promptly if it is lost, stolen, or damaged.",
    ],
    [
      "7. Warranty, and if it is not returned",
      `The terminal carries a one-year warranty. If it stops working on its own, NectarPay replaces it at no cost to the Merchant. The warranty does not cover damage the Merchant causes. If the terminal is not returned at the end of the trial, or comes back damaged beyond normal use, the Merchant agrees to pay the ${agreementMoney(input.hardwareAmount)} replacement cost.`,
    ],
    [
      "8. When the trial ends",
      `The Merchant either continues on the standard terms (${agreementMoney(input.hardwareAmount)} for the terminal, plus ${agreementMoney(input.subscriptionMonthly)} per month for the membership paid up front for the year, flat, with no percentage of sales) or returns the terminal within five business days.`,
    ],
    [
      "9. No advice",
      "NectarPay does not provide tax, legal, or investment advice. The value of cryptocurrency can change. The Merchant decides what to hold and what to convert.",
    ],
    [
      "10. Existing card processing",
      "This trial does not change or replace the Merchant's current card processing. Cards keep working exactly as they do today.",
    ],
    [
      "11. Signing electronically",
      "By signing below the Merchant agrees to sign this agreement electronically, agrees that the electronic signature has the same effect as a handwritten one, and agrees to receive a copy by email.",
    ],
  ];
}

export function purchaseAgreementSections(input: {
  serial: string;
  hardwareAmount: number;
  subscriptionMonthly: number;
  subscriptionMonths: number;
  totalAmount: number;
  paymentMethod?: string | null;
}): AgreementSection[] {
  const { serial, hardwareAmount, subscriptionMonthly, subscriptionMonths } = input;
  const firstYear = hardwareAmount + subscriptionMonthly * subscriptionMonths;
  const lines = [
    `- 1 x NectarPay Terminal at ${agreementMoney(hardwareAmount)} one time (serial ${serial})`,
    ...(subscriptionMonthly > 0
      ? [`- 1 x Membership (billed annually) at ${agreementMoney(subscriptionMonthly)} per month`]
      : []),
    subscriptionMonthly > 0
      ? `Paid today: ${agreementMoney(hardwareAmount)}. Membership: ${agreementMoney(subscriptionMonthly)} per month, paid up front for the year. First twelve months, all in: ${agreementMoney(firstYear)}.`
      : `Paid today: ${agreementMoney(input.totalAmount || hardwareAmount)}.`,
    ...(input.paymentMethod ? [`Payment method: ${input.paymentMethod}.`] : []),
  ];

  return [
    ["1. What the Merchant is buying", lines.join("\n")],
    [
      "2. No percentage of sales",
      "NectarPay takes no percentage of any sale, ever. The membership price above is the whole cost of the service.",
    ],
    [
      "3. The Merchant's money",
      "Payments settle directly to a cryptocurrency wallet the Merchant owns and controls. NectarPay does not hold, custody, or have access to those funds at any point. Cryptocurrency payments are final and cannot be reversed or charged back.",
    ],
    [
      "4. What the terminal includes",
      "The terminal ships with its built-in receipt printer and handheld. The Merchant supplies the internet connection and the thermal receipt paper.",
    ],
    [
      "5. Ownership and warranty",
      "The terminal belongs to the Merchant once paid for. It carries a one-year warranty from the date of this agreement: if it stops working on its own, NectarPay replaces it at no cost. The warranty does not cover damage the Merchant causes.",
    ],
    [
      "6. The membership",
      "The membership is what powers the terminal hardware and is billed a year at a time. If the membership lapses, the terminal stops processing. The Merchant may move to a higher support tier at any time.",
    ],
    [
      "7. Cancelling",
      "The Merchant may stop the membership at the end of any paid year by telling NectarPay before it renews. The terminal is the Merchant's to keep. Payments already settled to the Merchant's wallet are unaffected.",
    ],
    [
      "8. No advice",
      "NectarPay does not provide tax, legal, or investment advice. The value of cryptocurrency can change. The Merchant decides what to hold and what to convert.",
    ],
    [
      "9. Existing card processing",
      "This purchase does not change or replace the Merchant's current card processing. Cards keep working exactly as they do today.",
    ],
    [
      "10. Signing electronically",
      "By signing below the Merchant agrees to sign this agreement electronically, agrees that the electronic signature has the same effect as a handwritten one, and agrees to receive a copy by email.",
    ],
  ];
}
