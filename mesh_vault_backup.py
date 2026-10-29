#!/usr/bin/env python3
"""将本机 MeshCentral 核心状态备份至 1Password，归档只在内存中存在。"""
import datetime
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tarfile
import tempfile
import uuid

REQUIRED = frozenset(['config.json', 'meshcentral.db', 'meshcentral-events.db',
    'meshcentral-power.db', 'meshcentral-stats.db', 'root-cert-private.key',
    'root-cert-public.crt', 'agentserver-cert-private.key', 'agentserver-cert-public.crt',
    'webserver-cert-private.key', 'webserver-cert-public.crt', 'codesign-cert-private.key',
    'codesign-cert-public.crt', 'mpsserver-cert-private.key', 'mpsserver-cert-public.crt'])
GENERATED_DIRS = {'agentbuilds', 'signedagents'}
MAX_FILE = 32 * 1024 * 1024
MAX_ARCHIVE = 64 * 1024 * 1024


def read_regular(path):
    fd = os.open(str(path), os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_FILE:
            raise ValueError('文件类型或大小异常')
        with os.fdopen(fd, 'rb', closefd=False) as f:
            data = f.read(MAX_FILE + 1)
        if len(data) != info.st_size:
            raise ValueError('文件读取过程中发生变化')
        return data
    finally:
        os.close(fd)


def capture(root):
    root = Path(root)
    if root.is_symlink() or not root.is_dir():
        raise ValueError('数据目录不可用')
    names = []
    for p in root.iterdir():
        info = p.lstat()
        if stat.S_ISDIR(info.st_mode) and p.name in GENERATED_DIRS:
            continue
        if not stat.S_ISREG(info.st_mode):
            raise ValueError('数据目录存在意外条目')
        names.append(p.name)
    if not REQUIRED.issubset(names):
        raise ValueError('核心文件缺失')
    initial = {name: read_regular(root / name) for name in sorted(names)}
    if sum(map(len, initial.values())) > MAX_ARCHIVE:
        raise ValueError('备份数据超出限制')
    for name, data in initial.items():
        if read_regular(root / name) != data:
            raise ValueError('备份期间数据发生变化')
    if set(names) != {p.name for p in root.iterdir() if p.name not in GENERATED_DIRS}:
        raise ValueError('备份期间文件清单发生变化')
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as archive:
        for name, data in initial.items():
            entry = tarfile.TarInfo('meshcentral-data/' + name)
            entry.mode = 0o600
            entry.size = len(data)
            archive.addfile(entry, io.BytesIO(data))
    result = buf.getvalue()
    with tarfile.open(fileobj=io.BytesIO(result), mode='r:gz') as archive:
        for name, data in initial.items():
            if archive.extractfile('meshcentral-data/' + name).read() != data:
                raise ValueError('归档校验失败')
    return result


def upload_verified(data, title, run):
    run(['op', 'document', 'create', '-', '--vault', 'CS', '--title', title,
         '--file-name', 'meshcentral-core.tar.gz', '--format', 'json'], input=data)
    items = json.loads(run(['op', 'item', 'list', '--vault', 'CS', '--format', 'json']))
    matches = [item for item in items if item.get('title') == title and item.get('id')]
    if len(matches) != 1:
        raise ValueError('保险库文档无法唯一确认')
    item_id = matches[0]['id']
    restored = run(['op', 'document', 'get', item_id, '--vault', 'CS'])
    if not hashlib.sha256(restored).digest() == hashlib.sha256(data).digest():
        raise ValueError('保险库回读校验失败')
    return item_id


def atomic_status(path, data):
    path = Path(path)
    fd, tmp = tempfile.mkstemp(prefix='.mesh-backup-status-', dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as out:
            json.dump(data, out, ensure_ascii=False)
            out.flush(); os.fsync(out.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)


def main():
    os.umask(0o077)
    state = Path.home() / '.local/share/classroom-exam'
    state.mkdir(mode=0o700, parents=True, exist_ok=True)
    lock = os.open(str(state / '.mesh-vault-backup.lock'), os.O_CREAT | os.O_RDWR | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        status_path = state / 'mesh-vault-backup-status.json'
        try:
            previous = json.loads(status_path.read_text())
        except (OSError, ValueError): previous = {}
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        try:
            env = os.environ.copy()
            for line in (Path.home() / '.credentials/1password.env').read_text().splitlines():
                if '=' in line:
                    key, value = line.split('=', 1)
                    env[key] = value
            def run(args, input=None):
                result = subprocess.run(args, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                        env=env, timeout=120, check=False)
                if result.returncode: raise RuntimeError('保险库操作失败')
                return result.stdout
            data = capture(state / 'meshcentral-data')
            title = '机房考试 Mac MeshCentral 自动快照 ' + now[:10] + ' ' + uuid.uuid4().hex[:12]
            item_id = upload_verified(data, title, run)
            atomic_status(status_path, {'last_attempt': now, 'state': 'ok', 'last_success': now,
                                        'item_id': item_id, 'sha256': hashlib.sha256(data).hexdigest()})
            print('MeshCentral 保险库备份完成并已回读校验。')
        except Exception:
            atomic_status(status_path, {'last_attempt': now, 'state': 'failed',
                                        'last_success': previous.get('last_success')})
            print('MeshCentral 保险库备份失败，请检查服务和数据状态。', file=sys.stderr)
            return 1
        return 0
    finally:
        os.close(lock)

if __name__ == '__main__': sys.exit(main())
