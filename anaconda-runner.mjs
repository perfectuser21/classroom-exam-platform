import {anacondaPlan} from './anaconda-workflow.mjs';
import {anacondaProbeCommand,parseAnacondaProbe} from './anaconda-probe.mjs';
import {anacondaCommand} from './anaconda-command.mjs';
import {parseAnacondaResult} from './anaconda-result.mjs';
import {anacondaExistingProbeCommand,parseAnacondaExistingProbe} from './anaconda-existing-probe.mjs';
export async function runAnaconda(name,id,{store,client,transport,stage=async()=>{}}){
 let current='local-check';
 try{
  current='probe';await stage(current);const probe=parseAnacondaProbe(await client.command(name,anacondaProbeCommand()));
  if(probe.targetExists)return parseAnacondaExistingProbe(await client.command(name,anacondaExistingProbeCommand(),{timeout:150000}));
  if(probe.existing)return {status:'blocked',reason:'existing'};
  current='local-check';const packageState=await store.inspect();if(packageState.status!=='ready')return {status:'blocked',reason:'installer'};
  const decision=anacondaPlan({...probe,installerVerified:true});if(decision!=='install'){const reason=probe.dFreeBytes<15*1024**3?'space':'verify';return {status:'blocked',reason}}
  current='transfer';await stage(current);const dir=await transport.prepare(name,id);await transport.upload(name,dir);await transport.verify(name,dir);
  current='install';await stage(current);const installed=parseAnacondaResult(await client.command(name,anacondaCommand(id),{timeout:1800000}));
  if(!['installed','already_ready'].includes(installed.status))return installed;
  current='verify';const checked=parseAnacondaExistingProbe(await client.command(name,anacondaExistingProbeCommand(),{timeout:150000}));
  if(checked.status!=='already_ready'||checked.version!==installed.version)return {status:'failed',stage:'verify'};
  return {status:installed.status,version:checked.version};
 }catch(error){return current==='probe'&&error?.code==='DEVICE_OFFLINE'?{status:'offline'}:{status:'unknown'}}
}
