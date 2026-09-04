import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const deployment = JSON.parse(readFileSync(new URL('contracts/deployments/10143.json', root), 'utf8'));
const settings = {
  MONAD_TESTNET_RPC_URL: deployment.rpcUrl,
  MONAD_TESTNET_CHAIN_ID: String(deployment.chainId),
  REGISTRY_ADDRESS: deployment.address,
  REGISTRY_DEPLOYMENT_BLOCK: String(deployment.deploymentBlock),
};

function createConfig(relative, values) {
  const path = new URL(relative, root);
  if (existsSync(path)) {
    console.log(`Preserved existing ${relative}`);
    return;
  }
  writeFileSync(path, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log(`Created ${relative} (mode 600)`);
}

createConfig('apps/web/.env.local', { ...settings, NEXT_PUBLIC_REGISTRY_ADDRESS: deployment.address, NEXT_PUBLIC_MONAD_TESTNET_RPC_URL: deployment.rpcUrl, SESSION_SECRET: randomBytes(32).toString('hex') });
