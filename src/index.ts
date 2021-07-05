// Export main functions
export { requestSignIn } from "./signin";
export { init } from "./storage";
export { jws } from "./jws";
// Export all top-level type exports
export type { API } from "./storage";
export * from "./model";
// Export all useful public constants
export { CONTRACT_ID, DEPOSIT, GAS, REMOTE_URL } from "./utils";

const TOS = `
This is a beta release of @textile/near-storage. Do not store personal, encrypted, or illegal data.
Data will not be available permanently on either Filecoin or IPFS. See the full terms of service
(TOS) for details: https://near.storage/terms`;

// TODO: Eventually remove this in favor of wallet singing information?
console.info(TOS);
