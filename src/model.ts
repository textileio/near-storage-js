import type { Contract } from "near-api-js";

/**
 * @internal
 */
export interface LockBoxContract extends Contract {
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

/**
 * Response from calls to the near lock-box contract.
 */
export interface LockResponse {
  blockIndex: string;
}

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

/**
 * The main storage interface.
 */
export interface Storage {
  // Contract-specific methods
  lockFunds(): Promise<LockResponse>;
  unlockFunds(): Promise<LockResponse>;
  hasLocked(): Promise<boolean>;

  // Generic contract interactions
  signIn(
    title?: string | undefined,
    successUrl?: string | undefined,
    failureUrl?: string | undefined
  ): Promise<void>;
  signOut(): void;

  // Storage-specific method
  store(data: File, options?: { region: string }): Promise<StoreResponse>;

  // Generic additional information
  getAccountId(): string | undefined;
  isSignedIn(): boolean;
}
