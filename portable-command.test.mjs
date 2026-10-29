import {test} from 'node:test';import {strict as assert} from 'node:assert';import {portableCommand,portableManifest} from './portable-command.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('Praat 和 SQLite 使用固定官方包、文件清单和 D 盘目标',()=>{for(const name of ['praat','sqlite']){const m=portableManifest(name),cmd=portableCommand(name,id);assert.ok(m.target.startsWith('D:\\'));assert.match(cmd,/^powershell\.exe -NoProfile -NonInteractive -EncodedCommand /);assert.ok(cmd.length<8000);assert.ok(m.files.length)}});
test('拒绝自定义软件、路径和任务标识',()=>{assert.throws(()=>portableManifest('other'));assert.throws(()=>portableCommand('praat','../other'))});
