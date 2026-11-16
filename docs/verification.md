# Recorded verification

## Local and hosted checks

- 11 mocked-host Python contract cases and 5 JavaScript cases pass. These are local tests, not consensus evidence.
- Production Vite build passes. The SDK bundle produces a size warning, approximately 570 kB before gzip / 129 kB compressed; this is not a build failure.
- Stable Studionet's GenVM accepted the deployed contract schema. Deployed code matches the exact Python source. Source SHA-256 is in `public/deployment.json` and `evidence/deployment.json`.
- GitHub Actions runs tests and the production build before Pages publication. The initial hosting workflow is `https://github.com/xiaoyu7799/supportgate-genlayer/actions/runs/43942966808`.
- The production website renders actual finalized records from chain 61999. HTML, JavaScript, CSS and deployment metadata resource results are in `evidence/hosting.json`.
- Desktop browser checks cover loading, real finalized reads, ticket details, source history and the no-wallet connection state. Injected-wallet signing and mobile-device acceptance have not been completed. The browser used for these checks had no injected wallet, so the connection dialog correctly reported that condition.

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

## Remaining acceptance boundary

A Studio-account lifecycle proves contract execution. It does not prove signing through an injected browser wallet. Wallet-specific connect, switch/add network, signature, pending poll and final readback must be exercised from a browser with an authorized EIP-1193 wallet. No mock provider or locally synthesized success substitutes for that test.
