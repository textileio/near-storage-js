import { utils, ConnectConfig } from "near-api-js";
import { jws } from "./jws";
import type { Storage } from "./model";
import { init } from "./contract";

// Various internal constants, these should be edited before "mainnet"
const UPLOAD_URL = "https://broker.staging.textile.io/";
const ONE = utils.format.parseNearAmount("1") ?? undefined;
const DEFAULTS = {
  networkId: "testnet",
  nodeUrl: "https://rpc.testnet.near.org",
  walletUrl: "https://wallet.testnet.near.org",
  helperUrl: "https://helper.testnet.near.org",
};

export const SignedInError = new Error(
  "user not signed in or account not available"
);

/**
 * Create a new near-storage object with methods for interacting with the
 * lock-box and storage apis.
 * @param conf A connection configuration setup to customize access to
 * the near network.
 * @returns A Promise that resolves to an object with APIs for interacting
 * with lock-box and the storage apis.
 */
export async function create(conf: ConnectConfig = DEFAULTS): Promise<Storage> {
  const { account, contract, signer, wallet, config } = await init(conf);

  const signIn = (
    title?: string | undefined,
    successUrl?: string | undefined,
    failureUrl?: string | undefined
  ) => wallet.requestSignIn(config.contractName, title, successUrl, failureUrl);

  const store = async (
    data: File,
    options: { region: string } = { region: "europe" }
  ) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(options)) {
      formData.append(key, value);
    }

    formData.append("file", data, data.name);
    const token = await jws(signer, {
      accountId: account.accountId,
      networkId: conf.networkId,
      aud: UPLOAD_URL,
    });
    const res = await fetch(`${UPLOAD_URL}upload`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const json = await res.json();
    return json;
  };

  const signOut = () => {
    if (!isSignedIn()) throw SignedInError;
    return wallet.signOut();
  };

  const lockFunds = async () => {
    if (!contract || !isSignedIn()) throw SignedInError;
    return contract.lockFunds({}, undefined, ONE);
  };

  const unlockFunds = async () => {
    if (!contract || !isSignedIn()) throw SignedInError;
    return contract.unlockFunds({});
  };

  const hasLocked = () => {
    if (!contract || !isSignedIn()) throw SignedInError;
    return contract.hasLocked({ accountId: account.accountId });
  };

  const isSignedIn = () => wallet && wallet.isSignedIn();

  const getAccountId = () => {
    if (isSignedIn()) return account.accountId;
  };

  return {
    signIn,
    signOut,
    lockFunds,
    unlockFunds,
    hasLocked,
    store,
    isSignedIn,
    getAccountId,
  };
}
