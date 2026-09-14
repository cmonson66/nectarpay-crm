import * as React from 'react'
import { Button, Link, Section, Text } from '@react-email/components'
import { EmailShell, EmailHr, styles } from './_brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailShell
    preview={`Confirm your email for ${siteName}`}
    siteName={siteName}
  >
    <Text style={styles.h1}>Welcome to the hive</Text>
    <Text style={styles.text}>
      Thanks for signing up for{' '}
      <Link href={siteUrl} style={styles.link}>
        <strong>{siteName}</strong>
      </Link>
      . One quick step — confirm{' '}
      <Link href={`mailto:${recipient}`} style={styles.link}>
        {recipient}
      </Link>{' '}
      is really yours.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Confirm my email
      </Button>
    </Section>
    <EmailHr style={styles.hr} />
    <Text style={styles.small}>
      Didn't create an account? You can safely ignore this email.
    </Text>
  </EmailShell>
)

export default SignupEmail
