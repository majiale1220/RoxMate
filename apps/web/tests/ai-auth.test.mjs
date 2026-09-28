import assert from "node:assert/strict";
import test from "node:test";
import { verifyMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { aiRequestMessage } from "../lib/ai-auth.ts";

test("AI signature is bound to the wallet, registry and page cursor", async () => {
  const account = privateKeyToAccount(`0x${"1".repeat(64)}`);
  const request = {
    wallet: account.address,
    cursor: 14,
    issuedAt: 1_800_000_000_000,
    nonce: "00000000-0000-4000-8000-000000000001",
  };
  const message = aiRequestMessage(request);
  const signature = await account.signMessage({ message });
  assert.match(message, /Chain ID: 10143/);
  assert.match(message, /Registry: 0x[0-9a-f]{40}/);
  assert.equal(await verifyMessage({ address: account.address, message, signature }), true);
  assert.equal(await verifyMessage({ address: account.address, message: aiRequestMessage({ ...request, cursor: 13 }), signature }), false);
  assert.equal(await verifyMessage({ address: "0x0000000000000000000000000000000000000001", message, signature }), false);
});
