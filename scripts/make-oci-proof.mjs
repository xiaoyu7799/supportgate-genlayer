import { writeFile } from 'node:fs/promises';
import { checkProof, readBounded, sha256 } from './oci-proof.mjs';

const [subjectPath, basePath, output] = process.argv.slice(2);
if (!subjectPath || !basePath || !output) throw new Error('Usage: node scripts/make-oci-proof.mjs SUBJECT_MANIFEST BASE_MANIFEST OUTPUT');
const [subject, base] = await Promise.all([readBounded(subjectPath,262144), readBounded(basePath,262144)]);
const proof = Buffer.from(JSON.stringify({version:1,subject_sha256:sha256(subject),base_sha256:sha256(base),
  base_manifest:base.toString('base64')})+'\n');
const verified = checkProof(subject, proof);
await writeFile(output, proof, {flag:'wx'});
console.log(JSON.stringify({subject:verified.subject_sha256,base:verified.base_sha256,proof:verified.proof_sha256}));
