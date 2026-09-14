import * as React from 'react'
import { Button, Img, Section, Text } from '@react-email/components'
import { EmailShell, EmailHr, styles, BRAND } from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
  qrDataUrl?: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
  token,
  qrDataUrl,
}: MagicLinkEmailProps) => {
  const codeDisplay = token ? formatCode(token) : null
  return (
    <EmailShell
      preview={`Your sign-in code for ${siteName}`}
      siteName={siteName}
    >
      <Text style={styles.h1}>Sign in to {siteName}</Text>
      <Text style={styles.text}>
        Here's your one-time sign-in code. It expires in a few minutes.
      </Text>

      {codeDisplay && (
        <Section style={styles.codeBox}>
          <Text style={styles.codeLabel}>Sign-in code</Text>
          <Text style={styles.codeText}>{codeDisplay}</Text>
          <Text style={styles.codeHint}>
            Type this into the sign-in screen or POS terminal.
          </Text>
        </Section>
      )}

      <Text style={styles.text}>Signing in on this device? Tap the button:</Text>
      <Section style={styles.buttonWrap}>
        <Button style={styles.button} href={confirmationUrl}>
          Sign in to {siteName}
        </Button>
      </Section>

      {qrDataUrl && (
        <>
          <EmailHr style={styles.hr} />
          <Section style={{ textAlign: 'center' }}>
            <Text
              style={{
                ...styles.codeLabel,
                color: BRAND.slate,
                margin: '0 0 12px',
              }}
            >
              Or scan with your POS terminal
            </Text>
            <Img
              src={qrDataUrl}
              alt="Sign-in QR code"
              width="220"
              height="220"
              style={{ margin: '0 auto', display: 'block', borderRadius: '12px' }}
            />
            <Text style={styles.codeHint}>
              Point the terminal camera at this code to sign in instantly.
            </Text>
          </Section>
        </>
      )}

      <EmailHr style={styles.hr} />
      <Text style={styles.small}>
        Didn't request this? You can safely ignore this email — nobody can sign
        in without the code above.
      </Text>
    </EmailShell>
  )
}

export default MagicLinkEmail

function formatCode(token: string): string {
  const clean = token.trim()
  const mid = Math.ceil(clean.length / 2)
  return `${clean.slice(0, mid)} ${clean.slice(mid)}`.trim()
}

export function buildQrImageUrl(url: string): string {
  const encoded = encodeURIComponent(url)
  return `https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=10&format=png&data=${encoded}`
}

/**
 * @deprecated Use buildQrImageUrl - returns an absolute https URL that email clients reliably render.
 */
export async function buildQrDataUrl(url: string): Promise<string | undefined> {
  return buildQrImageUrl(url)
}
