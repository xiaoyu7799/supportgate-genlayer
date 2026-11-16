# Recorded verification

## Local and hosted checks

- 11 mocked-host Python contract cases and 5 JavaScript cases pass. These are local tests, not consensus evidence.
- Production Vite build passes. The SDK bundle produces a size warning, approximately 587 kB before gzip / 134 kB compressed; this is not a build failure.
- Stable Studionet's GenVM accepted the deployed contract schema. Deployed code matches the exact Python source. Source SHA-256 is in `public/deployment.json` and `evidence/deployment.json`.
- GitHub Actions runs tests and the production build before Pages publication. The initial hosting workflow is `https://github.com/xiaoyu7799/supportgate-genlayer/actions/runs/43942966808`.
- The production website renders actual finalized records from chain 61999. HTML, JavaScript, CSS and deployment metadata resource results are in `evidence/hosting.json`.
- Desktop browser checks cover loading, real finalized reads, ticket details, source history and the no-wallet connection state. The production frontend additionally uses a real temporary EIP-1193 signer, funded by the official Studio faucet, through the same provider connection and signing path. Physical mobile-device and individual third-party extension interfaces are not certified.

## Chain observations

The following tickets belong to `0xab46c706e93dc7c9d4bfa4955ff562f7510b839f` on contract `0x9a274bBdF8deE8867A2Fe3d7c5ac584a60A19812`.

| Ticket reference | Codename | Source flag | Observed outcome | Evidence |
| --- | --- | --- | --- | --- |
| supportgate-source-1 | noble | Supported: 1 | PROPOSED → READY → RELEASED | propose.json, evaluate.json, release.json |
| supportgate-unsupported-1 | bionic | Supported: 1 | Evaluation permitted READY; record subsequently CANCELLED | bionic-propose.json, bionic-evaluate.json, bionic-cancel.json |
| supportgate-eol-1 | dapper | Supported: 0 | PROPOSED → BLOCKED → CANCELLED | eol-propose.json, eol-evaluate.json, eol-cancel.json |

Every recorded transaction is checked for FINALIZED and successful execution, independently through RPC. The chain's affirmative support decision for bionic contradicted the initial negative-sample expectation; the contract correctly followed the official flag. That case is retained rather than relabeled as a rejection. This is one reason the product describes the precise release-upgrader flag rather than promising general security support or entitlement.

The acceptance artifact is the exact contract source file, hashed and declared against an Ubuntu codename. This tests approval semantics; it does not prove the source file's base-image provenance or execution of a deployment. The product's actual base-image verification obligation remains with the consuming CI system.

Receipt files retain public transaction identity, status and leader execution outcomes plus finalized readbacks. Redundant code/state encodings and validator configuration logs are omitted. Files explicitly identify when a readback includes a later transaction; the original event history remains on chain. Re-fetch hashes through the public RPC or explorer to verify independently.

## Production frontend signature evidence

The production GitHub Pages application generated a disposable secp256k1 account and obtained 1 test GEN from the official Studio faucet. It registered Stable Studionet through `wallet_addEthereumChain`, switched through `wallet_switchEthereumChain`, identified the account through `eth_requestAccounts`, and signed calls through `eth_sendTransaction`. The provider broadcast each serialized signature through the real `eth_sendRawTransaction` RPC.

| Browser ticket | Calls exercised in the published UI | Final state |
| --- | --- | --- |
| browser-live-61999-1 | propose → evaluate → release | RELEASED |
| browser-eol-61999-1 | propose → evaluate → cancel | CANCELLED; prior finalized observation BLOCKED |

All six calls use `0x583341eA2f8e721CD2daCAbe2D9864fd377986EC`. Their nonces are 0–5 and their signatures independently recover that same address. All six receipts are FINALIZED/SUCCESS. The positive release transaction is `0xfe879293bf00cad3ea251c8a0653542aff3ede27c9c2ecf315ae5a6a7052f5f1`.

The browser exports under `evidence/browser/ui-*.json` retain each real receipt, its finalized UI readback and the public provider proof. `scripts/verify-browser-proof.mjs` independently recovers the signer from each raw signed transaction, checks chain 61999 and zero value, re-fetches FINALIZED/SUCCESS from the public RPC and reads the final ticket state. `poll-observations.json` records actual visible intermediate and final UI states. `wallet-cleanup.json` records disposal of the in-memory signer.

The temporary adapter is part of the published source and uses real cryptography and real Studionet responses; it does not synthesize transaction success or contract state. No relayer or host-private key is needed. This verifies the EIP-1193 application path, not the separate user interfaces of MetaMask, OKX, Rabby or Coinbase Wallet.

The retained `headless-attempt.json` records an earlier failed automated-browser launch: the official faucet credited a disposable account, but Chromium IPC was denied before any contract write. That signing key was deleted. The successful acceptance used the existing browser instead.

To independently recheck the public signatures and receipts:

```sh
node scripts/verify-browser-proof.mjs
```
