import { describe, it, expect } from 'vitest';
import { canManageWatchguard, watchguardUrls } from '../../supabase/functions/watchguard-connection/policy';
describe('WatchGuard company permissions', () => {
  it('allows portal admins', () => expect(canManageWatchguard(true, false)).toBe(true));
  it('allows the company administrator', () => expect(canManageWatchguard(false, true)).toBe(true));
  it('denies users without administration rights', () => expect(canManageWatchguard(false, false)).toBe(false));
  it('uses the provided EMEA token endpoint', () => expect(watchguardUrls('deu').token).toBe('https://api.deu.cloud.watchguard.com/oauth/token'));
  it('rejects arbitrary hosts', () => expect(() => watchguardUrls('localhost')).toThrow());
});
