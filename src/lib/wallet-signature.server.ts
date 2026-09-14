/**
 * TXC wallet signature verification.
 *
 * TEXITcoin is a Bitcoin-derivative. We verify Bitcoin-style message
 * signatures (magic-prefix + recoverable ECDSA, base64).
 *
 * This implementation is pure JavaScript using @noble/secp256k1 and
 * @noble/hashes, so it runs correctly inside the Cloudflare Worker runtime.
 * The previous bitcoinjs-message verifier silently failed in workers because
 * it depends on Node-only crypto modules.
 *
 * SPEC:
 *   - Magic prefixes: TEXITcoin/Texitcoin Signed Message:\n variants used by TXC wallets
 *   - Address: P2PKH / P2SH-P2WPKH / P2WPKH (legacy + segwit)
 *   - Message format: the raw SIWE-style string the wallet signs verbatim
 */

import bs58check from "bs58check";
import { hashes, Point, recoverPublicKey as secpRecoverPublicKey } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { hmac } from "@noble/hashes/hmac";
import { bech32 } from "@scure/base";

// @noble/secp256k1 v3 needs sync hash hooks for recoverPublicKey. Safe to set repeatedly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(hashes as any).sha256 = (msg: Uint8Array) => sha256(msg);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(hashes as any).hmacSha256 = (key: Uint8Array, msg: Uint8Array) => hmac(sha256, key, msg);

export { buildSignableMessage } from "@/lib/wallet-auth-shared";

// TXC network params. Keep in sync with the mobile wallet's src/lib/chains/index.ts.
const TXC_MESSAGE_PREFIX = "TEXITcoin Signed Message:\n";
const TXC_LEGACY_PREFIX = "\x18TEXITcoin Signed Message:\n";
const TXC_WEB_WALLET_PREFIX = "\x1aTexitcoin Signed Message:\n";
const TXC_STANDARD_PREFIX = "\x1aTEXITcoin Signed Message:\n";
const TXC_BECH32_HRP = "txc";

function varInt(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) {
    const b = new Uint8Array(3);
    b[0] = 0xfd;
    const v = new DataView(b.buffer);
    v.setUint16(1, n, true);
    return b;
  }
  if (n <= 0xffffffff) {
    const b = new Uint8Array(5);
    b[0] = 0xfe;
    const v = new DataView(b.buffer);
    v.setUint32(1, n, true);
    return b;
  }
  throw new Error("message too long for varInt");
}

function magicHash(message: string, prefix: string): Uint8Array {
  const prefixBytes = new TextEncoder().encode(prefix);
  const messageBytes = new TextEncoder().encode(message);
  const len = varInt(messageBytes.length);
  const buf = new Uint8Array(prefixBytes.length + len.length + messageBytes.length);
  let off = 0;
  buf.set(prefixBytes, off);
  off += prefixBytes.length;
  buf.set(len, off);
  off += len.length;
  buf.set(messageBytes, off);
  return sha256(sha256(buf));
}

function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

function decodeSignature(buffer: Uint8Array) {
  if (buffer.length !== 65) throw new Error("Invalid signature length");
  const flagByte = buffer[0] - 27;
  if (flagByte > 15 || flagByte < 0) {
    throw new Error("Invalid signature parameter");
  }
  return {
    compressed: !!(flagByte & 12),
    segwitType: !(flagByte & 8)
      ? null
      : !(flagByte & 4)
        ? ("p2sh(p2wpkh)" as const)
        : ("p2wpkh" as const),
    recovery: flagByte & 3,
    signature: buffer.slice(1),
  };
}

