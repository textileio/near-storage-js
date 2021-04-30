# @textile/near-storage

## Usage

```typescript
import { connect, WalletConnection } from "near-api-js";
import { openLockBox, openStore } from "@textile/near-storage";

const near = await connect({ ... });

// Need to access wallet
const wallet = new WalletConnection(near);

const lockBox = openLockBox(wallet);
const storage = openStore(wallet, { ... });

await lockBox.requestSignIn("my dapp");

const blob = new Blob(["Hello, world!"], { type: "text/plain" });
const file = new File([blob], "my_image.txt", {
  type: "text/plain",
  lastModified: new Date().getTime(),
});

await lockBox.lockFunds();

const { id, cid } = await storage.store(file);
console.log(cid);

await lockBox.unlockFunds();

const status = await storage.status(id)
console.log(status)

await lockBox.signOut();
```

Creating a JWS directly:

```typescript
import { connect, WalletConnection } from "near-api-js";
import { jws } from "@textile/near-storage";

const near = await connect({ ... });

// Need to access wallet
const wallet = new WalletConnection(near);
const { accountId } = account;
const { signer, networkId } = account.connection;
const token = await jws(signer, { accountId, networkId })
console.log(token)
```
