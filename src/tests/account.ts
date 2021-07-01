/* istanbul ignore file */
import {
  ConnectedWalletAccount,
  Near,
  Account,
  keyStores,
  InMemorySigner,
  WalletConnection,
} from "near-api-js";
import { encodeURLSafe } from "@stablelib/base64";
import BN from "bn.js";
import { BrokerInfo, DepositInfo } from "../model";
import { DEPOSIT, GAS } from "../utils";

const DEFAULT_DEPOSIT = new BN(DEPOSIT).toString();
const DEFAULT_GAS = new BN(GAS).toString();

const encoder = new TextEncoder();

interface FunctionCallOptions {
  /** The NEAR account id where the contract is deployed */
  contractId: string;
  /** The name of the method to invoke */
  methodName: string;
  /**
   * named arguments to pass the method `{ messageText: 'my message' }`
   */
  args: any;
  /** max amount of gas that method call can use */
  gas?: string;
  /** amount of NEAR (in yoctoNEAR) to send together with the call */
  attachedDeposit?: string;
}

const brokers: Map<string, BrokerInfo> = new Map([
  [
    "brokerId.networkId",
    {
      addresses: ["https://fake.broker.dev"],
      brokerId: "brokerId.networkId",
    },
  ],
]);

const deposits: Map<string, any> = new Map();

const mockNear = (keyStore: keyStores.KeyStore) =>
  (({
    config: {
      networkId: "networkId",
      contractName: "contractId",
      walletUrl: "http://example.com/wallet",
    },
    connection: {
      networkId: "networkId",
      signer: new InMemorySigner(keyStore),
    },
    async account(accountId: string) {
      return ({
        async state() {
          // noop
        },
        accountId,
      } as unknown) as Account;
    },
  } as unknown) as Near);

export const mockWalletConnection = (
  keyStore: keyStores.KeyStore,
  accountId = ""
): WalletConnection => {
  const fakeNear = mockNear(keyStore);

  const walletConnection = new WalletConnection(fakeNear, "fake_app");
  const _connectedAccount = {
    connection: fakeNear.connection,
    accountId,
    async viewFunction(contractId, methodName, args) {
      switch (methodName) {
        case "listBrokers": {
          return [...brokers.values()];
        }
        case "getBroker": {
          const { brokerId } = args;
          return brokers.get(brokerId);
        }
        case "hasDeposit": {
          const { accountId } = args;
          return deposits.has(accountId);
        }
        default:
          return;
      }
    },
    async functionCall({
      contractId,
      methodName,
      args = {},
      gas = DEFAULT_GAS,
      attachedDeposit = DEFAULT_DEPOSIT,
    }: FunctionCallOptions) {
      switch (methodName) {
        case "addDeposit": {
          const { brokerId, accountId } = args;
          if (!brokers.has(brokerId))
            throw new Error("addDeposit: invalid broker id");
          else if (attachedDeposit !== DEFAULT_DEPOSIT)
            throw new Error("addDeposit: invalid attached deposit");
          const info: DepositInfo = {
            accountId,
            brokerId,
            deposit: {
              sender: "",
              expiration: Infinity,
              amount: parseInt(attachedDeposit),
            },
          };
          const SuccessValue = encodeURLSafe(
            encoder.encode(JSON.stringify(info))
          );
          return { status: { SuccessValue } };
        }
        case "releaseDeposits": {
          const SuccessValue = encodeURLSafe(encoder.encode(""));
          return { status: { SuccessValue } };
        }
        default:
          return {} as any;
      }
    },
  } as ConnectedWalletAccount;
  walletConnection._connectedAccount = _connectedAccount;
  return walletConnection;
};
