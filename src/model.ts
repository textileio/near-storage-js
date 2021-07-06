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

/**
 * Options for creating a JWS string.
 */
export interface JwsOptions {
  // The accountId of the identity to use.
  accountId?: string;
  // The identifier of the network for determining signing keys.
  networkId?: string;
  // The time offset (in seconds) to specify for token expiration. Should default to 10 minutes,
  // or approximately 600 blocks.
  offset?: number;
  // Any additional key/value pairs to include in the JWT payload.
  [key: string]: string | number | undefined;
}

/**
 * Options for init configuration
 */
export interface InitOptions {
  // Full broker info object.
  brokerInfo?: BrokerInfo;
  // Full contractId
  contractId?: string;
}

/**
 * SignInOptions is a set of options for configuring sign-in.
 */
export interface SignInOptions {
  contractId?: string;
  successUrl?: string;
  failureUrl?: string;
}

/**
 * BrokerInfo represents information about a registered broker/provider.
 */
export interface BrokerInfo {
  // brokerId is the full id (including networkId) of the broker.
  brokerId: string;
  // addresses is a list of http endpoint at which the broker's API can be reached.
  addresses: string[];
}

/**
 * Status is the status of a StorageRequest.
 */
export enum Status {
  // Unknown is the default value to an uninitialized
  // StorageRequest. This status must be considered invalid in any
  // real StorageRequest instance.
  Unknown = 0,
  // Batching indicates that the storage request is being batched.
  Batching,
  // Preparing indicates that the batch containing the data is being prepared.
  Preparing,
  // Auctioning indicates that the batch containing the data is being auctioned.
  Auctioning,
  // DealMaking indicates that the data is in deal-making process.
  DealMaking,
  // Success indicates that the request was stored in Filecoin.
  Success,
}

/**
 * Request is a request for storing data in a Broker.
 */
export interface Request {
  id: string;
  cid: {
    "/": string;
  };
  status_code: Status;
}

/**
 * RequestInfo describes the current state of a request.
 */
export interface RequestInfo {
  request: Request;
  deals: Deal[];
}

/**
 * Deal contains information of an on-chain deal.
 * TODO: We may have to consider using BigInt for deal expiration in the future.
 */
export interface Deal {
  miner: string;
  deal_id: number;
  deal_expiration: number;
}

export interface OpenOptions {
  /**
   * Which region to specify for Filecoin storage.
   */
  region?: string;
  // Others
  headers?: Record<string, string | number>;
}
