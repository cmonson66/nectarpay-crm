import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// Brand tokens — mirrors /brand
export const BRAND = {
  navy: '#0D1B33',
  navy2: '#132446',
  honey: '#F6A21E',
  honeyDeep: '#E8880C',
  comb: '#FAF8F3',
  mist: '#F3EEE2',
  ink: '#2B3242',
  slate: '#6A7182',
  hairline: '#E7E1D2',
}

export const fonts =
  "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', Roboto, sans-serif"

export const styles = {
  main: {
    backgroundColor: '#ffffff',
    fontFamily: fonts,
    margin: 0,
    padding: '24px 0',
  } as React.CSSProperties,
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: 0,
    backgroundColor: '#ffffff',
    borderRadius: '18px',
    overflow: 'hidden',
    border: `1px solid ${BRAND.hairline}`,
  } as React.CSSProperties,
  header: {
    backgroundColor: BRAND.navy,
    padding: '22px 28px 20px',
    borderBottom: `3px solid ${BRAND.honey}`,
  } as React.CSSProperties,
  brand: {
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: 900 as const,
    letterSpacing: '-0.01em',
    margin: 0,
    lineHeight: 1,
  } as React.CSSProperties,
  brandAccent: { color: BRAND.honey } as React.CSSProperties,
  headerTag: {
    color: '#B7C0D4',
    fontSize: '11px',
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    margin: '8px 0 0',
  } as React.CSSProperties,
  body: {
    padding: '28px 28px 24px',
    backgroundColor: '#ffffff',
  } as React.CSSProperties,
  h1: {
    fontSize: '24px',
    fontWeight: 800 as const,
    color: BRAND.navy,
    letterSpacing: '-0.01em',
    margin: '0 0 18px',
    lineHeight: 1.2,
  } as React.CSSProperties,
  text: {
    fontSize: '15px',
    color: BRAND.ink,
    lineHeight: 1.55,
    margin: '0 0 16px',
  } as React.CSSProperties,
  small: {
    fontSize: '13px',
    color: BRAND.slate,
    lineHeight: 1.55,
    margin: '0 0 12px',
  } as React.CSSProperties,
  link: { color: BRAND.honeyDeep, textDecoration: 'underline' } as React.CSSProperties,
  button: {
    display: 'inline-block',
    backgroundColor: BRAND.honey,
    backgroundImage: `linear-gradient(180deg, ${BRAND.honey} 0%, ${BRAND.honeyDeep} 100%)`,
    color: BRAND.navy,
    fontSize: '15px',
    fontWeight: 800 as const,
    letterSpacing: '0.01em',
    borderRadius: '10px',
    padding: '14px 22px',
    textDecoration: 'none',
    border: `1px solid ${BRAND.honeyDeep}`,
  } as React.CSSProperties,
  buttonWrap: { textAlign: 'center' as const, margin: '4px 0 20px' } as React.CSSProperties,
  codeBox: {
    backgroundColor: BRAND.comb,
    border: `1px solid ${BRAND.honey}`,
    borderRadius: '14px',
    padding: '22px 20px',
    textAlign: 'center' as const,
    margin: '0 0 20px',
  } as React.CSSProperties,
  codeLabel: {
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    color: BRAND.honeyDeep,
    margin: '0 0 10px',
    fontWeight: 700 as const,
  } as React.CSSProperties,
  codeText: {
    fontFamily: "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace",
    fontSize: '34px',
    fontWeight: 800 as const,
    letterSpacing: '10px',
    color: BRAND.navy,
    margin: '0 0 6px',
    lineHeight: 1,
  } as React.CSSProperties,
  codeHint: {
    fontSize: '12px',
    color: BRAND.slate,
    margin: '8px 0 0',
  } as React.CSSProperties,
  hr: {
    borderColor: BRAND.hairline,
    borderStyle: 'solid',
    borderWidth: '1px 0 0',
    margin: '20px 0',
  } as React.CSSProperties,
  footer: {
    padding: '18px 28px 22px',
    backgroundColor: BRAND.comb,
    borderTop: `1px solid ${BRAND.hairline}`,
    textAlign: 'center' as const,
  } as React.CSSProperties,
  footerTag: {
    color: BRAND.navy,
    fontSize: '13px',
    fontWeight: 700 as const,
    margin: '0 0 4px',
  } as React.CSSProperties,
  footerNote: {
    color: BRAND.slate,
    fontSize: '11px',
    lineHeight: 1.5,
    margin: '4px 0 0',
  } as React.CSSProperties,
  footerLink: { color: BRAND.honeyDeep, textDecoration: 'none' } as React.CSSProperties,
}

interface ShellProps {
  preview: string
  siteName?: string
  tagline?: string
  children: React.ReactNode
}

/** Wraps content in the branded Nectar.Pay email shell. */
export function EmailShell({
  preview,
  siteName = 'Nectar.Pay',
  tagline = 'One drop-in script. Zero card fees. Merchant-first crypto payments.',
  children,
}: ShellProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brand}>
              Nectar<span style={styles.brandAccent}>Pay</span>
            </Text>
            <Text style={styles.headerTag}>Honest money · Real merchants</Text>
          </Section>
          <Section style={styles.body}>{children}</Section>
          <Section style={styles.footer}>
            <Text style={styles.footerTag}>{tagline}</Text>
            <Text style={styles.footerNote}>
              Sent by {siteName} ·{' '}
              <Link href="https://nectar-pay.com" style={styles.footerLink}>
                nectar-pay.com
              </Link>
              {' · '}
              <Link href="https://nectar-pay.com/manifesto" style={styles.footerLink}>
                Manifesto
              </Link>
              {' · '}
              <Link href="https://nectar-pay.com/privacy" style={styles.footerLink}>
                Privacy
              </Link>
            </Text>
            <Text style={styles.footerNote}>
              Part of the{' '}
              <Link href="https://honest.money" style={styles.footerLink}>
                honest.money
              </Link>{' '}
              ecosystem.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export { Hr as EmailHr }
