import json,struct,sys,sysconfig
def platform_info(platform=sys.platform,implementation=sys.implementation.name,version=sys.version_info,pointer_size=struct.calcsize('P'),gil_disabled=sysconfig.get_config_var('Py_GIL_DISABLED')):
    v=tuple(version[:2])
    if platform=='win32' and implementation=='cpython' and pointer_size==8 and not gil_disabled and v in ((3,10),(3,11),(3,12),(3,13)):
        return {'status':'supported','python':'%s.%s'%v}
    return {'status':'unsupported'}
if __name__ == '__main__':
    print(json.dumps(platform_info(),separators=(',',':')))
