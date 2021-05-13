import { Contract, WalletConnection, utils } from "near-api-js";
import { jws, JwsOptions } from "./jws";

export { jws, JwsOptions };

const ONE = utils.format.parseNearAmount("1") ?? undefined;
const REMOTE_URL = "https://broker.staging.textile.io";

export enum RequestStatus {
  Unknown = 0,
  Batching,
  Preparing,
  Auctioning,
  DealMaking,
  Success,
}

export interface BrokerInfo {
  brokerId: string;
  addresses: string[];
}

/**
 * Response from calls to the storage upload endpoint.
 */
export interface StoreResponse {
  id: string;
  cid: {
    "/": string;
  };
  status_code: RequestStatus;
}

export interface OpenOptions {
  region?: string;
}

function initStorage(
  connection: WalletConnection,
  options: { brokerInfo: BrokerInfo }
) {
  const account = connection.account();
  const { accountId } = account;
  const { signer, networkId } = account.connection;
  const { brokerInfo } = options;
  if (!brokerInfo) throw new Error("Must provide broker information");
  // Default to first entry in broker info addresses for now
  // TODO: Leaving default remote url here for now, should be removed
  const url = brokerInfo.addresses[0] ?? REMOTE_URL;

  return {
    store: async function store(
      data: File,
      options: OpenOptions = {}
    ): Promise<StoreResponse> {
      const formData = new FormData();
      for (const [key, value] of Object.entries(options)) {
        formData.append(key, value);
      }
      formData.append("file", data, data.name);
      const token = await jws(signer, {
        accountId,
        networkId,
        aud: brokerInfo.brokerId,
      });
      const res = await fetch(`${url}/upload`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        return json;
      }
      const err = await res.text();
      throw new Error(err);
    },
    status: async function status(id: string): Promise<StoreResponse> {
      const token = await jws(signer, {
        accountId,
        networkId,
        aud: brokerInfo.brokerId,
      });
      const res = await fetch(`${url}/storagerequest/${id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        return json;
      }
      const err = await res.text();
      throw new Error(err);
    },
  };
}

type StorageType = ReturnType<typeof initStorage>;

interface DepositContract extends Contract {
  addDeposit: (
    args: { brokerId: string; accountId?: string },
    gas?: string,
    amount?: string
  ) => Promise<DepositInfo>;
  releaseDeposits: (gas?: string, amount?: string) => Promise<void>;
  hasDeposit: (args: {
    brokerId: string;
    accountId: string;
  }) => Promise<boolean>;
  getBroker: (brokerId?: string) => Promise<BrokerInfo | undefined>;
  listBrokers: () => Promise<BrokerInfo[]>;
}

export interface Deposit {
  // The sender account id. i.e., the account depositing the funds.
  sender: string;
  // The block index at which funds should expire.
  expiration: number;
  // The amount of deposited funds (in Ⓝ). Currently defaults to 1.
  amount: number;
}

export interface DepositInfo {
  accountId: string;
  brokerId: string;
  deposit: Deposit;
}

function initDeposit(
  contract: DepositContract,
  { accountId, brokerId }: { accountId: string; brokerId: string }
) {
  return {
    listBrokers: async (): Promise<BrokerInfo[]> => {
      return contract.listBrokers();
    },
    getBroker: async (id?: string): Promise<BrokerInfo | undefined> => {
      return contract.getBroker(id ?? brokerId);
    },
    addDeposit: async (): Promise<DepositInfo> => {
      return contract.addDeposit({ brokerId, accountId }, undefined, ONE);
    },
    releaseDeposits: async (): Promise<void> => {
      return contract.releaseDeposits();
    },
    hasDeposit: async (): Promise<boolean> => {
      return contract.hasDeposit({ brokerId, accountId });
    },
  };
}

type DepositType = ReturnType<typeof initDeposit>;

function initSignIn(connection: WalletConnection) {
  const account = connection.account();
  const { networkId } = account.connection;
  const contractName = `${CONTRACT_NAME}.${networkId}`;
  return {
    requestSignIn: async (
      title?: string | undefined,
      successUrl?: string | undefined,
      failureUrl?: string | undefined
    ): Promise<void> =>
      connection.requestSignIn(contractName, title, successUrl, failureUrl),
    signOut: () => connection.signOut(),
  };
}

type SignInType = ReturnType<typeof initSignIn>;

function initContract(connection: WalletConnection) {
  const account = connection.account();
  const { networkId } = account.connection;
  const contractName = `${CONTRACT_NAME}.${networkId}`;
  const contract = new Contract(account, contractName, {
    // View methods are read-only – they don't modify the state, but usually return some value
    viewMethods: ["hasDeposit", "listBrokers", "getBroker"],
    // Change methods can modify the state, but you don't receive the returned value when called
    changeMethods: ["addDeposit", "releaseDeposits"],
  }) as DepositContract;

  return contract;
}

// MAIN EXPORTS

export const CONTRACT_NAME = "lock-box";

export type API = StorageType & DepositType & SignInType;

export async function init(
  connection: WalletConnection,
  options: { brokerInfo?: BrokerInfo } = {}
): Promise<API> {
  const account = connection.account();
  const { accountId } = account;
  let { brokerInfo } = options;

  const contract = initContract(connection);

  if (!brokerInfo) {
    const brokers = await contract.listBrokers();
    if (brokers.length < 1) {
      throw new Error("no registered brokers");
    }
    let last: BrokerInfo;
    for (const broker of brokers) {
      last = broker;
      // For now, go with first broker we find where user has deposited funds
      const { brokerId } = broker;
      const has = await contract.hasDeposit({ brokerId, accountId });
      if (has) {
        brokerInfo = broker;
      }
    }
    if (!brokerInfo) {
      brokerInfo = last!;
    }
  }
  const { brokerId } = brokerInfo;
  const deposit = initDeposit(contract, { accountId, brokerId });
  const signIn = initSignIn(connection);
  const storage = initStorage(connection, { brokerInfo });

  return { ...signIn, ...deposit, ...storage };
}
