/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// Copyright (c) 2016 - 2020 Node Fetch Team
// https://github.com/node-fetch/node-fetch/blob/master/src/utils/is.js

const NAME = Symbol.toStringTag;

export const CONTRACT_ID = "filecoin-bridge.testnet";
export const DEPOSIT = "250000000000000000000000";
export const GAS = "300000000000000"; // 3e13
export const REMOTE_URL = "https://broker.staging.textile.dev";

/**
 * Check if `obj` is a spec-compliant `FormData` object
 */
export function isFormData(object: any): object is FormData {
  return (
    typeof object === "object" &&
    typeof object.append === "function" &&
    typeof object.set === "function" &&
    typeof object.get === "function" &&
    typeof object.getAll === "function" &&
    typeof object.delete === "function" &&
    typeof object.keys === "function" &&
    typeof object.values === "function" &&
    typeof object.entries === "function" &&
    typeof object.constructor === "function" &&
    object[NAME] === "FormData"
  );
}
