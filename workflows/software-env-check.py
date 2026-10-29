import importlib, importlib.util, importlib.metadata, json, sys
PACKAGES = {
    'onnx': ('onnx', 'onnx', '1.22.0', '1.22.0', ('onnx',)),
    'opencv': ('cv2', 'opencv-python', '4.13.0.92', '4.13.0', ('opencv-python', 'opencv-python-headless', 'opencv-contrib-python', 'opencv-contrib-python-headless')),
}
def inspect_package(kind, find_spec=importlib.util.find_spec, dist_version=importlib.metadata.version, import_module=importlib.import_module):
    if kind not in PACKAGES:
        return {'status': 'failed', 'stage': 'probe'}
    module, package, expected, runtime, related = PACKAGES[kind]
    try:
        installed = {}
        for name in related:
            try:
                installed[name] = dist_version(name)
            except importlib.metadata.PackageNotFoundError:
                pass
        present = bool(find_spec(module))
        if not present and not installed:
            return {'status': 'missing'}
        if not present or set(installed) != {package} or installed[package] != expected:
            return {'status': 'failed', 'stage': 'version'}
        version = getattr(import_module(module), '__version__', None)
        if version != runtime:
            return {'status': 'failed', 'stage': 'version'}
        return {'status': 'ready', 'version': version}
    except Exception:
        return {'status': 'failed', 'stage': 'import'}
def dependencies_ready(kind, python_version=sys.version_info, dist_version=importlib.metadata.version, import_module=importlib.import_module):
    if kind not in PACKAGES:
        return False
    try:
        from packaging.specifiers import SpecifierSet
        if kind == 'onnx':
            if tuple(python_version[:2]) < (3, 10):
                return False
            requirements = [('numpy','numpy','>=1.23.2'),('protobuf','google.protobuf','>=4.25.1'),('typing_extensions','typing_extensions','>=4.15.0'),('ml_dtypes','ml_dtypes','>=0.5.4')]
        else:
            requirements = [('numpy','numpy','>=2' if tuple(python_version[:2]) >= (3, 9) else '<2')]
        for package, module, spec in requirements:
            if dist_version(package) not in SpecifierSet(spec):
                return False
            import_module(module)
        return True
    except Exception:
        return False
def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ('state','dependencies') or sys.argv[2] not in PACKAGES:
        result = {'status':'failed','stage':'probe'}
    elif sys.argv[1] == 'state':
        result = inspect_package(sys.argv[2])
    else:
        result = {'status':'ready' if dependencies_ready(sys.argv[2]) else 'failed','stage':'dependencies'}
    print(json.dumps(result, separators=(',',':')))
if __name__ == '__main__':
    main()
