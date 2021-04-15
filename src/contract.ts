import {
  Contract,
  keyStores,
  connect,
  WalletConnection,
  ConnectConfig,
} from "near-api-js";
import { LockBoxContract } from "./model";

export const CONTRACT_NAME = "lock-box";

/**
 * Initialize all the components required to access the near network.
 * @param nearConfig A connection configuration setup to customize access to
 * the near network.
 * @returns Promise
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function init(nearConfig: ConnectConfig) {
  const contractName = `${CONTRACT_NAME}.${nearConfig.networkId}`;

  // Initializing connection to the NEAR TestNet
  const near = await connect({
    deps: {
      keyStore: new keyStores.BrowserLocalStorageKeyStore(),
    },
    ...nearConfig,
  });

  // Needed to access wallet
  const wallet = new WalletConnection(near, null);
  const account = wallet.account();
  const signer = near.connection.signer;

  // Load in account data
  let user: { accountId: string; balance: string } | undefined;
  if (account.accountId) {
    user = {
      accountId: account.accountId,
      balance: (await account.state()).amount,
    };
  }

  const config = { ...nearConfig, contractName };

  if (!user) {
    return { config, user, wallet, account, signer };
  }

  // Create new signing key or get existing one
  // let publicKey = await signer.getPublicKey(currentUser.accountId, nearConfig.networkId)
  // if (!publicKey) {
  //   publicKey = await signer.createKey(currentUser.accountId, nearConfig.networkId)
  // }

  // const allowance = utils.format.parseNearAmount("1") || ""
  // // TODO: How to check if this has already been done?
  // await account.addKey(publicKey, contractName, ["lockFunds", "unlockFunds"], new BN(allowance))

  // Initializing our contract APIs by contract name and configuration
  const contract = new Contract(account, contractName, {
    // View methods are read-only – they don't modify the state, but usually return some value
    viewMethods: ["hasLocked"],
    // Change methods can modify the state, but you don't receive the returned value when called
    changeMethods: ["lockFunds", "unlockFunds"],
    // Sender is the account ID to initialize transactions.
    // getAccountId() will return empty string if user is still unauthorized
    // sender: walletConnection.getAccountId()
  }) as LockBoxContract;

  return { config, user, wallet, account, signer, contract };
}
