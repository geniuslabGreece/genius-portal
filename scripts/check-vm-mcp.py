#!/usr/bin/env python3
"""Public, non-mutating VM readiness probes. Never send or print tokens."""
import json
import urllib.request
import urllib.error

API = 'https://api.geniusnetsoc.gr'
ISSUER = API + '/auth/v1'
failed = False

def fetch(url, payload=None):
    data = json.dumps(payload).encode() if payload else None
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=15) as response:
            body = response.read(100_000).decode()
            return response.status, body, response.headers
    except urllib.error.HTTPError as error:
        return error.code, '', error.headers
    except (OSError, TimeoutError):
        return 0, '', {}

def report(ok, name):
    global failed
    print(('OK   ' if ok else 'FAIL ') + name)
    failed |= not ok

if __name__ == '__main__':
    status, _, _ = fetch(ISSUER + '/health')
    report(status == 200, f'VM auth health HTTP {status}')
    status, body, _ = fetch(ISSUER + '/settings')
    try:
        settings = json.loads(body)
    except ValueError:
        settings = {}
    report(status == 200 and settings.get('external', {}).get('google') is True, 'Google enabled')
    report(status == 200 and settings.get('external', {}).get('azure') is True, 'Microsoft enabled')
    report(status == 200 and settings.get('disable_signup') is False, 'Registration enabled')
    status, body, _ = fetch(ISSUER + '/.well-known/oauth-authorization-server')
    try:
        discovery = json.loads(body)
    except ValueError:
        discovery = {}
    report(status == 200 and discovery.get('issuer') == ISSUER, 'VM OAuth discovery issuer')
    report(bool(discovery.get('registration_endpoint')), 'Agent client self-registration advertised')
    status, body, _ = fetch(ISSUER + '/.well-known/jwks.json')
    try:
        keys = json.loads(body).get('keys', [])
    except ValueError:
        keys = []
    report(status == 200 and any(k.get('kty') in ('RSA', 'EC', 'OKP') for k in keys), 'Public asymmetric verification keys (active signing still requires token-header verification)')
    endpoint = API + '/functions/v1/mcp'
    status, _, headers = fetch(endpoint, {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-03-26', 'capabilities': {}, 'clientInfo': {'name': 'readiness-probe', 'version': '1'}}})
    report(status == 401 and 'resource_metadata=' in headers.get('WWW-Authenticate', ''), f'MCP rejects unauthenticated calls with resource metadata HTTP {status}')
    print('Readiness only: no agent registered and no OAuth approval or private data tested.')
    raise SystemExit(1 if failed else 0)