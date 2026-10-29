import {test} from 'node:test';import {strict as assert} from 'node:assert';import {readFileSync} from 'node:fs';
test('实操组卷提供逐项素材核对和批量发放按钮',()=>{const s=readFileSync(new URL('./frontend.html',import.meta.url),'utf8');for(const x of ['/api/practical-delivery','核对并发放任务书','确认公开所选素材和全部任务书','未勾选素材'])assert.ok(s.includes(x),x)});
