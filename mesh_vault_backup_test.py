import io, json, os, tarfile, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import mesh_vault_backup as backup

class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for name in backup.REQUIRED:
            (self.root / name).write_bytes(('sample-'+name).encode())
        (self.root / 'signedagents').mkdir()
        (self.root / 'agentbuilds').mkdir()
    def tearDown(self): self.temp.cleanup()
    def test_capture_round_trip_and_excludes_generated(self):
        data = backup.capture(self.root)
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as f:
            self.assertEqual(set(f.getnames()), {'meshcentral-data/'+n for n in backup.REQUIRED})
            self.assertEqual(f.extractfile('meshcentral-data/config.json').read(), b'sample-config.json')
    def test_missing_file_rejected(self):
        (self.root / 'root-cert-private.key').unlink()
        with self.assertRaises(ValueError): backup.capture(self.root)
    def test_symlink_and_unknown_directory_rejected(self):
        (self.root / 'evil').symlink_to(self.root / 'config.json')
        with self.assertRaises(ValueError): backup.capture(self.root)
        (self.root / 'evil').unlink(); (self.root / 'unexpected').mkdir()
        with self.assertRaises(ValueError): backup.capture(self.root)
    def test_changed_source_rejected(self):
        original=backup.read_regular
        def changed(path):
            data=original(path)
            if path.name=='config.json': path.write_bytes(data+b'x')
            return data
        with patch.object(backup, 'read_regular', side_effect=changed):
            with self.assertRaises(ValueError): backup.capture(self.root)
    def test_bad_vault_readback_fails(self):
        def run(args, input=None):
            if args[1:3]==['document','create']: return b'{}'
            if args[1:3]==['item','list']: return json.dumps([{'id':'id','title':'title'}]).encode()
            if args[1:3]==['document','get']: return b'wrong'
            raise AssertionError(args)
        with self.assertRaises(ValueError): backup.upload_verified(b'data','title',run)
    def test_vault_verified_success(self):
        def run(args, input=None):
            if args[1:3]==['document','create']:
                self.assertEqual(input,b'data');return b'{}'
            if args[1:3]==['item','list']:return json.dumps([{'id':'id','title':'title'}]).encode()
            if args[1:3]==['document','get']:return b'data'
            raise AssertionError(args)
        self.assertEqual(backup.upload_verified(b'data','title',run),'id')
if __name__ == '__main__': unittest.main()
