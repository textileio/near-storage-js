import { Contract, Account } from "near-api-js";
import { jws } from "./jws";
import { isFormData, CONTRACT_ID, DEPOSIT, GAS, REMOTE_URL } from "./utils";
import {
  BrokerInfo,
  OpenOptions,
  RequestInfo,
  DepositInfo,
  InitOptions,
  Request,
} from "./model";

function initStorage(account: Account, options: { brokerInfo: BrokerInfo }) {
  const { accountId } = account;
  const { signer, networkId } = account.connection;
  const { brokerInfo } = options;
  if (!brokerInfo) throw new Error("Must provide broker information");
  // Default to first entry in broker info addresses for now
  // TODO: Leaving default remote url here for now, should be removed
  const url = brokerInfo.addresses[0] ?? REMOTE_URL;

  return {
    /**
     * Create a storage request with a remote broker.
     * 
     * Assumes FormData is available globally. If it is not (i.e., running in NodeJS),
      provide a spec-compliant FormData object directly, or specify the FormData implementation
      in the options argument.
     * @param data The File or FormData object to upload.
     * @param options Optional parameters to control storage deals. Currently only FormData
     * argument is checked.
     * @returns Promise that resolves to a storage request object.
     */
    store: async function store(
      data: File | FormData,
      options: OpenOptions = {}
    ): Promise<Request> {
      let formData: FormData;
      if (isFormData(data)) {
        formData = data;
      } else {
        const FormData = options.FormData ?? globalThis.FormData;
        formData = new FormData();
        for (const [key, value] of Object.entries(options)) {
          formData.append(key, value);
        }
        formData.append("file", data, data.name);
      }
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
    status: async function status(id: string): Promise<RequestInfo> {
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
        amount: DEPOSIT,
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

function initContract(account: Account, contractId: string) {
  const contract = new Contract(account, contractId, {
    // View methods are read-only – they don't modify the state, but usually return some value
    viewMethods: ["hasDeposit", "listBrokers", "getBroker"],
    // Change methods can modify the state, but you don't receive the returned value when called
    changeMethods: ["addDeposit", "releaseDeposits"],
  }) as DepositContract;

  return contract;
}

// MAIN EXPORTS

export type API = StorageType & DepositType;

export async function init(
  account: Account,
  options: InitOptions = {}
): Promise<API> {
  const { accountId } = account;
  // eslint-disable-next-line prefer-const
  let { brokerInfo, contractId } = options;

  const contract = initContract(account, contractId || CONTRACT_ID);

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
  const storage = initStorage(account, { brokerInfo });

  return { ...deposit, ...storage };
}
