import {test} from 'node:test';import {strict as assert} from 'node:assert';import {readFileSync} from 'node:fs';
test('提供只读清理预览并明确不删除文件',()=>{const s=readFileSync(new URL('./frontend.html',import.meta.url),'utf8');for(const x of ['预览考试目录','/api/cleanup-previews','不会删除','仅列出前'])assert.ok(s.includes(x),x)});
