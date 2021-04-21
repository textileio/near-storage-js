import { Contract, WalletConnection, utils } from "near-api-js";
import { jws, JwsOptions } from "./jws";

export { jws, JwsOptions };

const ONE = utils.format.parseNearAmount("1") ?? undefined;
export const CONTRACT_NAME = "lock-box";
const UPLOAD_URL = "https://broker.staging.textile.io/";

export interface OpenOptions {
  region?: string;
  blockIndex?: number;
}

export type StoreFunction = (
  data: File,
  options?: OpenOptions
) => Promise<StoreResponse>;

/**
 * Response from calls to the storage upload endpoint.
 */
export interface StoreResponse {
  id: string;
  cid: {
    "/": string;
  };
  status_code: number;
}

export function openStore(connection: WalletConnection): StoreFunction {
  return async function store(
    data: File,
    options: OpenOptions = {}
  ): Promise<StoreResponse> {
    const { blockIndex, ...opts } = options;
    const formData = new FormData();
    for (const [key, value] of Object.entries(opts)) {
      formData.append(key, value);
    }

    const account = connection.account();
    const { accountId } = account;
    const { signer, networkId } = account.connection;

    formData.append("file", data, data.name);
    const token = await jws(signer, {
      accountId,
      networkId,
      aud: UPLOAD_URL,
      blk: blockIndex,
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
}

/**
 * Response from calls to the near lock-box contract.
 */
export interface LockResponse {
  blockIndex: string;
}

interface LockBoxContract extends Contract {
  lockFunds: (
    args: { accountId?: string },
    gas?: string,
    amount?: string
  ) => Promise<LockResponse>;
  unlockFunds: (
    args: { accountId?: string },
    gas?: string,
    amount?: string
  ) => Promise<LockResponse>;
  hasLocked: (args: { accountId?: string }) => Promise<boolean>;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function openLockBox(connection: WalletConnection) {
  const account = connection.account();
  const { accountId } = account;
  const { networkId } = account.connection;
  const contractName = `${CONTRACT_NAME}.${networkId}`;
  const contract = new Contract(account, contractName, {
    // View methods are read-only – they don't modify the state, but usually return some value
    viewMethods: ["hasLocked"],
    // Change methods can modify the state, but you don't receive the returned value when called
    changeMethods: ["lockFunds", "unlockFunds"],
  }) as LockBoxContract;
  // Keep local cache
  let locked: boolean | null = null;
  const checkLocked = async () => {
    if (!accountId)
      throw new Error("invalid accountId, ensure account is logged in");
    if (locked == null) {
      locked = await contract.hasLocked({ accountId });
    }
    return locked;
  };
  return {
    lockFunds: async (): Promise<LockResponse | undefined> => {
      if (!(await checkLocked())) {
        return contract.lockFunds({ accountId }, undefined, ONE);
      }
      locked = true;
      return;
    },
    unlockFunds: async (): Promise<LockResponse | undefined> => {
      if (await checkLocked()) {
        return contract.unlockFunds({ accountId });
      }
      locked = false;
      return;
    },
    hasLocked: (): Promise<boolean> => {
      // Reset locked variable
      locked = null;
      return checkLocked();
    },
    requestSignIn: (
      title?: string | undefined,
      successUrl?: string | undefined,
      failureUrl?: string | undefined
    ): Promise<void> =>
      connection.requestSignIn(contractName, title, successUrl, failureUrl),
    signOut: () => connection.signOut(),
  };
}

export type LockBox = ReturnType<typeof openLockBox>;