function recoverPublicKey(
  hash: Uint8Array,
  signature: Uint8Array,
  recovery: number,
  compressed: boolean,
): Uint8Array {
  const recoveredSig = new Uint8Array(65);
  recoveredSig[0] = recovery;
  recoveredSig.set(signature, 1);
  const compressedPub = secpRecoverPublicKey(recoveredSig, hash, {
    prehash: false,
  });
  if (compressed) return compressedPub;
  return Point.fromBytes(compressedPub).toBytes(false);
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function verifyTxcSignature(opts: {
  address: string;
  message: string;
  signature: string;
}): boolean {
  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.from(atob(opts.signature), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  if (sigBytes.length !== 65) return false;

  let parsed;
  try {
    parsed = decodeSignature(sigBytes);
  } catch {
    return false;
  }

  for (const prefix of [
    TXC_MESSAGE_PREFIX,
    TXC_LEGACY_PREFIX,
    TXC_WEB_WALLET_PREFIX,
    TXC_STANDARD_PREFIX,
  ]) {
    const hash = magicHash(opts.message, prefix);
    let publicKey: Uint8Array;
    try {
      publicKey = recoverPublicKey(hash, parsed.signature, parsed.recovery, parsed.compressed);
    } catch {
      continue;
    }

    const publicKeyHash = hash160(publicKey);

    if (parsed.segwitType) {
      if (parsed.segwitType === "p2sh(p2wpkh)") {
        const redeemScript = new Uint8Array(22);
        redeemScript[0] = 0x00;
        redeemScript[1] = 0x14;
        redeemScript.set(publicKeyHash, 2);
        const redeemHash = hash160(redeemScript);
        let expected: Uint8Array;
        try {
          expected = bs58check.decode(opts.address).slice(1);
        } catch {
          continue;
        }
        if (arraysEqual(redeemHash, expected)) return true;
      } else {
        // p2wpkh
        let expected: Uint8Array;
        try {
          const decoded = bech32.decode(opts.address);
          if (decoded.prefix !== TXC_BECH32_HRP) continue;
          expected = bech32.fromWords(decoded.words.slice(1));
        } catch {
          continue;
        }
        if (arraysEqual(publicKeyHash, expected)) return true;
      }
    } else {
      // Non-segwit signature. With checkSegwitAlways=true we also accept segwit addresses
      // that resolve to the same public key hash.
      try {
        const decoded = bech32.decode(opts.address);
        if (decoded.prefix === TXC_BECH32_HRP) {
          const expected = bech32.fromWords(decoded.words.slice(1));
          if (arraysEqual(publicKeyHash, expected)) return true;
        }
      } catch {
        // Not a bech32 address — try base58 P2PKH / P2SH-P2WPKH.
        let expected: Uint8Array;
        try {
          expected = bs58check.decode(opts.address).slice(1);
        } catch {
          continue;
        }
        const redeemScript = new Uint8Array(22);
        redeemScript[0] = 0x00;
        redeemScript[1] = 0x14;
        redeemScript.set(publicKeyHash, 2);
        const redeemHash = hash160(redeemScript);
        if (arraysEqual(publicKeyHash, expected) || arraysEqual(redeemHash, expected)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Diagnostic helper: recover candidate TXC P2PKH addresses (v=0x42) the
 * signature could have come from, across both prefixes. Use only for logging
 * — never as a verification path.
 */
export function recoverAddressesFromSignature(opts: {
  message: string;
  signature: string;
}): Array<{ prefix: string; address: string }> {
  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.from(atob(opts.signature), (c) => c.charCodeAt(0));
  } catch {
    return [];
  }
  if (sigBytes.length !== 65) return [];
  let parsed;
  try {
    parsed = decodeSignature(sigBytes);
  } catch {
    return [];
  }
  const out: Array<{ prefix: string; address: string }> = [];
  for (const prefix of [
    TXC_MESSAGE_PREFIX,
    TXC_LEGACY_PREFIX,
    TXC_WEB_WALLET_PREFIX,
    TXC_STANDARD_PREFIX,
    "\x18Bitcoin Signed Message:\n",
  ]) {
    const hash = magicHash(opts.message, prefix);
    try {
      const pub = recoverPublicKey(hash, parsed.signature, parsed.recovery, parsed.compressed);
      const pkh = hash160(pub);
      const payload = new Uint8Array(21);
      payload[0] = 0x42; // TXC P2PKH version byte
      payload.set(pkh, 1);
      out.push({
        prefix: prefix.replaceAll("\x18", "\\x18").replaceAll("\x1a", "\\x1a"),
        address: bs58check.encode(payload),
      });
    } catch {
      // skip
    }
  }
  return out;
}

/**
 * Basic TXC address sanity check. Real validation happens via signature
 * verification (a bad address won't recover to the signature).
 */
export function looksLikeTxcAddress(addr: string): boolean {
  if (typeof addr !== "string") return false;
  if (addr.length < 26 || addr.length > 64) return false;
  // base58 + bech32 character set
  return /^[a-zA-Z0-9]+$/.test(addr);
}
