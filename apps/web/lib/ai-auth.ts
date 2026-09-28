import { CHAIN_ID, REGISTRY_ADDRESS } from "./chain";

export type AiRequest = {
  wallet: string;
  cursor: number;
  issuedAt: number;
  nonce: string;
  signature: string;
};

export function aiRequestMessage(request: Omit<AiRequest, "signature">) {
  return [
    "RoxMate AI match explanation",
    `Chain ID: ${CHAIN_ID}`,
    `Registry: ${REGISTRY_ADDRESS.toLowerCase()}`,
    `Wallet: ${request.wallet.toLowerCase()}`,
    `Page cursor: ${request.cursor}`,
    `Issued at: ${request.issuedAt}`,
    `Nonce: ${request.nonce}`,
  ].join("\n");
}
