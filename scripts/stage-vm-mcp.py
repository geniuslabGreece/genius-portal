#!/usr/bin/env python3
"""Build, but never activate, a VM-configured SDK function."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('env_setup', root / 'scripts/prepare-self-host-env.py')
if spec is None or spec.loader is None:
    raise RuntimeError('Environment parser unavailable')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
values = helper.read_env(root / '.env')
issuer = values.get('VITE_MCP_OAUTH_ISSUER')
if issuer != 'https://api.geniusnetsoc.gr/auth/v1':
    raise SystemExit('Set VITE_MCP_OAUTH_ISSUER to the verified VM discovery issuer before building.')
if values.get('VITE_SUPABASE_URL') != 'https://api.geniusnetsoc.gr':
    raise SystemExit('Portal must use the VM backend before staging VM tools.')
args = ['docker', 'build', '--target', 'mcp-artifacts']
for key in ('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PROJECT_ID', 'VITE_MCP_OAUTH_ISSUER'):
    if not values.get(key):
        raise SystemExit(f'Missing {key}')
    args.extend(['--build-arg', f'{key}={values[key]}'])
output = tempfile.mkdtemp(prefix='socportal-vm-mcp-')
subprocess.run([*args, '--output', f'type=local,dest={output}', '.'], cwd=root, check=True)
print(f'VM MCP bundle staged: {output}/mcp/index.ts')
print('Not installed or activated. Review OAuth signing keys and router prerequisites in SELF-HOST-MCP.md.')