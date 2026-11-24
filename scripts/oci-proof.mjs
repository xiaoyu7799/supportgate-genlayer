import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const imageTypes = ['application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'];

function require(condition, reason) {
  if (!condition) throw new Error('Release denied: ' + reason);
}

function manifest(bytes) {
  require(bytes.length <= 262144, 'manifest too large');
  const value = JSON.parse(bytes);
  const descriptors = [value.config, ...(Array.isArray(value.layers) ? value.layers : [])];
  require(value.schemaVersion === 2 && imageTypes.includes(value.mediaType) &&
    Array.isArray(value.layers) && value.layers.length > 0 &&
    descriptors.every(item => item && /^sha256:[a-f0-9]{64}$/.test(item.digest) &&
      Number.isSafeInteger(item.size) && item.size >= 0 && typeof item.mediaType === 'string'),
    'expected a single-platform image manifest with SHA-256 descriptors');
  return value;
}

export function checkProof(subjectBytes, proofBytes) {
  require(proofBytes.length <= 400000, 'proof too large');
  const proof = JSON.parse(proofBytes);
  require(proof.version === 1 && hex(proof.subject_sha256) && hex(proof.base_sha256) &&
    typeof proof.base_manifest === 'string', 'invalid build proof');
  const baseBytes = Buffer.from(proof.base_manifest, 'base64');
  require(proof.subject_sha256 === sha256(subjectBytes), 'subject manifest digest differs');
  require(proof.base_sha256 === sha256(baseBytes) && proof.base_sha256 !== proof.subject_sha256,
    'base manifest digest differs');
  const subject = manifest(subjectBytes);
  const base = manifest(baseBytes);
  require(base.layers.every((layer, index) => {
    const child = subject.layers[index];
    return child?.digest === layer.digest && child.size === layer.size && child.mediaType === layer.mediaType;
  }), 'subject does not begin with the pinned base layers');
  return {...proof, proof_sha256:sha256(proofBytes)};
}

export async function readBounded(path, max) {
  const contents = await readFile(path);
  require(contents.length <= max, 'input exceeds size limit');
  return contents;
}

export function checkApproval(ticket, proof, policy, now = Math.floor(Date.now()/1000)) {
  const attestation = ticket.provenance;
  const age = now - ticket.checked_at;
  require(ticket.state === 'RELEASED' && ticket.source?.supported === true &&
    Number.isSafeInteger(ticket.checked_at) && age >= 0 && age <= 86400, 'approval missing or older than 24 hours');
  require(ticket.application === policy.application && ticket.environment === policy.environment &&
    ticket.owner === policy.releaseOwner, 'unexpected application, environment or release owner');
  require(attestation?.builder === policy.trustedBuilder && attestation.attested_at > 0,
    'builder is not trusted by this pipeline');
  require(ticket.artifact_sha256 === proof.subject_sha256 && attestation.base_sha256 === proof.base_sha256 &&
    attestation.proof_sha256 === proof.proof_sha256, 'finalized ticket does not match these exact bytes');
  require(policy.ubuntuBases?.[proof.base_sha256] === ticket.codename, 'Ubuntu base digest is not pinned to this codename');
}
