import test from 'node:test';import assert from 'node:assert/strict';
import * as scope from './seat-map.mjs';
import {createMeshMaterialClient} from './mesh-material-client.mjs';
const seat={name:'R6-DISPOSABLE-01',group:'Classroom-R6-Disposable',id:'node//test-seat',disposable:true};
test('explicit disposable scope rejects shared names, wrong groups and unpinned identity',()=>{
 assert.equal(typeof scope.disposableSeatScope,'function');assert.equal(scope.disposableSeatScope({}),null);
 assert.deepEqual(scope.disposableSeatScope({CLASSROOM_VERIFY_DISPOSABLE_SEAT:JSON.stringify(seat)}),seat);
 for(const bad of [{...seat,name:'WIN-20230823FUQ'},{...seat,group:'教学机房-5台试点'},{...seat,id:''},{...seat,disposable:false}])assert.throws(()=>scope.disposableSeatScope({CLASSROOM_VERIFY_DISPOSABLE_SEAT:JSON.stringify(bad)}));
});
test('disposable Mesh commands pin both node id and group; duplicate identities fail closed',async()=>{
 let commands=0;let devices=[{name:seat.name,groupname:seat.group,_id:seat.id,conn:1}];
 const client=createMeshMaterialClient({disposableSeat:seat,invoke:async args=>{if(args[0]==='ListDevices')return JSON.stringify(devices);commands++;return 'real reply'}});
 assert.equal(await client.command(seat.name,'read-only probe'),'real reply');
 for(const rows of [[{...devices[0],_id:'node//other'}],[{...devices[0],groupname:'教学机房-5台试点'}],[devices[0],devices[0]]]){devices=rows;await assert.rejects(client.command(seat.name,'read-only probe'))}assert.equal(commands,1);
});

test('disposable client refuses shared pilot commands before inventory lookup',async()=>{
 const client=createMeshMaterialClient({disposableSeat:seat,invoke:async()=>{throw Error('must not contact mesh')}});await assert.rejects(client.command('WIN-20230823FUQ','write'),/临时验证仅允许指定工位/);
});
