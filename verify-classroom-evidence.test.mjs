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
test('a failed R4 or cleanup receipt prevents overall PASS',()=>{for(const failed of ['theory-drive.txt','theory-cleanup.txt','local-cleanup.txt']){const files={...greens,'theory-doctor.txt':'PASS prerequisites\n','theory-drive.txt':'PASS theory E2E\n','theory-cleanup.txt':'PASS Moodle cleanup\n','local-cleanup.txt':'PASS local cleanup\n',[failed]:'FAIL real step\n'};const r=evidence(files);assert.equal(r.status,1);assert.doesNotMatch(r.result,/^PASS verify-classroom/m)}});
test('all R0–R4 drives and verified cleanup produce the final PASS',()=>{const r=evidence({...greens,'theory-doctor.txt':'PASS prerequisites\n','theory-drive.txt':'PASS theory E2E\n','theory-cleanup.txt':'PASS Moodle cleanup\n','local-cleanup.txt':'PASS local cleanup\n'});assert.equal(r.status,0);assert.match(r.result,/^PASS verify-classroom R0–R4 theory E2E \(including cleanup\)$/m)});
