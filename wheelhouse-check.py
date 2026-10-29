import sys,zipfile,email,collections
from pathlib import Path
from packaging.utils import parse_wheel_filename,canonicalize_name
from packaging.requirements import Requirement
from packaging.markers import default_environment
from packaging.specifiers import SpecifierSet
from packaging.tags import cpython_tags,compatible_tags
root,version,directory=sys.argv[1:]
env=default_environment();env.update({'python_version':version,'python_full_version':version+'.0','sys_platform':'win32','platform_system':'Windows','os_name':'nt','platform_machine':'AMD64','implementation_name':'cpython','platform_python_implementation':'CPython','implementation_version':version+'.0'})
target_version=tuple(map(int,version.split(".")));target_tags=set(cpython_tags(target_version,abis=["cp"+version.replace(".","")],platforms=["win_amd64"]))|set(compatible_tags(target_version,interpreter="cp"+version.replace(".",""),platforms=["win_amd64"]))
packages={}
for p in Path(directory).glob('*.whl'):
 name,ver,_,tags=parse_wheel_filename(p.name)
 if canonicalize_name(name) in packages:raise ValueError("duplicate package")
 if not (tags & target_tags):print("平台不符：",p.name);sys.exit(1)
 with zipfile.ZipFile(p) as z:
  metadata=[x for x in z.namelist() if x.endswith('.dist-info/METADATA') and x.count('/')==1]
  if len(metadata)!=1:raise ValueError('invalid wheel metadata')
  msg=email.message_from_bytes(z.read(metadata[0]));python_req=msg.get('Requires-Python');
  if python_req and not SpecifierSet(python_req).contains(version+'.0',prereleases=True): print('Python 版本不符：',name,python_req);sys.exit(1)
  packages[canonicalize_name(name)]=(ver,msg.get_all('Requires-Dist') or [])
active={canonicalize_name(root):set()};queue=collections.deque(active);missing=set();mismatch=set();seen=set()
while queue:
 name=queue.popleft();extras=active[name];signature=(name,tuple(sorted(extras)))
 if signature in seen:continue
 seen.add(signature)
 if name not in packages:missing.add(name);continue
 _,reqs=packages[name]
 for text in reqs:
  req=Requirement(text);enabled=not req.marker or any(req.marker.evaluate({**env,'extra':extra}) for extra in ['']+list(extras))
  if not enabled:continue
  target=canonicalize_name(req.name)
  if target not in packages:
   missing.add(target);print('缺少来源',name,'要求',text);continue
  ver,_=packages[target]
  if req.specifier and not req.specifier.contains(ver,prereleases=True):
   mismatch.add(target);print("冲突来源",name,"要求",text,"候选版本",ver)
  old=active.setdefault(target,set());before=len(old);old.update(req.extras)
  if target not in {x[0] for x in seen} or len(old)!=before:queue.append(target)
print('目标 Windows Python',version,'解析依赖',len(active),'缺少',len(missing),'版本冲突',len(mismatch))
if missing:print('缺少：',', '.join(sorted(missing)))
if mismatch:print('版本冲突：',', '.join(sorted(mismatch)))
sys.exit(bool(missing or mismatch))
