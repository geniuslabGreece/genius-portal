import base64
import hashlib
import hmac
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('env_setup', Path(__file__).with_name('prepare-self-host-env.py'))
if spec is None or spec.loader is None:
    raise RuntimeError('Cannot load env setup helper')
env_setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(env_setup)


class EnvironmentSetupTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.portal = self.root / 'portal'
        self.stack = self.root / 'stack'
        self.portal.mkdir()
        self.stack.mkdir()
        (self.stack / '.env.example').write_text('POSTGRES_HOST=db\nJWT_SECRET=demo\n')
        (self.portal / '.env.docker.example').write_text(
            'VITE_SUPABASE_URL=https://api.geniusnetsoc.gr\nVITE_SUPABASE_PUBLISHABLE_KEY=placeholder\n')

    def test_public_key_matches_backend_without_exposing_service_key(self):
        env_setup.prepare(self.portal, self.stack)
        backend = env_setup.read_env(self.stack / '.env')
        frontend = env_setup.read_env(self.portal / '.env')
        self.assertEqual(frontend['VITE_SUPABASE_PUBLISHABLE_KEY'], backend['ANON_KEY'])
        self.assertNotIn(backend['SERVICE_ROLE_KEY'], (self.portal / '.env').read_text())
        parts = backend['ANON_KEY'].split('.')
        signature = base64.urlsafe_b64decode(parts[2] + '==')
        self.assertEqual(signature, hmac.new(backend['JWT_SECRET'].encode(), '.'.join(parts[:2]).encode(), hashlib.sha256).digest())
        self.assertEqual(json.loads(base64.urlsafe_b64decode(parts[1] + '=='))['role'], 'anon')

    def test_keys_meet_encryption_requirements(self):
        env_setup.prepare(self.portal, self.stack)
        values = env_setup.read_env(self.stack / '.env')
        self.assertEqual(len(base64.b64decode(values['AZURE_AD_ENC_KEY'])), 32)
        self.assertEqual(len(values['REALTIME_DB_ENC_KEY']), 16)
        self.assertEqual(len(values['VAULT_ENC_KEY']), 32)
        self.assertGreaterEqual(len(values['SECRET_KEY_BASE']), 64)

    def test_existing_configuration_is_never_overwritten(self):
        env_setup.prepare(self.portal, self.stack)
        before = (self.stack / '.env').read_bytes()
        with self.assertRaises(ValueError):
            env_setup.prepare(self.portal, self.stack)
        self.assertEqual((self.stack / '.env').read_bytes(), before)

    def test_files_are_private(self):
        env_setup.prepare(self.portal, self.stack)
        for path in (self.stack / '.env', self.portal / '.env'):
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_round_trip_handles_password_metacharacters(self):
        path = self.root / 'test.env'
        password = "secret $not_a_variable 'quoted' # keep-this"
        env_setup.write_env(path, {'PASSWORD': password})
        self.assertEqual(env_setup.read_env(path)['PASSWORD'], password)


if __name__ == '__main__':
    unittest.main()