import importlib, importlib.util, importlib.metadata, json, struct, sys, sysconfig

def inspect_missing_ml(version=sys.version_info, dist_version=importlib.metadata.version, import_module=importlib.import_module, find_spec=importlib.util.find_spec):
    try:
        from packaging.specifiers import SpecifierSet
        v=tuple(version[:2]);numpy_min={(3,10):'>=1.23.2',(3,11):'>=1.23.3',(3,12):'>=1.26.0',(3,13):'>=2.1.0'}.get(v)
        if not numpy_min or find_spec('ml_dtypes'):
            return False
        try:
            dist_version('ml_dtypes')
            return False
        except importlib.metadata.PackageNotFoundError:
            pass
        for package,module,spec in [('numpy','numpy',numpy_min),('protobuf','google.protobuf','>=4.25.1'),('typing_extensions','typing_extensions','>=4.15.0')]:
            if dist_version(package) not in SpecifierSet(spec):
                return False
            import_module(module)
        return True
    except Exception:
        return False

def main():
    v=tuple(sys.version_info[:2])
    supported=sys.platform=='win32' and sys.implementation.name=='cpython' and struct.calcsize('P')==8 and not sysconfig.get_config_var('Py_GIL_DISABLED') and v in ((3,10),(3,11),(3,12),(3,13))
    result={'status':'missing','python':'%s.%s'%v} if supported and inspect_missing_ml() else {'status':'failed','stage':'dependencies'}
    print(json.dumps(result,separators=(',',':')))
if __name__=='__main__':
    main()
