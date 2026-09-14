import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { EmailShell, EmailHr, styles } from './_brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => {
  const display = formatCode(token)
  return (
    <EmailShell preview="Your Nectar.Pay verification code">
      <Text style={styles.h1}>Confirm it's you</Text>
      <Text style={styles.text}>
        Enter this code to confirm your identity:
      </Text>
      <Section style={styles.codeBox}>
        <Text style={styles.codeLabel}>Verification code</Text>
        <Text style={styles.codeText}>{display}</Text>
        <Text style={styles.codeHint}>Expires in a few minutes.</Text>
      </Section>
      <EmailHr style={styles.hr} />
      <Text style={styles.small}>
        Didn't request this? You can safely ignore this email.
      </Text>
    </EmailShell>
  )
}

export default ReauthenticationEmail

function formatCode(token: string): string {
  const clean = token.trim()
  if (clean.length < 4) return clean
  const mid = Math.ceil(clean.length / 2)
  return `${clean.slice(0, mid)} ${clean.slice(mid)}`.trim()
}
