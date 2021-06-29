# @textile/near-storage

[![GitHub license](https://img.shields.io/github/license/textileio/near-storage-js.svg)](./LICENSE)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/textileio/near-storage-js.svg)](./package.json)
[![npm (scoped)](https://img.shields.io/npm/v/@textile/near-storage.svg)](https://www.npmjs.com/package/@textile/near-storage)
[![Release](https://img.shields.io/github/release/textileio/near-storage-js.svg)](https://github.com/textileio/near-storage-js/releases/latest)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

[![Docs](https://github.com/textileio/near-storage-js/workflows/Docs/badge.svg)](https://textileio.github.io/near-storage-js)

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

`near-storage` provides a zero-config Typescript/Javascript SDK that makes it easy to store data on the Filecoin network from any Near-based dApp.
`near-storage` should feel comfortable to developers already familiar with Near Javascript libraries. `near-storage` provides a small but powerful API surface that integrates nicely with existing Near DApp development best practices. Simply import the library, select a broker, lock some funds, and you are ready to start firing storage deals at a Broker's upload endpoint.

# Install

```bash
npm i @textile/near-storage
```

## Usage

_Typical dApp flow_

```typescript
import { connect, WalletConnection } from "near-api-js";
import { init } from "@textile/near-storage";

const near = await connect({ ... });

// Need to access wallet
const wallet = new WalletConnection(near, null);

const storage = init(wallet);

await storage.requestSignIn();

const blob = new Blob(["Hello, world!"], { type: "text/plain" });
const file = new File([blob], "welcome.txt", {
  type: "text/plain",
  lastModified: new Date().getTime(),
});

await storage.addDeposit();

const { id, cid } = await storage.store(file);

const status = await storage.status(id)
console.log(status)

await storage.signOut();
```

_Creating a JWS_

```typescript
import { connect, WalletConnection } from "near-api-js";
import { jws } from "@textile/near-storage";

const near = await connect({ ... });

// Need to access wallet
const wallet = new WalletConnection(near, null);
const { accountId } = account;
const { signer, networkId } = account.connection;
const token = await jws(signer, { accountId, networkId })
console.log(token)
```

# API

For full API documentation, see https://textileio.github.io/near-storage-js.

The main `near-storage` entry point exposes an initialization function that takes a Near wallet connection, and returns a Storage object with a minimal API. The initialization function can optionally take information about a known broker, otherwise, a random broker (or a broker with which the user has previously interacted) is automatically selected:

```typescript
import { connect, WalletConnection } from "near-api-js";
import { init } from "@textile/near-storage";

const near = await connect({ ... });
const wallet = new WalletConnection(near, null);

const storage = init(wallet);
```

The core storage API revolves around two key concepts: _deposits_ and _storage_. Leaving a deposit provides a degree of Sybil resistance, such that users looking for store data on Filecoin via the Brokerage system must first "deposit" funds proportional to the length of time they'd like to continue storing data. To store data, a minimum (default) deposit must be left with a broker.

```typescript
await storage.requestSignIn();

const deposit = await storage.addDeposit();
console.log(deposit);
```

A deposit is generally valid for about 1hr (based on blocks), after which time, it can be released by the user, or any other party interacting with the smart contract (such as the broker itself). This provides a means to release funds after a storage "session" has completed, without locking funds in the contract during the Filecoin proof process.

Once a valid deposit is available, the app/user can push data to the broker using the `store` endpoint. This simply takes a File object, and send the bytes to the broker for preparation and storage. See [INSERT LINK TO BROKER DOCS HERE] for details on this process.

```typescript
const blob = new Blob(["Hello, world!"], { type: "text/plain" });
const file = new File([blob], "welcome.txt", {
  type: "text/plain",
  lastModified: new Date().getTime(),
});

const { id, cid } = await storage.store(file);
```

The "status" of the file can be queried using its `id`. The storage process ranges from "batching" files together, to "preparing" the storage deal, to "auctioning" the set of storage deals, to the actual "deal making" and "success" of the final storage deal on Filecoin. Along the way, clients may query the status in order to provide feedback to users.

```typescript
const status = await storage.status(id);
console.log(status);
```

# Maintainers

[@carsonfarmer](https://github.com/carsonfarmer)

# Contributing

PRs accepted.

Small note: If editing the README, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

# License

Dual MIT and Apache © 2021 Textile.io
