import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./frontend.html',import.meta.url),'utf8');
test('韬盛智训云提供六个独立工作区并可从详情跳转',()=>{
 assert.match(html,/<title>韬盛智训云/);
 for(const page of ['dashboard','exams','questions','environment','grading','settings'])assert.ok(html.includes(`data-page="${page}"`),page);
 assert.match(html,/function openWorkspace\(/);
 assert.match(html,/function revealWorkspaceTarget\(/);
 assert.ok(html.includes("revealWorkspaceTarget(document.querySelector('#material-panel'))"));
});
