# @textile/near-storage

## Usage

```typescript
import { connect, WalletConnection } from "near-api-js";
import { openLockBox, openStore } from "@textile/near-storage";

const near = await connect({ ... });

// Need to access wallet
const wallet = new WalletConnection(near);

const lockBox = openLockBox(wallet);
const store = openStore(wallet, { ... });

await lockBox.requestSignIn("my dapp");

const blob = new Blob(["Hello, world!"], { type: "text/plain" });
const file = new File([blob], "my_image.txt", {
  type: "text/plain",
  lastModified: new Date().getTime(),
});

await lockBox.lockFunds();

const { cid } = await store(file);
console.log(cid);

await lockBox.unlockFunds();

await lockBox.signOut();
```
