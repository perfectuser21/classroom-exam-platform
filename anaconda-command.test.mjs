import {gunzipSync} from 'node:zlib';import {test} from 'node:test';import {strict as assert} from 'node:assert';import {anacondaCommand} from './anaconda-command.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('只为合法任务生成固定 Anaconda 安装命令，使用隔离目录和 D 盘',()=>{const command=anacondaCommand(id);assert.match(command,/^powershell\.exe -NoProfile -NonInteractive -EncodedCommand /);const wrapper=Buffer.from(command.split(' ').at(-1),'base64').toString('utf16le'),match=wrapper.match(/FromBase64String\('([^']+)'\)/);assert.ok(match);const script=gunzipSync(Buffer.from(match[1],'base64')).toString('utf8');assert.ok(script.includes('D:\\ClassroomExam\\Installers\\'+id+'\\Anaconda3-2025.12-2-Windows-x86_64.exe'));assert.ok(script.includes('/D=D:\\Anaconda3'));assert.match(script,/Get-FileHash/)});
test('不接受任意脚本或路径',()=>{for(const id of ['../other','x;shutdown',''])assert.throws(()=>anacondaCommand(id))});
test('编码命令短于 Windows 命令行限制',()=>assert.ok(anacondaCommand(id).length<8000));
