# @textile/near-storage

[![GitHub license](https://img.shields.io/github/license/textileio/near-storage-js.svg)](./LICENSE)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/textileio/near-storage-js.svg)](./package.json)
[![npm (scoped)](https://img.shields.io/npm/v/@textile/near-storage.svg)](https://www.npmjs.com/package/@textile/near-storage)
[![Release](https://img.shields.io/github/release/textileio/near-storage-js.svg)](https://github.com/textileio/near-storage-js/releases/latest)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

[![Docs](https://github.com/textileio/near-storage-js/workflows/Docs/badge.svg)](https://github.com/textileio/near-storage-js/actions/workflows/docs.yml)
[![Tests](https://github.com/textileio/near-storage-js/workflows/Test/badge.svg)](https://github.com/textileio/near-storage-js/actions/workflows/test.yml)

> Javascript SDK for Textile's Broker-based data storage system on the Near blockchain.

# Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

# Background

`@textile/near-storage` provides a zero-config Typescript/Javascript SDK that makes it easy to store data on the Filecoin network from any NEAR-based dApp. `@textile/near-storage` should feel comfortable to developers already familiar with [NEAR](https://near.org/) Javascript libraries. The SDK provides a small but powerful API surface that integrates nicely with existing NEAR development best practices. Simply import the library, deposit some funds, and you are ready to start submitting data to be stored on the Filecoin network.

# Install

```bash
npm i @textile/near-storage
```

## Usage

```typescript
import { connect, WalletConnection } from "near-api-js";
import { init, requestSignIn } from "@textile/near-storage";

const near = await connect({ ... });

// Need to access wallet
const wallet = new WalletConnection(near, null);
await requestSignIn(wallet);
const storage = init(wallet);

const blob = new Blob(["Hello, world!"], { type: "text/plain" });
const file = new File([blob], "welcome.txt", {
  type: "text/plain",
  lastModified: new Date().getTime(),
});

await storage.addDeposit();

const { id, cid } = await storage.store(file);

const { request, deals } = await storage.status(id)
console.log(request.status_code)
console.log([...deals])

await wallet.signOut();
```

# API

For full library documentation (TypeDocs), see https://textileio.github.io/near-storage-js.

The main `@textile/near-storage` entry point exposes an initialization function that takes a NEAR `Account` object, and returns a `Storage` object with a minimal `API` interface. The initialization function can optionally take information about a known Filecoin storage provider, otherwise, a random provider (or a provider with which the user has previously interacted) is automatically selected:

```typescript
import { connect, WalletConnection } from "near-api-js";
import { init, requestSignIn } from "@textile/near-storage";

// See https://github.com/textileio/near-storage-dapp-demo for an example of initializing a NEAR dApp
const near = await connect({ ... });
const wallet = new WalletConnection(near, null);

// Sign-in and authorize the @textile/near-storage smart contract (`filecoin-bridge.testnet`)
await requestSignIn(wallet)

// Initialize the storage object, and you're ready to go
const storage = await init(wallet);
```

## Create session

The core storage API revolves around two key concepts: _deposits_ and _storage_. Leaving a deposit provides a degree of Sybil resistance, such that users looking to store data on Filecoin via the provider must first deposit funds proportional to the length of time they'd like to continue storing data (for testnet, the default timeout is ~10 minutes). To store data, a minimum (default) deposit must be left with a provider:

```typescript
const deposit = await storage.addDeposit();
console.log(deposit);
```

A deposit is generally valid for about 10 minutes (based on blocks). Adding further deposits extends your session, though all funds will be held until they expire, so use this feature sparingly. After funds expire, they can be released by the user or any other party interacting with the SDK's smart contract (such as the provider itself). This provides a means to release funds after a storage session has completed, without locking funds in the contract during the Filecoin proof process.

## Store data

Once a valid deposit is available, the app/user can push data to the provider using the `store` endpoint. This simply takes a `File` (or `FormData`) object, and send the bytes to the provider for preparation and Filecoin storage.

```typescript
const blob = new Blob(["Hello, world!"], { type: "text/plain" });
const file = new File([blob], "welcome.txt", {
  type: "text/plain",
  lastModified: new Date().getTime()
});

// The store API also takes optional configuration parameters
const { id, cid } = await storage.store(file);
```

## Check status

The status of the file can be queried using its `id`. The storage process ranges from "batching" files together, to "preparing" the storage deal, to "auctioning" the set of storage deals, to the actual "deal making" and "success" of the final storage deal on Filecoin. Along the way, clients may query the status in order to provide feedback to users.

```typescript
const { request, deals } = await storage.status(id);
console.log(request.status_code);
console.log(deals); // Array, empty if no deals on chain yet
```

It is now safe to release the deposit(s):

```typescript
await storage.releaseDeposits();
```

## Other APIs

The `@textile/near-storage` SDK provides a few other endpoints for developers to use, including a [JSON Web Signature (JWS)](https://datatracker.ietf.org/doc/html/rfc7515) signing utility that let's you create a (modified) JWS token. Here's an example using the `jws` API from a NodeJS script (assumes you have signed in with [`near login`](https://github.com/near/near-cli)):

```javascript
import { keyStores, InMemorySigner } from "near-api-js";
import os from "os";
import path from "path";
import { jws } from "@textile/near-storage";

const keyStore = new keyStores.UnencryptedFileSystemKeyStore(
  path.join(os.homedir(), ".near-credentials")
);
const accountId = "account.testnet";
const networkId = "testnet";
const aud = "provider.testnet";
const signer = new InMemorySigner(keyStore);
const token = await jws(signer, { accountId, networkId, aud });
```

# Maintainers

[@carsonfarmer](https://github.com/carsonfarmer)

# Contributing

PRs accepted.

Small note: If editing the README, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

# License

Dual MIT and Apache © 2021 Textile.io
