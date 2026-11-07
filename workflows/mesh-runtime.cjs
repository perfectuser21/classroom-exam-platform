// MeshCentral 1.3.1's startup installer insists on obsolete exact versions,
// conflicting with the repository's security overrides. Adapt only those two
// startup pins in memory; all server, TLS and Agent behavior stays upstream.
const {readFileSync}=require('node:fs');
const {dirname}=require('node:path');
const Module=require('node:module');
exports.loadMeshRuntime=function(){
 const file=require.resolve('meshcentral'),localRequire=Module.createRequire(file);
 const overrides=require('../package.json').overrides;
 let source=readFileSync(file,'utf8');
 for(const [name,previous] of [['compression','1.8.1'],['node-forge','1.4.0']]){
  const version=localRequire(name+'/package.json').version;
  if(version!==overrides[name])throw Error('Mesh security dependency does not match repository override: '+name);
  const pin="'"+name+'@'+previous+"'";
  if(!source.includes(pin))throw Error('Mesh startup pin changed: '+name);
  source=source.replaceAll(pin,"'"+name+'@'+version+"'");
 }
 const runtime=new Module(file,module);runtime.filename=file;runtime.paths=Module._nodeModulePaths(dirname(file));
 runtime._compile(source,file);return runtime.exports;
};
