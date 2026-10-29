import hashlib
import json
import os
import re
import stat
import sys
import zipfile

MAX_ARCHIVE = 2 * 1024**3
MAX_MANIFEST = 256 * 1024
WHEEL = re.compile(r'[A-Za-z0-9_.+-]+\.whl\Z')
HASH = re.compile(r'[a-f0-9]{64}\Z')

def verify(path, software, version, python, expected=None):
    if not re.fullmatch(r'[a-z0-9-]{1,50}', software) or not re.fullmatch(r'[0-9.]{1,20}', version) or python not in ('3.11','3.12','3.13') or (expected is not None and not HASH.fullmatch(expected)):
        raise ValueError('候选包参数无效')
    info = os.lstat(path)
    if not stat.S_ISREG(info.st_mode) or info.st_size < 1 or info.st_size > MAX_ARCHIVE:
        raise ValueError('归档文件无效')
    archive_hash = hashlib.sha256()
    with open(path, 'rb') as stream:
        before = os.fstat(stream.fileno())
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            archive_hash.update(chunk)
        digest = archive_hash.hexdigest()
        if expected is not None and digest != expected:
            raise ValueError('归档摘要不匹配')
        stream.seek(0)
        with zipfile.ZipFile(stream) as archive:
            entries = archive.infolist()
            names = [entry.filename for entry in entries]
            if not entries or len(entries) > 501 or len({x.casefold() for x in names}) != len(names) or names.count('manifest.json') != 1:
                raise ValueError('归档文件列表无效')
            for entry in entries:
                mode = (entry.external_attr >> 16) & 0o170000
                if entry.is_dir() or mode not in (0, stat.S_IFREG) or entry.compress_type != zipfile.ZIP_STORED or entry.flag_bits & 1:
                    raise ValueError('归档文件类型无效')
            manifest_info = archive.getinfo('manifest.json')
            if manifest_info.file_size < 1 or manifest_info.file_size > MAX_MANIFEST:
                raise ValueError('清单大小无效')
            manifest = json.loads(archive.read(manifest_info))
            if not isinstance(manifest, dict) or manifest.get('status') != 'candidate' or manifest.get('securityReviewRequired') is not True or manifest.get('windowsValidated') is not False or manifest.get('software') != software or manifest.get('version') != version or manifest.get('platform') != 'win_amd64' or manifest.get('python') != python:
                raise ValueError('候选包清单不匹配')
            files = manifest.get('files')
            if not isinstance(files, list) or not 1 <= len(files) <= 500:
                raise ValueError('依赖清单无效')
            expected_names = []
            total = 0
            for item in files:
                if not isinstance(item, dict) or set(item) != {'name','size','sha256'} or not isinstance(item['name'],str) or not WHEEL.fullmatch(item['name']) or type(item['size']) is not int or not 1 <= item['size'] <= MAX_ARCHIVE or not isinstance(item['sha256'],str) or not HASH.fullmatch(item['sha256']):
                    raise ValueError('依赖信息无效')
                total += item['size']
                if total > MAX_ARCHIVE:
                    raise ValueError('依赖总量超限')
                expected_names.append(item['name'])
                entry = archive.getinfo(item['name'])
                if entry.file_size != item['size']:
                    raise ValueError('依赖大小不匹配')
                wheel_hash = hashlib.sha256()
                with archive.open(entry) as wheel:
                    for chunk in iter(lambda: wheel.read(1024 * 1024), b''):
                        wheel_hash.update(chunk)
                if wheel_hash.hexdigest() != item['sha256']:
                    raise ValueError('依赖摘要不匹配')
            if len({x.casefold() for x in expected_names}) != len(expected_names) or set(names) != {'manifest.json', *expected_names}:
                raise ValueError('归档含额外文件')
        after = os.fstat(stream.fileno())
    current = os.lstat(path)
    if (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns) != (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns) or (after.st_dev,after.st_ino) != (current.st_dev,current.st_ino) or not stat.S_ISREG(current.st_mode):
        raise ValueError('归档在检查期间发生变化')
    return {'software':software,'version':version,'python':python,'files':len(files),'sha256':digest,'securityReviewRequired':True,'windowsValidated':False,'expectedDigestMatched':expected is not None}

if __name__ == '__main__':
    try:
        if len(sys.argv) not in (5,6):
            raise ValueError('参数无效')
        print(json.dumps(verify(*sys.argv[1:]), ensure_ascii=False, separators=(',',':')))
    except (OSError, ValueError, KeyError, TypeError, UnicodeError, zipfile.BadZipFile, json.JSONDecodeError, RuntimeError, EOFError, OverflowError, NotImplementedError):
        print('候选包验证失败', file=sys.stderr)
        raise SystemExit(1)
