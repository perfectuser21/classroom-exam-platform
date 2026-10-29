'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),patch=require('./meshcentral-patch.cjs');
const filename=require.resolve('meshcentral/meshcentral.js');for(const [name,version] of [['compression','1.8.2'],['node-forge','1.4.2']])if(require(name+'/package.json').version!==version)throw Error('MeshCentral 安全依赖版本不符');
const signing=path.join(path.dirname(filename),'authenticode.js'),signingModule=new Module(signing,module);signingModule.filename=signing;signingModule.paths=Module._nodeModulePaths(path.dirname(signing));signingModule._compile(patch.authenticode(fs.readFileSync(signing,'utf8')),signing);require.cache[signing]=signingModule;
const source=patch(fs.readFileSync(filename,'utf8')),app=new Module(filename,module);app.filename=filename;app.paths=Module._nodeModulePaths(path.dirname(filename));app._compile(source,filename);if(typeof app.exports.mainStart!=='function')throw Error('MeshCentral 启动入口无效');app.exports.mainStart();
