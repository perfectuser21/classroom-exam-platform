import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readdirSync,rmSync,chmodSync,readFileSync as requireRead} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=new URL('./workflows/moodle-backup.sh',import.meta.url).pathname;
function fixture(){const root=mkdtempSync(join(tmpdir(),'classroom-backup-test-'));const state=join(root,'state'),moodle=join(root,'moodledata'),source=join(root,'moodle-code'),git=join(root,'fake-git'),docker=join(root,'docker');mkdirSync(state);mkdirSync(moodle);mkdirSync(source);writeFileSync(join(source,'version.php'),'<?php // test');writeFileSync(git,`#!/bin/bash
case "$*" in
 *'status --porcelain'*) [[ "\${FAKE_MOODLE_DIRTY:-}" == 1 ]] && printf ' M version.php\n'; exit 0 ;;
 *'ls-files --others --ignored'*) printf 'config.php\n' ;;
 *'cat-file -e HEAD:config.php'*) exit 1 ;;
 *'rev-parse HEAD'*) printf '%040d\n' 1 ;;
 *'archive --format=tar HEAD'*) tar -cf - -C "$FAKE_MOODLE_SOURCE" version.php ;;
 *) exit 2 ;;
esac
`);chmodSync(git,0o700);writeFileSync(join(state,'questions.json'),'[]');writeFileSync(join(moodle,'test'),'safe');writeFileSync(docker,`#!/bin/bash
case "$*" in
 *'inspect --format {{.Image}} classroom_moodle_pilot-webserver-1'*) printf '%s' 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' ;;
 *'inspect --format {{.Image}} classroom_moodle_pilot-db-1'*) printf '%s' 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' ;;
 *'image inspect --format {{json .RepoDigests}} sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'*) printf '%s' '["moodlehq/moodle-php-apache@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]' ;;
 *'image inspect --format {{json .RepoDigests}} sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'*) printf '%s' '["postgres@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]' ;;
 *'php -r'*) printf '%s' "\${FAKE_MOODLE_DB:-moodle}" ;;
 *'printf %s'*) printf '%s' moodle ;;
 *pg_dump*) [[ "\${FAIL_DUMP:-}" == 1 ]] && exit 1; printf 'database' ;;
 *pg_restore*) cat >/dev/null ;;
 *'tar -C'*) tar -cf - -C "$FAKE_ROOT" moodledata | gzip -c ;;
 *) exit 2 ;;
esac
`);chmodSync(docker,0o700);return {root,state,env:{...process.env,CLASSROOM_BACKUP_ROOT:join(root,'backups'),CLASSROOM_STATE_DIR:state,CLASSROOM_DOCKER:docker,CLASSROOM_MOODLE_SOURCE:source,CLASSROOM_MOODLE_GIT:git,FAKE_MOODLE_SOURCE:source,FAKE_ROOT:root}}}
test('备份完成后才公布目录，包含数据库、Moodle 文件、工作台状态及项目源码',()=>{const f=fixture();try{const r=spawnSync('bash',[script],{env:f.env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const names=readdirSync(f.env.CLASSROOM_BACKUP_ROOT);assert.equal(names.length,1);const dir=join(f.env.CLASSROOM_BACKUP_ROOT,names[0]);assert.deepEqual(readdirSync(dir).sort(),['database.dump','frontend-state.tar.gz','moodle-code-revision.txt','moodle-code.tar.gz','moodledata.tar.gz','runtime-manifest.json','source-code.tar.gz']);const list=spawnSync('tar',['-tzf',join(dir,'source-code.tar.gz')],{encoding:'utf8'});assert.equal(list.status,0);assert.match(list.stdout,/^gateway\.mjs$/m);assert.doesNotMatch(list.stdout,/meshcentral-data|\.key$|\.pem$|\.env$/m)}finally{rmSync(f.root,{recursive:true,force:true})}});
test('数据库备份失败不会留下可误认的成功备份',()=>{const f=fixture();try{const r=spawnSync('bash',[script],{env:{...f.env,FAIL_DUMP:'1'},encoding:'utf8'});assert.notEqual(r.status,0);assert.deepEqual(readdirSync(f.env.CLASSROOM_BACKUP_ROOT),[])}finally{rmSync(f.root,{recursive:true,force:true})}});

test('Moodle 配置的数据库与备份目标不一致时拒绝备份',()=>{const f=fixture();try{const r=spawnSync('bash',[script],{env:{...f.env,FAKE_MOODLE_DB:'different'},encoding:'utf8'});assert.notEqual(r.status,0);assert.deepEqual(readdirSync(f.env.CLASSROOM_BACKUP_ROOT),[])}finally{rmSync(f.root,{recursive:true,force:true})}});
test('备份包含 Moodle 程序及固定版本，且不包含配置凭据',()=>{const f=fixture();try{const r=spawnSync('bash',[script],{env:f.env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const dir=join(f.env.CLASSROOM_BACKUP_ROOT,readdirSync(f.env.CLASSROOM_BACKUP_ROOT)[0]);assert.ok(readdirSync(dir).includes('moodle-code.tar.gz'));assert.ok(readdirSync(dir).includes('moodle-code-revision.txt'));const contents=spawnSync('tar',['-tzf',join(dir,'moodle-code.tar.gz')],{encoding:'utf8'});assert.equal(contents.status,0);assert.match(contents.stdout,/version\.php/);assert.doesNotMatch(contents.stdout,/(^|\/)config\.php$/m)}finally{rmSync(f.root,{recursive:true,force:true})}});
test('Moodle 程序含未记录改动时拒绝生成不完整备份',()=>{const f=fixture();try{const r=spawnSync('bash',[script],{env:{...f.env,FAKE_MOODLE_DIRTY:'1'},encoding:'utf8'});assert.notEqual(r.status,0);assert.deepEqual(readdirSync(f.env.CLASSROOM_BACKUP_ROOT),[])}finally{rmSync(f.root,{recursive:true,force:true})}});
test('备份中包含固定镜像摘要和 Node 版本，不包含凭据',()=>{const f=fixture();try{const r=spawnSync('bash',[script],{env:f.env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const dir=join(f.env.CLASSROOM_BACKUP_ROOT,readdirSync(f.env.CLASSROOM_BACKUP_ROOT)[0]),meta=JSON.parse(requireRead(join(dir,'runtime-manifest.json')));assert.match(meta.moodleImage,/^moodlehq\/moodle-php-apache@sha256:[0-9a-f]{64}$/);assert.match(meta.databaseImage,/^postgres@sha256:[0-9a-f]{64}$/);assert.equal(Object.keys(meta).includes('password'),false)}finally{rmSync(f.root,{recursive:true,force:true})}});
