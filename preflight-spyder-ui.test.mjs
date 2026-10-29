import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('预检显示 Spyder 是否发现，缺少回执时明确未知',()=>{const html=readFileSync(new URL('./frontend.html',import.meta.url),'utf8');assert.match(html,/Spyder/);assert.match(html,/typeof x\.software\.spyder/);assert.match(html,/未返回/)});
