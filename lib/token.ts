/**
 * HMAC-SHA256 correlation token utilities.
 *
 * Token format: `<base64url(body)>.<base64url(sig)>`
 * where body = JSON.stringify(TokenPayload)
 * and   sig  = HMAC-SHA256(body, FORM_TOKEN_SECRET)
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface TokenPayload {
  ticketId: number;
  nonce: string;
}

// ---------------------------------------------------------------------------
// base64url helpers
// ---------------------------------------------------------------------------

function toBase64Url(input: Buffer | string): string {
  const b64 =
    typeof input === "string"
      ? Buffer.from(input, "utf8").toString("base64")
      : input.toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(input: string): Buffer {
  // Restore standard base64 padding
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64");
}

// ---------------------------------------------------------------------------
// Internal HMAC helper — reads secret lazily (inside function)
// ---------------------------------------------------------------------------

function computeSig(body: string): Buffer {
  const secret = process.env.FORM_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "token: FORM_TOKEN_SECRET environment variable is not set."
    );
  }
  return createHmac("sha256", secret).update(body).digest();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function signToken(payload: TokenPayload): string {
  const body = toBase64Url(JSON.stringify(payload));
  const sig = toBase64Url(computeSig(body));
  return `${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex === -1) return null;

    const body = token.slice(0, dotIndex);
    const sigProvided = token.slice(dotIndex + 1);

    if (!body || !sigProvided) return null;

    const expectedSig = toBase64Url(computeSig(body));

    // Guard equal length before timingSafeEqual
    const providedBuf = Buffer.from(sigProvided, "utf8");
    const expectedBuf = Buffer.from(expectedSig, "utf8");

    if (providedBuf.length !== expectedBuf.length) return null;

    if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

    const decoded = fromBase64Url(body).toString("utf8");
    const parsed: unknown = JSON.parse(decoded);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>)["ticketId"] !== "number" ||
      typeof (parsed as Record<string, unknown>)["nonce"] !== "string"
    ) {
      return null;
    }

    const p = parsed as Record<string, unknown>;
    return {
      ticketId: p["ticketId"] as number,
      nonce: p["nonce"] as string,
    };
  } catch {
    return null;
  }
}
