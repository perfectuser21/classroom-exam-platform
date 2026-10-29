import {test} from 'node:test';import {strict as assert} from 'node:assert';import {readFileSync} from 'node:fs';
test('工作台显示综合成绩权重、待评分状态及导出入口',()=>{const s=readFileSync(new URL('./frontend.html',import.meta.url),'utf8');for(const x of ['综合成绩','combined-policy-save','/api/combined-policy','/api/combined-results.csv','考试开始后不能设置'])assert.ok(s.includes(x),x)});
