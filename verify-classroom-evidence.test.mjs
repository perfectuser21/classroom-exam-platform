import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=process.env.CLASSROOM_TEST_VERIFY_SCRIPT||resolve('.cursor/skills/verify-classroom/scripts/verify.sh');
const prior=['doctor.txt','staff-drive.txt','candidate-drive.txt','org-drive.txt','bank-drive.txt','class-drive.txt'];
function evidence(files){const run=mkdtempSync(join(tmpdir(),'classroom-evidence-test-'));try{for(const [file,text] of Object.entries(files))writeFileSync(join(run,file),text);const r=spawnSync('bash',[script,'evidence'],{env:{...process.env,CLASSROOM_VERIFY_RUN:run},encoding:'utf8'});return {status:r.status,result:readFileSync(join(run,'result.txt'),'utf8')}}finally{rmSync(run,{recursive:true,force:true})}}
const greens=Object.fromEntries(prior.map(f=>[f,'PASS prior feature\n']));
test('R0–R3 greens cannot certify missing R4 theory or cleanup',()=>{const r=evidence(greens);assert.equal(r.status,1);assert.match(r.result,/FAIL missing theory-drive.txt/);assert.match(r.result,/FAIL missing theory-cleanup.txt/)});
test('R4 Drive is insufficient until both cleanup receipts pass',()=>{const r=evidence({...greens,'theory-doctor.txt':'PASS prerequisites\n','theory-drive.txt':'PASS real theory E2E\n'});assert.equal(r.status,1);assert.match(r.result,/FAIL missing local-cleanup.txt/)});
const r5Greens={...greens,'theory-doctor.txt':'PASS prerequisites\n','practical-doctor.txt':'PASS R5 prerequisites\n','theory-drive.txt':'PASS theory E2E\n','practical-drive.txt':'PASS practical E2E\n','theory-cleanup.txt':'PASS Moodle cleanup\n','local-cleanup.txt':'PASS local cleanup\n'};
const r6Greens={'seat-env-doctor.txt':'PASS Windows prerequisites\n','seat-env-drive.txt':'PASS real installation and deletion\n','seat-env-cleanup.txt':'PASS owned Windows fixture cleanup\n'};
test('a failed theory, practical or cleanup receipt prevents overall PASS',()=>{
 for(const failed of ['theory-drive.txt','practical-doctor.txt','practical-drive.txt','theory-cleanup.txt','local-cleanup.txt']){
  const r=evidence({...r5Greens,...r6Greens,[failed]:'FAIL real step\n'});
  assert.equal(r.status,1);assert.doesNotMatch(r.result,/^PASS verify-classroom/m);
 }
});
test('all R0–R5 drives and verified cleanup retain their independent PASS',()=>{
 const r=evidence(r5Greens);assert.equal(r.status,1);
 assert.match(r.result,/^PASS verify-classroom R0–R5 theory and practical E2E \(including cleanup\)$/m);
});
test('R4 greens cannot certify missing practical Drive even with R6 greens',()=>{
 const files={...r5Greens,...r6Greens};delete files['practical-drive.txt'];
 const r=evidence(files);assert.equal(r.status,1);assert.match(r.result,/FAIL missing practical-drive.txt/);
 assert.doesNotMatch(r.result,/^PASS verify-classroom/m);
});
test('R0–R5 receipts cannot certify R6 without its Doctor and real Drive',()=>{
 const r=evidence(r5Greens);assert.equal(r.status,1);
 assert.match(r.result,/PASS verify-classroom R0–R5 theory and practical E2E/);
 assert.match(r.result,/FAIL missing seat-env-doctor.txt/);assert.match(r.result,/FAIL missing seat-env-drive.txt/);
 assert.match(r.result,/FAIL verify-classroom R6/);
});
test('R6 requires verified Windows fixture cleanup even after Doctor and Drive pass',()=>{
 const files={...r5Greens,...r6Greens};delete files['seat-env-cleanup.txt'];
 const missing=evidence(files);assert.equal(missing.status,1);assert.match(missing.result,/FAIL missing seat-env-cleanup.txt/);
 const all=evidence({...files,'seat-env-cleanup.txt':'PASS owned Windows fixture cleanup\n'});
 assert.equal(all.status,0);assert.match(all.result,/^PASS verify-classroom R6 seat install and cleanup$/m);
 assert.equal(evidence({...files,'seat-env-cleanup.txt':'FAIL outstanding fixture\n'}).status,1);
});
test('failed R6 Doctor or Drive prevents combined PASS after R0–R5 passed',()=>{
 for(const failed of ['seat-env-doctor.txt','seat-env-drive.txt']){
  const r=evidence({...r5Greens,...r6Greens,[failed]:'FAIL Windows step\n'});
  assert.equal(r.status,1);assert.match(r.result,/PASS verify-classroom R0–R5/);
  assert.doesNotMatch(r.result,/^PASS verify-classroom R6/m);
 }
});
