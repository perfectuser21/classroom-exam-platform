import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def main(source,destination,name,version,python_version):
    if not re.fullmatch(r'[a-z0-9-]{1,50}',name) or not re.fullmatch(r'[0-9.]{1,20}',version) or not re.fullmatch(r'3\.(11|12|13)',python_version):raise ValueError('候选包信息无效')
    source=Path(source);destination=Path(destination);files=sorted(source.glob('*.whl'))
    if not files or len(files)>500:raise ValueError('安装包数量无效')
    entries=[];total=0
    for p in files:
        if p.is_symlink() or not p.is_file() or not re.fullmatch(r'[A-Za-z0-9_.+-]+\.whl',p.name):raise ValueError('安装包文件无效')
        size=p.stat().st_size;total+=size
        if size<1 or total>2*1024**3:raise ValueError('安装包大小无效')
        entries.append({'name':p.name,'size':size,'sha256':digest(p)})
    manifest={'status':'candidate','securityReviewRequired':True,'windowsValidated':False,'software':name,'version':version,'platform':'win_amd64','python':python_version,'files':entries}
    destination.parent.mkdir(parents=True,exist_ok=True,mode=0o700);fd,tmp=tempfile.mkstemp(prefix='.wheelhouse-',dir=str(destination.parent));os.fchmod(fd,0o600);os.close(fd)
    try:
        with zipfile.ZipFile(tmp,'w',compression=zipfile.ZIP_STORED,allowZip64=True) as z:
            z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
            for p in files:
                with p.open('rb') as src,z.open(p.name,'w',force_zip64=True) as out:shutil.copyfileobj(src,out,1024*1024)
        with zipfile.ZipFile(tmp) as z:
            if len(z.infolist())!=len(entries)+1:raise ValueError('归档文件数量不符')
            for e in entries:
                h=hashlib.sha256();size=0
                with z.open(e['name']) as f:
                    for chunk in iter(lambda:f.read(1024*1024),b''):size+=len(chunk);h.update(chunk)
                if size!=e['size'] or h.hexdigest()!=e['sha256']:raise ValueError('归档校验失败')
        os.link(tmp,destination)
        print(json.dumps({'name':name,'version':version,'files':len(entries),'sha256':digest(destination)},ensure_ascii=False))
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

if __name__=='__main__':
    if len(sys.argv)!=6:raise SystemExit('参数无效')
    main(*sys.argv[1:])
