import assert from "node:assert/strict";
import test from "node:test";
import { sendRegistryTransaction } from "../lib/chain.ts";

test("partner writes stop before a wallet transaction on the legacy contract", async () => {
  const account = "0x0000000000000000000000000000000000000001";
  const other = "0x0000000000000000000000000000000000000002";
  const methods = [];
  const provider = {
    async request({ method }) {
      methods.push(method);
      if (method === "eth_accounts") return [account];
      if (method === "eth_chainId") return "0x279f";
      if (method === "eth_call") return "0x";
      throw new Error(`Unexpected wallet request: ${method}`);
    },
  };
  await assert.rejects(sendRegistryTransaction(provider, account, "invitePartner", [other]), /暂停邀请和评价交易/);
  assert.deepEqual(methods, ["eth_accounts", "eth_chainId", "eth_call"]);
});
