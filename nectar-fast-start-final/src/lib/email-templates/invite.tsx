import * as React from 'react'
import { Button, Link, Section, Text } from '@react-email/components'
import { EmailShell, EmailHr, styles } from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <EmailShell
    preview={`You've been invited to join ${siteName}`}
    siteName={siteName}
  >
    <Text style={styles.h1}>You're invited</Text>
    <Text style={styles.text}>
      You've been invited to join{' '}
      <Link href={siteUrl} style={styles.link}>
        <strong>{siteName}</strong>
      </Link>
      . Accept below to create your account and start taking crypto payments
      — zero card fees, real settlement.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Accept invitation
      </Button>
    </Section>
    <EmailHr style={styles.hr} />
    <Text style={styles.small}>
      Weren't expecting this? You can safely ignore this email.
    </Text>
  </EmailShell>
)

export default InviteEmail
