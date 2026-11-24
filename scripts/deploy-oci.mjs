import { startRun, ensureDeployment } from './oci-runtime.mjs';
const run = await startRun(3);
console.log(await ensureDeployment(run));
