import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';

test('real isolated Mesh account bootstrap honors installed security overrides without npm installation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'mesh-runtime-test-'));
 try{
  mkdirSync(join(dir,'data'));
  writeFileSync(join(dir,'data/config.json'),JSON.stringify({settings:{port:18443,redirPort:0},domains:{'':{}}}));
  const loader=resolve('workflows/mesh-runtime.cjs');
  const source=`process.argv=[process.execPath,require.resolve('meshcentral'),'--datapath',${JSON.stringify(join(dir,'data'))},'--launch','1','--createaccount','test-only-admin','--pass','test-only-password'];require(${JSON.stringify(loader)}).loadMeshRuntime().mainStart()`;
  const output=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['-e',source],{stdio:['pipe','pipe','pipe']});let output='';
   const timer=setTimeout(()=>{child.kill();reject(Error('Mesh account bootstrap timeout: '+output))},15000);
   child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);child.on('error',reject);
   child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(Error('Mesh bootstrap exit '+code+': '+output))});
  });
  assert.doesNotMatch(output,/Installing modules|Unable to install/);
  assert.match(output,/Done\./);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
