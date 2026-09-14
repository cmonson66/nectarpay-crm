import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'
import { EmailShell, EmailHr, styles } from './_brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <EmailShell
    preview={`Reset your password for ${siteName}`}
    siteName={siteName}
  >
    <Text style={styles.h1}>Reset your password</Text>
    <Text style={styles.text}>
      We got a request to reset your {siteName} password. Tap the button below
      to choose a new one.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Reset password
      </Button>
    </Section>
    <EmailHr style={styles.hr} />
    <Text style={styles.small}>
      Didn't ask for this? You can safely ignore this email — your password
      won't change unless you tap the button above.
    </Text>
  </EmailShell>
)

export default RecoveryEmail
