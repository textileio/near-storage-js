import { Contract, WalletConnection, utils } from "near-api-js";
import { jws, JwsOptions } from "./jws";

export { jws, JwsOptions };

const ONE = utils.format.parseNearAmount("1") ?? undefined;
const GAS = "300000000000000"; // 3e13
export const DEFAULT_CONTRACT_NAME = "filecoin-bridge";
const REMOTE_URL = "https://broker.staging.textile.dev";
const TOS = `
This is a beta release of @textile/near-storage. Do not store personal, encrypted, or illegal data.
Data will not be available permanently on either Filecoin or IPFS. See the full terms of service
(TOS) for details: https://near.storage/terms`;

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
      // TODO: Use dep injection to support alternative FormData impl
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
  addDeposit: (args: {
    args: { brokerId: string; accountId?: string };
    gas?: string;
    amount?: string;
  }) => Promise<DepositInfo>;
  releaseDeposits: (args: {
    args: unknown;
    gas?: string;
    amount?: string;
  }) => Promise<void>;
  hasDeposit: (args: {
    brokerId: string;
    accountId: string;
  }) => Promise<boolean>;
  getBroker: (args: { brokerId: string }) => Promise<BrokerInfo | undefined>;
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
      return contract.getBroker({ brokerId: id ?? brokerId });
    },
    addDeposit: async (id: string = accountId): Promise<DepositInfo> => {
      if (!id) throw new Error(`invalid account id: "${id}"`);
      return contract.addDeposit({
        args: { brokerId, accountId: id },
        gas: GAS,
        amount: ONE,
      });
    },
    releaseDeposits: async (): Promise<void> => {
      return contract
        .releaseDeposits({ args: {}, gas: GAS })
        .then(() => undefined);
    },
    hasDeposit: async (): Promise<boolean> => {
      if (!accountId) throw new Error(`invalid account id: "${accountId}"`);
      return contract.hasDeposit({ brokerId, accountId });
    },
  };
}

type DepositType = ReturnType<typeof initDeposit>;

function initSignIn(connection: WalletConnection, contractName: string) {
  const account = connection.account();
  const { networkId } = account.connection;
  const contractId = `${contractName}.${networkId}`;
  return {
    requestSignIn: async ({
      successUrl,
      failureUrl,
    }: {
      successUrl?: string;
      failureUrl?: string;
    } = {}): Promise<void> =>
      connection.requestSignIn({ contractId, successUrl, failureUrl }),
    signOut: () => connection.signOut(),
  };
}

type SignInType = ReturnType<typeof initSignIn>;

function initContract(connection: WalletConnection, contractName: string) {
  const account = connection.account();
  const { networkId } = account.connection;
  const fullContractName = `${contractName}.${networkId}`;
  const contract = new Contract(account, fullContractName, {
    // View methods are read-only – they don't modify the state, but usually return some value
    viewMethods: ["hasDeposit", "listBrokers", "getBroker"],
    // Change methods can modify the state, but you don't receive the returned value when called
    changeMethods: ["addDeposit", "releaseDeposits"],
  }) as DepositContract;

  return contract;
}

// MAIN EXPORTS

export type API = StorageType & DepositType & SignInType;

export async function init(
  connection: WalletConnection,
  options: { brokerInfo?: BrokerInfo; contractName?: string } = {}
): Promise<API> {
  // TODO: Eventually remove this in favor of wallet singing warnings?
  console.warn(TOS);

  const account = connection.account();
  const { accountId } = account;
  let { brokerInfo } = options;

  const contract = initContract(
    connection,
    options.contractName || DEFAULT_CONTRACT_NAME
  );

  if (!brokerInfo) {
    const brokers = await contract.listBrokers();
    if (brokers.length < 1) {
      throw new Error("no registered brokers");
    }
    for (const broker of brokers) {
      // For now, go with first broker we find where user has deposited funds
      const { brokerId } = broker;
      if (!accountId) {
        break;
      }
      const has = await contract.hasDeposit({ brokerId, accountId });
      if (has) {
        brokerInfo = broker;
      }
    }
    if (!brokerInfo) {
      brokerInfo = brokers[brokers.length - 1];
    }
  }
  const { brokerId } = brokerInfo;
  const deposit = initDeposit(contract, { accountId, brokerId });
  const signIn = initSignIn(
    connection,
    options.contractName || DEFAULT_CONTRACT_NAME
  );
  const storage = initStorage(connection, { brokerInfo });

  return { ...signIn, ...deposit, ...storage };
}
