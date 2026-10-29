import importlib.util
import os
import platform
import stat
import struct
import subprocess
import sys
import sysconfig
from pathlib import Path

spec=importlib.util.spec_from_file_location('wheelhouse_prepare',Path(__file__).with_name('wheelhouse-prepare.py'))
preparation=importlib.util.module_from_spec(spec)
spec.loader.exec_module(preparation)

def supported_platform(version):
    return (version in ('3.12','3.13') and sys.platform=='win32' and sys.implementation.name=='cpython' and f'{sys.version_info.major}.{sys.version_info.minor}'==version and struct.calcsize('P')==8 and platform.machine().lower() in ('amd64','x86_64') and not sysconfig.get_config_var('Py_GIL_DISABLED'))

def safe_environment():
    env=os.environ.copy()
    for name in ('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP','PYTHONUSERBASE','PYTHONINSPECT'):
        env.pop(name,None)
    env['PYTHONNOUSERSITE']='1'
    env['PYTHONDONTWRITEBYTECODE']='1'
    return env

def run_checked(args,env,timeout):
    return subprocess.run(args,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout,check=True,text=True)

def install(archive,prepared,environment,expected,python_version,platform_check=supported_platform):
    if not platform_check(python_version):
        raise ValueError('Python 或 Windows 平台不匹配')
    target=Path(environment).absolute()
    preparation.check_windows_parent(target.parent)
    if os.path.lexists(target):
        raise ValueError('目标环境已存在，不能覆盖')
    preparation.prepare(archive,prepared,'labelme','7.9.1',python_version,expected)
    if os.path.lexists(target):
        raise ValueError('目标环境已出现，不能覆盖')
    preparation.check_windows_parent(target.parent)
    env=safe_environment()
    venv_command=[sys.executable,'-m','venv']
    if os.name=='nt':
        venv_command.append('--copies')
    run_checked([*venv_command,str(target)],env,300)
    python=target/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
    launch=target/('Scripts/labelme.exe' if os.name=='nt' else 'bin/labelme')
    run_checked([str(python),'-m','pip','--isolated','install','--no-input','--no-index','--no-cache-dir','--no-deps','--require-hashes','--only-binary=:all:','-r',str(Path(prepared).absolute()/'requirements.txt')],env,1800)
    probe=run_checked([str(python),'-c',"import importlib.metadata as m; print(m.version('labelme'))"],env,60)
    if probe.stdout.strip()!='7.9.1' or not launch.is_file():
        raise ValueError('安装结果无法验证')
    item=os.lstat(launch)
    if not stat.S_ISREG(item.st_mode) or getattr(item,'st_file_attributes',0)&0x400:
        raise ValueError('程序入口不安全')
    return {'status':'installed','version':'7.9.1','guiValidated':False}

if __name__ == '__main__':
    import json
    try:
        if len(sys.argv)!=6:
            raise ValueError('参数无效')
        value=install(*sys.argv[1:])
    except Exception:
        value={'status':'unknown'}
    print('CLASSROOM_LABELME_INSTALL:'+json.dumps(value,ensure_ascii=True,separators=(',',':')))
