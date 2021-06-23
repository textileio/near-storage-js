import { InMemorySigner, keyStores, utils } from "near-api-js";
import { decodeURLSafe, encodeURLSafe } from "@stablelib/base64";
import { encode } from "bs58";

import { jws } from "../jws";

const decoder = new TextDecoder();
const signer = new InMemorySigner(new keyStores.InMemoryKeyStore());
const accountId = "account.testnet";
const networkId = "network.id";
const aud = "broker.testnet";

let publicKey: utils.PublicKey;

beforeAll(async () => {
  publicKey = await signer.createKey(accountId, networkId);
});

test("create basic jws token", async () => {
  const token = await jws(signer, {
    accountId,
    networkId,
    aud,
  });
  expect(typeof token).toEqual("string");
  expect(token).toContain(".");
});

test("jws has correct header", async () => {
  const jwk = {
    kty: "OKP",
    crv: "Ed25519",
    x: encodeURLSafe(publicKey.data),
    use: "sig",
  };
  const token = await jws(signer, {
    accountId,
    networkId,
    aud,
  });
  const [h] = token.split(".");
  const header = JSON.parse(decoder.decode(decodeURLSafe(h)));
  expect(header).toHaveProperty("alg", "EdDSASha256");
  expect(header).toHaveProperty("typ", "JWT");
  expect(header).toHaveProperty("jwk", jwk);
});

test("jws has correct payload", async () => {
  const buffer = new Uint8Array([0xed, 0x01, ...publicKey.data]);
  const id = `z${encode(buffer)}`;
  const token = await jws(signer, {
    accountId,
    networkId,
    aud,
  });
  const [, p] = token.split(".");
  const payload = JSON.parse(decoder.decode(decodeURLSafe(p)));
  expect(payload).toHaveProperty("iss", accountId);
  expect(payload).toHaveProperty("sub", `did:key:${id}`);
  expect(payload).toHaveProperty("aud", aud);
  const { exp, iat } = payload;
  expect(exp).toBeGreaterThan(iat);
});

test("jws supports overriding defaults", async () => {
  const yesterday = ((d) => new Date(d.setDate(d.getDate() - 1)))(new Date());
  const token = await jws(signer, {
    accountId,
    networkId,
    aud,
    exp: yesterday.valueOf(),
  });
  const [, p] = token.split(".");
  const payload = JSON.parse(decoder.decode(decodeURLSafe(p)));
  expect(payload).toHaveProperty("exp", yesterday.valueOf());
});
