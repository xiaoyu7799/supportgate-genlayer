# SupportGate · OCI release control

SupportGate checks whether an exact Ubuntu-based OCI image has a signed builder
attestation and a fresh, finalized Ubuntu support approval before a pipeline
publishes it. The release owner and the build signer are separate wallets.

[Open the control room](https://xiaoyu7799.github.io/supportgate-genlayer/) ·
[Stable Studionet contract](https://explorer-studio.genlayer.com/address/0xD252920A2995Af73aD1cbA2c38AfbcE5C01C5990)

## Release flow

1. Build a single-platform OCI image from a pinned Ubuntu image manifest.
   Save the raw image and base manifests. Create a proof file by running
   `node scripts/make-oci-proof.mjs image.json base.json proof.json`.
2. Open an OCI ticket in the control room. Enter the subject and base manifest
   SHA-256 digests, policy codename, environment, and a distinct builder
   wallet. The builder connects separately and uses **Attest build** to sign
   the digest of that exact proof file on-chain.
3. Run **Verify Ubuntu**. Validators independently fetch the official Ubuntu LTS
   release feed. The release owner can then **Recheck & release**, which repeats
   the live support check under consensus. Only finalized readbacks populate the
   application.
4. In a trusted CI checkout invoke the gate with the exact bytes that will be
   promoted. Run the promotion step only if it exits zero.

```sh
npm ci
node scripts/check-oci-release.mjs "$TICKET_ID" image.json proof.json release-policy.json
```

The policy file is controlled by the release pipeline, outside untrusted build
inputs. It pins chain `61999`, the contract, the release owner, the builder, the
application, the environment and the allowed base-digest-to-codename mapping.
Use [the demo policy](evidence/oci/demo-policy.json) as the field reference.
A registry promotion should use immutable image digests. See
[security model and CI sequence](docs/oci-gate.md).

## Verify

```sh
npm test
npm run build
python -m pip install genvm-linter==0.11.0
node scripts/lint-oci-deployed.mjs
node scripts/verify-oci.mjs
```

The build tests are local. [Deployed source lint](evidence/oci/lint-deployed.json),
[finalized receipts and readbacks](evidence/oci/verification.json) and
[transaction journal](evidence/oci/live.json) are independently reproducible
against Stable Studionet. [Deployment configuration](public/deployment.json)
records the exact contract source SHA-256. All study images and evidence use
public inputs. The demo tickets are test releases.

The [initial accepted version](https://github.com/xiaoyu7799/supportgate-genlayer/tree/124ba91c1ff122bd86e00795d445cc1407afe973)
has its own contract and receipts. The earlier evidence under `evidence/`
belongs to that version. The OCI deployment and evidence live in
`public/deployment.json` and `evidence/oci/`.
