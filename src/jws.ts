import type { Signer } from "near-api-js";
import { encodeURLSafe } from "@stablelib/base64";
import { encode } from "bs58";

const encoder = new TextEncoder();

/**
 * Options for creating a JWS string.
 */
export interface JwsOptions {
  // The accountId of the identity to use.
  accountId?: string;
  // The identifier of the network for determining signing keys.
  networkId?: string;
  // Any additional key/value pairs to include in the JWT payload.
  [key: string]: string | number | undefined;
}

/**
 * Create a JWS.
 * @param signer The signer. Any object that satisfies the Signer interface.
 * @param opts Additional options. This can include additional fields to
 * include in the JWT payload.
 * @returns A Promise that resolves to the full JWS string.
 */
export async function jws(
  signer: Signer,
  opts: JwsOptions = {}
): Promise<string> {
  const { accountId, networkId, ...extras } = opts;
  const publicKey = await signer.getPublicKey(accountId, networkId);
  // https://tools.ietf.org/html/rfc7515#section-4.1.3
  const jwk = {
    kty: "OKP",
    crv: "Ed25519",
    x: encodeURLSafe(publicKey.data),
    use: "sig",
  };
  // NOTE: EdDSASha256 is a non-standard alg type for use with sha256 hashes
  const header = { alg: "EdDSASha256", typ: "JWT", jwk };
  // UNIX origin time for current time
  const now = ~~(Date.now() / 1000);
  const oneHour = now + 60 * 10; // Default to 10 minutes
  // Compute did
  const buffer = new Uint8Array(2 + publicKey.data.length);
  buffer[0] = 0xed; // Using ed25519 by default
  buffer[1] = 0x01;
  buffer.set(publicKey.data, 2);
  // prefix with `z` to indicate multi-base base58btc encoding
  const id = `z${encode(buffer)}`;
  const payload = {
    iss: accountId, // Identifies principal that issued the JWT.
    sub: `did:key:${id}`, // Identifies the subject of the JWT.
    nbf: now, // Not Before
    iat: now, // Issued at
    exp: oneHour, // Expiration Time
    ...extras, // Allow callers to overwrite defaults via extras
  };
  // Optional: https://www.npmjs.com/package/canonicalize
  const encodedHeader = encodeURLSafe(encoder.encode(JSON.stringify(header)));
  const encodedPayload = encodeURLSafe(encoder.encode(JSON.stringify(payload)));
  const message = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const { signature } = await signer.signMessage(message, accountId, networkId);
  const encodedSignature = encodeURLSafe(signature);
  const jws = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  return jws;
}
