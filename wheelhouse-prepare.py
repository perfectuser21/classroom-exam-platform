import hashlib
import importlib.util
import json
import os
import re
import stat
import sys
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('wheelhouse_verify', Path(__file__).with_name('wheelhouse-verify.py'))
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def check_windows_parent(path):
    if os.name != 'nt':
        return
    for directory in (path, *path.parents):
        info = os.lstat(directory)
        if not stat.S_ISDIR(info.st_mode) or info.st_file_attributes & 0x400:
            raise ValueError('准备目录不可用')

def prepare(archive, destination, software, version, python, expected):
    if not isinstance(expected,str) or not re.fullmatch(r'[a-f0-9]{64}',expected):
        raise ValueError('缺少固定摘要')
    result = validator.verify(archive,software,version,python,expected)
    destination = Path(destination).absolute()
    check_windows_parent(destination.parent)
    os.mkdir(destination,0o700)
    requirements=[]
    with zipfile.ZipFile(archive) as package:
        manifest=json.loads(package.read('manifest.json'))
        if not isinstance(manifest,dict) or not isinstance(manifest.get('files'),list):
            raise ValueError('清单不可用')
        for entry in manifest['files']:
            name=entry.get('name')
            if not isinstance(name,str) or not validator.WHEEL.fullmatch(name) or not isinstance(entry.get('sha256'),str) or not validator.HASH.fullmatch(entry['sha256']) or type(entry.get('size')) is not int or entry['size']<1:
                raise ValueError('依赖信息无效')
            target=destination/name
            digest=hashlib.sha256()
            size=0
            with package.open(name) as source, target.open('xb') as output:
                for chunk in iter(lambda:source.read(1024*1024),b''):
                    size+=len(chunk)
                    if size>entry['size']:
                        raise ValueError('依赖大小异常')
                    digest.update(chunk)
                    output.write(chunk)
                output.flush()
                os.fsync(output.fileno())
            if size!=entry['size'] or digest.hexdigest()!=entry['sha256']:
                raise ValueError('依赖校验失败')
            requirements.append(target.as_uri()+'#sha256='+entry['sha256'])
    if len(requirements)!=result['files']:
        raise ValueError('依赖数量不一致')
    validator.verify(archive,software,version,python,expected)
    with (destination/'requirements.txt').open('x',encoding='utf8',newline='\n') as output:
        output.write('\n'.join(requirements)+'\n')
        output.flush()
        os.fsync(output.fileno())
    return {'software':software,'version':version,'python':python,'files':len(requirements),'prepared':True,'windowsValidated':False}

if __name__ == '__main__':
    try:
        if len(sys.argv)!=7:
            raise ValueError('参数无效')
        print(json.dumps(prepare(*sys.argv[1:]),ensure_ascii=False,separators=(',',':')))
    except (OSError,ValueError,KeyError,TypeError,UnicodeError,zipfile.BadZipFile,RuntimeError,EOFError,OverflowError,NotImplementedError):
        print('离线依赖准备失败；如果产生了新目录，请核对后清理。',file=sys.stderr)
        raise SystemExit(1)
