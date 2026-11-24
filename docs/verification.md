# Verification evidence

## OCI milestone deployment — 2026-11-24

The OCI milestone is deployed as a new SupportGate protocol version 2 contract on Stable Studionet.

| Item | Recorded value |
| --- | --- |
| Chain ID | 61999 |
| Contract | 0xD252920A2995Af73aD1cbA2c38AfbcE5C01C5990 |
| Deployment transaction | 0x39ff7b330211e33b4e8b8ada83368eda26abc5ab23d5ba29a17e6b6e8538b6cd |
| Source file | contracts/supportgate.py |
| Source SHA-256 | a2ec3abeb14acaae46f573059cd50ed1f26081e77cd92f3a26303f5f84b198ba |
| Deployed/local source match | true |
| Verification record time | 2026-11-24T08:04:45.874Z |

The deployment transaction is FINALIZED with SUCCESS. The local source hash matches the deployed source hash. The deployed-source lint and schema record is evidence/oci/lint-deployed.json: genvm-lint 0.11.0 exited successfully, lint passed, and schema validation reported 10 methods (7 writes and 3 views). The record includes a non-blocking I200 notice that a newer runner is available.

### On-chain lifecycle evidence

evidence/oci/live.json retains the transaction journal and finalized readback snapshots. evidence/oci/verification.json contains the independently re-fetched transaction records, validator votes, execution outcomes and final records.

The acceptance run contains 23 business-operation transactions in addition to the deployment transaction. All 23 are FINALIZED. Nineteen operations have the expected SUCCESS result; four deliberately invalid operations have the expected contract execution error:

| Scenario | Expected rejection |
| --- | --- |
| Builder attempts to attest from the wrong wallet | BUILDER_ONLY |
| Release attempted while the ticket is not READY | NOT_READY |
| OCI evaluation attempted without builder attestation | BUILD_ATTESTATION_REQUIRED |
| Designated builder submits a mismatched subject digest | BUILD_MISMATCH |

Final ticket states read back from the contract:

| Ticket | Final state | Meaning |
| --- | --- | --- |
| Billing RC1 | SUPERSEDED | A later released revision replaced it |
| Billing RC2 | RELEASED | Builder-attested production manifest passed the gate |
| Search Indexer | RELEASED | Separate owner/builder, staging manifest |
| Legacy Worker | BLOCKED | Ubuntu source reported Supported: 0 |
| Metrics Exporter | PROPOSED | No valid builder attestation; evaluation rejected |
| Batch Scheduler | CANCELLED | Owner cancelled the proposal |

Key transaction references:

- Deployment: https://explorer-studio.genlayer.com/tx/0x39ff7b330211e33b4e8b8ada83368eda26abc5ab23d5ba29a17e6b6e8538b6cd
- Billing RC2 release: https://explorer-studio.genlayer.com/tx/0x6a46491e1e801e5b871ab6bdc1e559eb5d2cf15bdc6463de51337904f602ad1d
- Billing RC1 supersession: https://explorer-studio.genlayer.com/tx/0xb75c714f921700190c4fd096736e6981d93d22860d20fed3aae1d7986ffbcce6
- Missing-attestation rejection: https://explorer-studio.genlayer.com/tx/0xf50f26d14d1c22db422f79221bf4ff314be6e42286b219032019acc8daa1b255
- Wrong-builder rejection: https://explorer-studio.genlayer.com/tx/0x4482046cc1d1c77cda08246f749b1df8415902699e34208c64952cfa2ccecaf0

### OCI proof and release-gate checks

evidence/oci/gate-runs.json records three local CLI checks against the finalized ticket and demo proof bytes:

| Case | Result | Reason |
| --- | --- | --- |
| Exact approved Billing RC2 digest | ALLOW | Subject, base, proof, builder and finalized approval matched policy |
| Substituted image manifest | DENY | Subject manifest digest differed |
| Superseded Billing RC1 approval | DENY | No current release approval |

These are verifier/CI-gate acceptance results, not registry-promotion records. No OCI registry write or image promotion was performed. The Pages workflow publishes the static application only.

### Local test scope

npm test runs the deterministic Python host tests and Node tests. The current suite contains 12 Python test cases and 7 Node test cases. These tests cover contract rules under a mocked host, transaction finality handling, and OCI digest/policy checks. They are local tests, not GenLayer validator consensus evidence.

npm run verify:oci re-fetches the deployment and operation receipts, verifies the source hash and final ticket readbacks, checks the expected rejection codes, and writes evidence/oci/verification.json. It is a read-only chain verification; it does not submit new transactions.

## Historical SupportGate V1 evidence

The following records belong to the earlier SupportGate deployment and are retained as historical evidence. They are not the OCI milestone contract or its transaction set.

The earlier tickets belong to owner 0xab46c706e93dc7c9d4bfa4955ff562f7510b839f on contract 0x9a274bBdF8deE8867A2Fe3d7c5ac584a60A19812.

| Ticket reference | Codename | Source flag | Observed outcome | Evidence |
| --- | --- | --- | --- | --- |
| supportgate-source-1 | noble | Supported: 1 | PROPOSED → READY → RELEASED | propose.json, evaluate.json, release.json |
| supportgate-unsupported-1 | bionic | Supported: 1 | Evaluation permitted READY; record subsequently CANCELLED | bionic-propose.json, bionic-evaluate.json, bionic-cancel.json |
| supportgate-eol-1 | dapper | Supported: 0 | PROPOSED → BLOCKED → CANCELLED | eol-propose.json, eol-evaluate.json, eol-cancel.json |

The bionic case is retained as observed: the official source returned Supported: 1, and the contract followed that result. It is not relabeled as a rejection.

The earlier frontend signature evidence uses temporary account 0x583341eA2f8e721CD2daCAbe2D9864fd377986EC on the prior deployment. Its six calls reached FINALIZED/SUCCESS and demonstrated the EIP-1193 application path. That historical test does not by itself certify every third-party wallet interface or the newer OCI workflow.

The earlier headless-browser attempt is also retained: the official faucet credited a disposable account, but Chromium IPC was denied before a contract write. The temporary key was deleted. This failure is not counted as a successful transaction.

## Evidence boundaries

The on-chain Ubuntu decision records the official release-upgrader Supported flag at transaction time. It does not certify Ubuntu Pro/ESM entitlement, package compatibility, vulnerability status or a security patch SLA.

The OCI demo validates exact manifest/proof digests and ordered base-layer descriptors. It does not prove every build invocation, registry provenance, image runtime behavior or the absence of later layers that override base files. The consuming CI system must independently control its builder, base-image policy and promotion step.
