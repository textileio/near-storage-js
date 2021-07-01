import { WalletConnection } from "near-api-js";
import { CONTRACT_ID } from "./utils";
import { SignInOptions } from "./model";

export async function requestSignIn(
  connection: WalletConnection,
  { successUrl, failureUrl, contractId }: SignInOptions
): Promise<void> {
  if (!contractId) contractId = CONTRACT_ID;
  return connection.requestSignIn({ contractId, successUrl, failureUrl });
}
