export function normalizeWallet(wallet: string) {
  return wallet.toLowerCase();
}

export function shortWallet(wallet: string) {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export function draftStorageKey(wallet: string) {
  return `roxmate_draft:${normalizeWallet(wallet)}`;
}
