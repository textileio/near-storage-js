# @textile/near-storage

## Usage

```typescript
import { connect, WalletConnection } from "near-api-js";
import { openLockBox, store } from "@textile/near-storage";

const near = await connect({});

// Need to access wallet
const walletConnection = new WalletConnection(near);

const lockBox = openLockBox(walletConnection);

const blob = new Blob(["Hello, world!"], { type: "text/plain" });
const file = new File([blob], "my_image.txt", {
  type: "text/plain",
  lastModified: new Date().getTime(),
});

await lockBox.lockFunds();

const { cid } = await store(file, walletConnection);
console.log(cid);

await lockBox.unlockFunds();
```
