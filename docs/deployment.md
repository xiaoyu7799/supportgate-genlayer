# Deployment

## Stable Studionet

Only chain ID 61999 is supported. RPC: `https://studio.genlayer.com/api`. Use the pinned dependencies from `package-lock.json` with `npm ci`.

1. Run `npm test`, `npm run build` and `npm run schema`.
2. Supply an already authorized Studionet key as `SUPPORTGATE_PRIVATE_KEY` through a secure environment mechanism. Scripts do not generate accounts or print keys.
3. Run `npm run deploy`. It validates the chain, requests the contract schema, deploys with full consensus, polls for FINALIZED/SUCCESS, compares deployed source with the exact local file, and writes public metadata and the real deployment receipt.
4. Run `npm run build` and `npm run live`. Inspect every receipt and readback in `evidence/`. A pending deployment hash is retained in ignored `artifacts/deploy-pending.json`; inspect it before retrying.
5. To deploy through Studio instead, import `contracts/supportgate.py`, use Normal / Full Consensus, no constructor arguments, and the existing authorized Studio account. Verify the resulting source and receipt independently before configuring the address.
6. Record the address, deploy hash, source hash and correct chain in `public/deployment.json`. An address is never inferred from a local placeholder.

## GitHub Pages

Create a public repository under the authorized owner, push this source and enable Pages with **GitHub Actions** as its source. The included workflow runs local tests and the production build, uploads only `dist`, and deploys the Pages artifact. It requires normal repository workflow and Pages permissions. Forks should use their own approved owner and deployment configuration.

The relative Vite base supports a repository subpath. Check the actual public URL, JavaScript, stylesheet and `deployment.json` after publication. Static hosting does not need a secret or private key. Never add a signing key to Pages or client code.

## Browser acceptance

Use an actual installed injected wallet, not an in-page mock provider. Check connect, decline, reconnect, add/switch network, sign, pending-status polling, FINALIZED/SUCCESS and finalized ticket readback. Execute supported propose → evaluate → release, unsupported → BLOCKED, cancellation, and replacement linking. Check desktop and narrow mobile layouts. Export receipts from the UI and compare the public hashes and states with RPC/explorer data.

A Studio-created account alone does not prove an injected-wallet flow. Record these verifications separately and do not mark unexecuted steps as passed.
