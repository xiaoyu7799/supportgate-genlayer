# Build, deploy and verify

## Environment

- Node.js 22 and Python 3.12 are used by the GitHub Actions build.
- Stable Studionet only: chain ID 61999, RPC https://studio.genlayer.com/api.
- Install the exact lockfile dependencies with npm ci.
- Do not put signing keys in source files, Pages configuration, or committed evidence.

## Local checks

1. Run npm ci.
2. Run npm test for the deterministic Python host tests and Node tests.
3. Run npm run build for the production Vite build.
4. Run npm run schema to ask Stable Studionet to validate the contract schema. The generated schema is written under the ignored artifacts directory.

These checks are useful development checks. Local tests and schema acceptance do not replace finalized on-chain evidence.

## Deploy the contract

The current npm run deploy script uses scripts/oci-runtime.mjs. It does not read SUPPORTGATE_PRIVATE_KEY.

1. Run npm run deploy. The runtime verifies chain 61999, creates three disposable local signing accounts when starting a fresh run, and requests test GEN from the official Studio sim_fundAccount faucet.
2. The signer journal is kept locally under artifacts/signers.json with restrictive file permissions where supported. The directory is ignored by Git. Do not publish or commit this file.
3. The deployment script requests the contract schema, deploys contracts/supportgate.py with full consensus, waits for FINALIZED, requires successful execution, and compares the deployed contract source byte-for-byte with the local source.
4. On success it writes the contract address, deployment transaction and source hash to public/deployment.json and records the deployment receipt in evidence/oci/live.json.

The runtime also journals submitted transaction hashes so a pending operation can be resumed without submitting it again.

## Run the OCI acceptance sequence

1. Run npm run live after deployment. It reuses the same local run journal and disposable signers.
2. The script submits the six documented OCI ticket scenarios, waits for each transaction to become FINALIZED, checks the expected execution result, and reads back the resulting ticket states.
3. The scenarios cover normal release, a different owner and builder, a blocked Ubuntu release, missing builder attestation, invalid builder/subject attempts, cancellation and supersession.
4. When the complete run is recorded, the script removes artifacts/signers.json and records keyCleanup in evidence/oci/live.json.

If a run is interrupted, preserve evidence/oci/live.json and the local artifacts/signers.json together. Resume the same run; do not delete the journal or generate replacement keys while recorded transactions are pending. Never commit or upload the signer file. After successful completion the runtime removes it.

## Independent verification

Run npm run verify:oci to re-fetch the recorded transactions and contract state from Stable Studionet, compare the deployed source hash, check expected success and rejection outcomes, validate the six ticket snapshots, and re-check the OCI proof and policy cases. The command writes evidence/oci/verification.json. It does not submit new contract transactions.

The deployment and acceptance evidence is public. Verify transaction hashes and finalized state through the Stable Studionet RPC or explorer rather than treating a local log alone as proof.

## GitHub Pages

The workflow in .github/workflows/pages.yml runs npm ci, npm test and npm run build on pushes to main and on manual dispatch. It uploads dist and deploys the static Pages artifact. It does not deploy the GenLayer contract, run the OCI release gate, or publish an OCI image.

The application reads public/deployment.json at runtime. Static hosting requires no contract signing key. Check the deployed page, its JavaScript and CSS assets, and the deployment metadata after publication.

## Browser wallet testing

An injected wallet can connect through the standard EIP-1193 flow. The optional temporary wallet creates a disposable account in the current tab, obtains test GEN from the official Studio faucet, and signs real zero-value SupportGate calls. Its private key is held only in a closure in tab memory and is destroyed when the wallet is disposed or the page is reloaded/closed.

This is separate from the local disposable signers used by scripts/oci-runtime.mjs. The temporary browser signer demonstrates the application provider path; it does not certify the UI or behavior of every third-party extension or mobile wallet.
