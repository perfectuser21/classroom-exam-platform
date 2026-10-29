import {test} from 'node:test';import {strict as assert} from 'node:assert';import {readFileSync} from 'node:fs';
test('考试页面提供实操组卷、答案版本选择和加权成绩入口',()=>{const s=readFileSync(new URL('./frontend.html',import.meta.url),'utf8');for(const x of ['实操组卷与成绩','practical-plan-panel','/api/practical-plans','/api/practical-weighted-score','需选择答案版本'])assert.ok(s.includes(x),x)});
