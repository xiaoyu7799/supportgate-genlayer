# SupportGate

Consensus-backed Ubuntu LTS support gates for immutable software release manifests.

**Website:** https://xiaoyu7799.github.io/supportgate-genlayer/

**Source:** https://github.com/xiaoyu7799/supportgate-genlayer

A release engineer can claim an Ubuntu base is supported; a screenshot or CI flag is not independent evidence. SupportGate binds an exact artifact SHA-256, application, environment and Ubuntu codename to a public ticket. GenLayer validators independently fetch Ubuntu's official LTS release feed. Unsupported or unknown codenames cannot receive a release approval. The release transaction fetches the feed again, so an earlier READY decision cannot bypass a later support change.

## Current deployment

The contract is deployed on Stable Studionet. The deployed source matches `contracts/supportgate.py` byte for byte. Deployment transaction is FINALIZED with successful execution. The positive propose → evaluate → release lifecycle has FINALIZED/SUCCESS receipts and finalized readbacks. The GitHub Pages site serves the application and reads real finalized state. The production frontend has also completed real EIP-1193 temporary-wallet signing, official faucet funding, network setup, finality polling and finalized readback. Third-party wallet extension interfaces are not individually certified. No sample records or simulated transactions are presented as chain state.

- Contract: `0x9a274bBdF8deE8867A2Fe3d7c5ac584a60A19812`.
- Deployment: `0xfa8f6b2083735d278088b97113410ccb01c0d15901574c46e58b1544fc2feb01`.
- Receipt evidence: [`evidence/deployment.json`](evidence/deployment.json).

- Network: **Stable Studionet**, chain ID **61999** / `0xf22f`.
- RPC: `https://studio.genlayer.com/api`.
- SDK: exact `genlayer-js@1.1.8`.
- Official source: `https://changelogs.ubuntu.com/meta-release-lts`.
- Contract: [`contracts/supportgate.py`](contracts/supportgate.py).

## Run

Node.js 22+ and Python 3.12+ are recommended.

```sh
npm ci
npm test
npm run build
npm run dev
```

Vite serves the development app on port 4173. For a static production preview:

```sh
python3 -m http.server 4173 --directory dist
```

## Use the application

1. Connect an EIP-1193 injected wallet, or choose **Create temporary Studionet wallet** for a disposable real signer funded by the official Studio faucet. The temporary key lives only in this tab’s memory; reload, close or destroy it to discard access. EIP-6963 discovery lists independent providers; fallback discovery covers legacy MetaMask, OKX, Rabby and Coinbase Wallet providers. Wallet-specific signing compatibility must be verified in the target browser.
2. Switch or add Stable Studionet when requested.
3. Create a manifest with a unique lowercase reference, application name, environment, Ubuntu codename and the actual lowercase SHA-256 of your artifact. The file picker hashes locally; it never uploads the file. The codename is a declaration, not a proven property of the artifact.
4. Sign `propose`. Wait for FINALIZED and successful execution, then inspect the finalized record.
5. Select the manifest and **Verify official support**. A supported official LTS record yields READY; unsupported or missing records yield BLOCKED. Fetch failure or validator disagreement leaves prior state unchanged.
6. The proposer selects **Recheck & release**. The contract checks the expected revision, re-fetches support data under consensus and records RELEASED or BLOCKED. A successful transaction can legitimately return BLOCKED; the interface displays the readback state.
7. Download the receipt and readback. Use the CI consumer below before honoring an approval. A released manifest is immutable; create a new manifest for a different digest or base. A newer matching released ticket can supersede the older record.

Only chain reads populate the ledger. The signing wallet signs writes through its own provider. The app polls the GenLayer transaction, requires FINALIZED + SUCCESS, then reads `latest-final`. A pending hash is retained in session storage so monitoring can resume after a reload without automatically resubmitting.

See [temporary wallet behavior](docs/temporary-wallet.md) before using a disposable account.

## CI integration

After releasing a manifest, a pipeline can enforce the precise approval:

```sh
node scripts/check-release.mjs '0xowner:release-reference' ./release.tar.gz 'Billing API' production
```

This exits unsuccessfully unless the finalized ticket is RELEASED, its artifact hash, application and environment match, its support flag is true, and the support observation is no older than 24 hours. A SUPERSEDED record does not authorize release. The pipeline must also independently verify that the declared Ubuntu codename matches its actual base image. This application does not execute a deployment.

For repeated releases, propose a new unique reference for each artifact and environment. No paid API, backend database, relayer, server subscription or value transfer is required. Static hosting is sufficient; transactions use the browser wallet and public RPC. Availability depends on free Studionet and Ubuntu services.

## Deploy and verify

See [recorded verification](docs/verification.md), [deployment instructions](docs/deployment.md), [contract and consensus](docs/architecture.md), and [technical limitations](docs/limitations.md). Deployment and live scripts never generate a replacement signing account or use another network automatically.

```sh
npm run schema
# Supply the authorized Studionet key through the environment, never in source.
npm run deploy
npm run build
npm run live
```

`SUPPORTGATE_PRIVATE_KEY` is required by the deployment/live scripts. Never commit a key, `.env`, browser account export or credentials. Browser Studio can also deploy the complete Python source with no constructor arguments and Normal / Full Consensus. Copy verified public deployment metadata into `public/deployment.json` before building.

## Verification

`npm test` runs 11 mocked-host Python cases and 5 JavaScript cases covering policy decisions, permission checks, release-time revalidation, revision replay protection, source/parser failures, replacement constraints, network switching and receipt validation. These are local tests, not validator or wallet evidence.

`npm run schema` asks Stable Studionet's real GenVM to parse the contract. Schema acceptance alone proves neither deployment nor state transitions.

`npm run live` records every submitted hash before polling. It checks a supported propose → evaluate → release flow and an unsupported propose → evaluate → cancel flow. It requires actual FINALIZED/SUCCESS receipts and finalized state readbacks. Evidence is written only from actual RPC responses. Existing partial evidence must be inspected before restarting a failed live run.

## License

MIT. Ubuntu release information is supplied by Canonical's public service. Ubuntu and GenLayer names identify their respective projects; this application is independent.
