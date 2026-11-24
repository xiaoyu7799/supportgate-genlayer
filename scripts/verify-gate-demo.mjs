import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {promisify} from 'node:util';

const dir='evidence/oci';
const live=JSON.parse(await readFile(dir+'/live.json'));
assert(live.complete);
const current=live.snapshots['billing-rc2'].id;
const earlier=live.snapshots['billing-rc1'].id;
const base=dir+'/builds/';
const gate=promisify(execFile);
const cases=[
  {name:'approved-exact-digest',id:current,image:'billing-rc2',proof:'billing-rc2',decision:'ALLOW'},
  {name:'substituted-image',id:current,image:'billing-rc1',proof:'billing-rc2',decision:'DENY',message:'subject manifest digest differs'},
  {name:'superseded-approval',id:earlier,image:'billing-rc1',proof:'billing-rc1',decision:'DENY',message:'approval missing'},
];
const results=await Promise.all(cases.map(async c=>{
  const args=['scripts/check-oci-release.mjs',c.id,base+c.image+'/manifest.json',base+c.proof+'/proof.json',dir+'/demo-policy.json'];
  if(c.decision==='ALLOW'){
    const {stdout}=await gate(process.execPath,args);
    const output=JSON.parse(stdout);
    assert.equal(output.decision,'ALLOW');
    return {name:c.name,command:args,exitCode:0,output};
  }
  try{
    await gate(process.execPath,args);
    assert.fail(c.name+' was not denied');
  }catch(error){
    assert.equal(error.code,1);
    assert(error.stderr.includes(c.message),error.stderr);
    return {name:c.name,command:args,exitCode:1,output:{decision:'DENY',reason:c.message}};
  }
}));
await writeFile(dir+'/gate-runs.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
console.log(results.map(result=>result.name+' '+result.output.decision).join('\n'));
