import * as React from 'react'
import { Button, Link, Section, Text } from '@react-email/components'
import { EmailShell, EmailHr, styles } from './_brand'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address. For the NEW-recipient half of
  // a secure email_change fanout, `email` equals the recipient (NEW).
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailShell
    preview={`Confirm your email change for ${siteName}`}
    siteName={siteName}
  >
    <Text style={styles.h1}>Confirm your email change</Text>
    <Text style={styles.text}>
      You asked to change your {siteName} email address from{' '}
      <Link href={`mailto:${oldEmail}`} style={styles.link}>
        {oldEmail}
      </Link>{' '}
      to{' '}
      <Link href={`mailto:${newEmail}`} style={styles.link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Confirm email change
      </Button>
    </Section>
    <EmailHr style={styles.hr} />
    <Text style={styles.small}>
      Didn't request this? Secure your account right away — sign in and change
      your password.
    </Text>
  </EmailShell>
)

export default EmailChangeEmail
