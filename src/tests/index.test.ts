// @ts-expect-error missing type
import * as localStorage from "localstorage-memory";
import { KeyPair, keyStores, WalletConnection } from "near-api-js";
import fetchMock from "fetch-mock-jest";
import Blob from "fetch-blob";
import FetchFile from "fetch-blob/file.js";
import { FormData } from "formdata-node";
import { init, API, Status } from "../index";
import { mockWalletConnection } from "./account";

// Mock env setup
globalThis.window = {
  localStorage,
} as Window & typeof globalThis;
globalThis.document = {
  title: "documentTitle",
} as Document;
(globalThis as any).FormData = FormData;

let history: [any, string, string | null | undefined][] = [];
let lastRedirectUrl: string;
let storage: API;
const keyStore = new keyStores.InMemoryKeyStore();
let walletConnection: WalletConnection;

describe("alternate", () => {
  beforeEach(async () => {
    lastRedirectUrl = "";
    history = [];
    Object.assign(globalThis.window, {
      location: {
        href: "http://example.com/location",
        assign(url: string) {
          lastRedirectUrl = url;
          this.href = lastRedirectUrl;
        },
      },
      history: {
        replaceState: (data: any, title: string, url?: string | null): void => {
          history.push([data, title, url]);
        },
      },
    });
    walletConnection = mockWalletConnection(keyStore, "fakeAccount.networkId");
  });

  it("should automatically attempt to pick a broker", async () => {
    const storage = await init(walletConnection, {
      contractName: "fakeContract",
    });
    expect(storage).toBeDefined();
  });
});

describe("contract", () => {
  beforeEach(async () => {
    lastRedirectUrl = "";
    history = [];
    Object.assign(globalThis.window, {
      location: {
        href: "http://example.com/location",
        assign(url: string) {
          lastRedirectUrl = url;
          this.href = lastRedirectUrl;
        },
      },
      history: {
        replaceState: (data: any, title: string, url?: string | null): void => {
          history.push([data, title, url]);
        },
      },
    });
    walletConnection = mockWalletConnection(keyStore, "fakeAccount.networkId");

    storage = await init(walletConnection, {
      brokerInfo: { brokerId: "brokerId.networkId", addresses: [] },
      contractName: "fakeContract",
    });
  });

  describe("can request sign in", () => {
    beforeEach(() => keyStore.clear());

    it("wraps the wallet connection sign in", () => {
      return storage.requestSignIn({
        successUrl: "http://example.com/success",
        failureUrl: "http://example.com/fail",
      });
    });

    afterEach(async () => {
      const accounts = await keyStore.getAccounts("networkId");
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatch(/^pending_key.+/);
      const url = new URL(lastRedirectUrl);
      const params = url.searchParams;
      const publicKey = params.get("public_key");
      expect(publicKey).toEqual(
        (await keyStore.getKey("networkId", accounts[0]))
          .getPublicKey()
          .toString()
      );
    });
  });

  describe("can request sign out", () => {
    it("wraps the wallet connection sign out", () => {
      // TODO: Right now, this is just pass or fail, should test properly with shims etc
      storage.signOut();
    });
  });

  describe("can interact with smart contract view methods", () => {
    beforeEach(async () => {
      keyStore.clear();
      await storage.requestSignIn({
        successUrl: "http://example.com/success",
        failureUrl: "http://example.com/fail",
      });
    });
    it("listBrokers", async () => {
      const brokers = await storage.listBrokers();
      expect(brokers).toHaveLength(1);
    });

    it("getBroker", async () => {
      const broker = await storage.getBroker("brokerId.networkId");
      expect(broker).toHaveProperty("brokerId", "brokerId.networkId");
      expect(broker?.addresses).toHaveLength(1);
    });

    it("hasDeposit", async () => {
      const ok = await storage.hasDeposit();
      expect(ok).toBeFalsy();
    });
  });

  describe("can interact with smart contract change methods", () => {
    it("addDeposit", async () => {
      expect(() => storage.addDeposit("")).rejects;
      const res = await storage.addDeposit();
      expect(res).toHaveProperty("deposit");
      expect(res).toHaveProperty("accountId", "fakeAccount.networkId");
    });

    it("releaseDeposits", async () => {
      const released = await storage.releaseDeposits();
      expect(released).not.toBeDefined();
    });
  });
});

describe("storage", () => {
  beforeAll(() => {
    fetchMock
      .postOnce("https://fake.broker.dev/upload", () => {
        return { throws: new Error("upload failed") };
      })
      .post(
        "https://fake.broker.dev/upload",
        () => {
          // TODO: Inspect the body and do some extra checks
          return {
            id: "fakeId",
            cid: {
              "/": "fakeCid",
            },
            status_code: Status.Batching,
          };
        },
        { overwriteRoutes: false }
      )
      .get("https://fake.broker.dev/storagerequest/fakeId", () => {
        // TODO: Inspect the body and do some extra checks
        return {
          request: {
            id: "fakeId",
            cid: {
              "/": "fakeCid",
            },
            status_code: Status.Success,
          },
          deals: [
            {
              miner: "miner1",
              deal_id: 12345,
              deal_expiration: 1945916,
            },
            {
              miner: "miner2",
              deal_id: 54321,
              deal_expiration: 1945856,
            },
            {
              miner: "miner3",
              deal_id: 98765,
              deal_expiration: 1942976,
            },
          ],
        };
      });
  });
  beforeEach(async () => {
    keyStore.clear();
    walletConnection = mockWalletConnection(keyStore, "fakeAccount.networkId");

    keyStore.setKey(
      "networkId",
      "fakeAccount.networkId",
      KeyPair.fromRandom("ED25519")
    );

    storage = await init(walletConnection, {
      brokerInfo: {
        brokerId: "brokerId.networkId",
        addresses: ["https://fake.broker.dev"],
      },
      contractName: "fakeContract",
    });
  });

  it("should be able to store some data", async () => {
    const blob = new Blob(["Hello, world!"], { type: "text/plain" });
    const file = new FetchFile([blob], "welcome.txt", {
      type: "text/plain",
      lastModified: new Date().getTime(),
    });

    expect(storage.store((file as unknown) as File)).rejects.toThrowError(
      "upload failed"
    );

    const opts = { region: "earth" };
    const request = await storage.store((file as unknown) as File, opts);
    expect(request.id).toEqual("fakeId");
    expect(request.cid).toEqual({ "/": "fakeCid" });
    expect(request.status_code).toEqual(Status.Batching);
  });

  it("should be able to get status of some data", async () => {
    const blob = new Blob(["Hello, world!"], { type: "text/plain" });
    const file = new FetchFile([blob], "welcome.txt", {
      type: "text/plain",
      lastModified: new Date().getTime(),
    });

    const { id } = await storage.store((file as unknown) as File);

    const { request, deals } = await storage.status(id);
    expect(request).toHaveProperty("status_code", Status.Success);
    expect(deals).toHaveLength(3);
  });
});
