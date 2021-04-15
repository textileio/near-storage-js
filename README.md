# @textile/near-storage

## Usage

```typescript
import { create } from "@textile/near-storage";
const storage = await create(); // Defaults should be fine

// Should already be logged in, if not:
await storage.signIn("my app)

console.log(storage.getAccountId());

await storage.lockFunds();

const blob = new Blob(["Hello, world!"], { type: "text/plain" });
const file = new File([blob], "my_image.txt", {
  type: "text/plain",
  lastModified: new Date().getTime(),
});

const { cid } = await storage.store(file);
console.log(cid);

await storage.unlockFunds();
```
