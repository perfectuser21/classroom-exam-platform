import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {validateSelection} from './preflight.mjs';
test('仅允许所选试点设备，拒绝空列表与未知设备',()=>{const ids=['a','b'];assert.deepEqual(validateSelection(['a'],ids),['a']);assert.throws(()=>validateSelection([],ids));assert.throws(()=>validateSelection(['c'],ids));assert.throws(()=>validateSelection(['a','a'],ids));});
