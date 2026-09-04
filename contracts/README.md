# RoxMateRegistry

The registry now includes the personal on-chain data path: public identity cards, complete
published station scores, bounded profile/result pagination and the original jointly-signed
result API for backwards compatibility. Drafts stay local to the browser and are not contract
state. Identity cards intentionally contain no precise training schedule or contact data.

`MAX_MATCH_SCAN` is `10`. `getDiscoverableProfiles` and `getPersonalResultIds` reject larger
limits, so a client cannot request an unbounded page or accidentally scan the complete registry.
Every write (`updateProfile`, `publishPersonalResult`, ratings and future relationship writes)
is a user transaction; the submitting wallet confirms it and pays gas.

## Local tests

```bash
cd /Users/mayjlee/Documents/Codex/Monad/contracts
forge test
```

## Deploy to Monad testnet

Deployed on chain 10143 at `0x601c5e9007e52950575b46b84415b152853685d0`.
The receipt, block and transaction hash are recorded in `deployments/10143.json`.
Receipt status and a live `getIdentity` call were checked; explorer source verification is not yet performed.
The command below creates another deployment; it is not needed to restart the application.

```bash
export MONAD_TESTNET_RPC_URL="https://testnet-rpc.monad.xyz/"
forge script script/Deploy.s.sol:DeployRoxMateRegistry \
  --rpc-url "$MONAD_TESTNET_RPC_URL" \
  --network monad \
  --account roxmate-deployer \
  --broadcast
```

Use the encrypted Foundry account store and enter its password locally when prompted. The web app and worker do not need a deployer private key.
