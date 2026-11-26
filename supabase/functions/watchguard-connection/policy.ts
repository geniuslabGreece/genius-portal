export const regions = ['deu', 'usa', 'jpn'] as const;
export function canManageWatchguard(portalAdmin: boolean, customerAdmin: boolean) {
  return portalAdmin === true || customerAdmin === true;
}
export function watchguardUrls(region: string) {
  if (!regions.some(r => r === region)) throw new Error('Invalid region');
  return { token: `https://api.${region}.cloud.watchguard.com/oauth/token`, base: `https://api.${region}.cloud.watchguard.com/rest/` };
}
