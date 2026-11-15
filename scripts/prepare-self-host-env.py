#!/usr/bin/env python3
"""Prepare VM-only env files; never print credentials or overwrite existing keys."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import shlex
import sys
import time


def read_env(path):
    values = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        parts = shlex.split(value, comments=True)
        values[key.strip()] = ' '.join(parts)
    return values


def jwt(secret, role):
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).rstrip(b'=')
    now = int(time.time())
    payload = encode({'alg': 'HS256', 'typ': 'JWT'}) + b'.' + encode(
        {'role': role, 'iss': 'supabase', 'iat': now, 'exp': now + 315360000})
    signature = base64.urlsafe_b64encode(hmac.new(secret.encode(), payload, hashlib.sha256).digest()).rstrip(b'=')
    return (payload + b'.' + signature).decode()


def write_env(path, values):
    # Exclusive create: never rotate existing database/encryption keys accidentally.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as file:
        for key, value in values.items():
            file.write(f'{key}={shlex.quote(str(value))}\n')


def prepare(portal, stack):
    backend = stack / '.env'
    frontend = portal / '.env'
    if frontend.exists():
        raise ValueError('Portal .env already exists. Back it up and review it manually; nothing overwritten.')
    if backend.exists():
        values = read_env(backend)
        for key in ('JWT_SECRET', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'AZURE_AD_ENC_KEY'):
            if not values.get(key) or 'your-' in values[key] or '<' in values[key]:
                raise ValueError(f'Existing backend .env needs a real {key}; nothing overwritten.')
    else:
        values = read_env(stack / '.env.example')
        for key, size in {
            'POSTGRES_PASSWORD': 24, 'JWT_SECRET': 32, 'DASHBOARD_PASSWORD': 24,
            'SECRET_KEY_BASE': 32, 'REALTIME_DB_ENC_KEY': 8, 'VAULT_ENC_KEY': 16,
            'PG_META_CRYPTO_KEY': 32, 'LOGFLARE_PUBLIC_ACCESS_TOKEN': 32,
            'LOGFLARE_PRIVATE_ACCESS_TOKEN': 32, 'S3_PROTOCOL_ACCESS_KEY_ID': 16,
            'S3_PROTOCOL_ACCESS_KEY_SECRET': 32,
        }.items():
            values[key] = secrets.token_hex(size)
        values['AZURE_AD_ENC_KEY'] = base64.b64encode(secrets.token_bytes(32)).decode()
        values['ANON_KEY'] = jwt(values['JWT_SECRET'], 'anon')
        values['SERVICE_ROLE_KEY'] = jwt(values['JWT_SECRET'], 'service_role')
        values.update({
            'SITE_URL': 'https://geniusnetsoc.gr',
            'API_EXTERNAL_URL': 'https://api.geniusnetsoc.gr',
            'SUPABASE_PUBLIC_URL': 'https://api.geniusnetsoc.gr',
            'ADDITIONAL_REDIRECT_URLS': 'https://geniusnetsoc.gr/**,https://www.geniusnetsoc.gr/**',
            'ENABLE_ANONYMOUS_USERS': 'false', 'ENABLE_EMAIL_AUTOCONFIRM': 'false',
            'ENABLE_PHONE_AUTOCONFIRM': 'false', 'FUNCTIONS_VERIFY_JWT': 'true',
            'GOTRUE_EXTERNAL_GOOGLE_ENABLED': 'false', 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID': '',
            'GOTRUE_EXTERNAL_GOOGLE_SECRET': '', 'GOTRUE_EXTERNAL_AZURE_ENABLED': 'false',
            'GOTRUE_EXTERNAL_AZURE_CLIENT_ID': '', 'GOTRUE_EXTERNAL_AZURE_SECRET': '',
            'GOTRUE_EXTERNAL_AZURE_URL': '', 'OPENAI_API_KEY': '', 'MICROSOFT_SHAREPOINT_API_KEY': '',
        })
        write_env(backend, values)
    frontend_values = read_env(portal / '.env.docker.example')
    frontend_values['VITE_SUPABASE_PUBLISHABLE_KEY'] = values['ANON_KEY']
    write_env(frontend, frontend_values)


if __name__ == '__main__':
    try:
        prepare(Path(sys.argv[1]), Path(sys.argv[2]))
        print('Environment files ready. Edit OAuth credentials and contact email before starting services.')
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)