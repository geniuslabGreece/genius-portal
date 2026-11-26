import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { canManageWatchguard, watchguardUrls } from './policy.ts';

const schema = z.object({
  customer_id: z.string().uuid(), action: z.enum(['load', 'save', 'test', 'delete']),
  region: z.enum(['deu', 'usa', 'jpn']).optional(),
  credentials: z.object({
    access_id: z.string().trim().regex(/^[A-Za-z0-9_-]{1,200}$/),
    password: z.string().min(1).max(1024), api_key: z.string().trim().min(1).max(2048),
    audience: z.string().trim().regex(/^[A-Za-z0-9_-]{0,200}$/).default(''),
    mode: z.enum(['read_only', 'read_write']),
  }).strict().optional(),
}).strict();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
async function key() {
  const raw = Deno.env.get('AZURE_AD_ENC_KEY');
  if (!raw) throw new Error('Encryption unavailable');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0)); } catch { bytes = new TextEncoder().encode(raw); }
  const material = await crypto.subtle.digest('SHA-256', bytes);
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(JSON.stringify(value))));
  return btoa(String.fromCharCode(...iv, ...cipher));
}
async function decrypt(value: string) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await key(), bytes.slice(12));
  return JSON.parse(new TextDecoder().decode(plain));
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !publicKey || !service) return reply({ error: 'Η υπηρεσία δεν έχει ρυθμιστεί.' }, 503);
    const auth = req.headers.get('Authorization') || '';
    const caller = createClient(url, publicKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return reply({ error: 'Απαιτείται σύνδεση.' }, 401);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply({ error: 'Μη έγκυρα πεδία σύνδεσης.' }, 400);
    const body = parsed.data;
    const db = createClient(url, service);
    const [global, company] = await Promise.all([
      db.rpc('is_admin', { _user_id: user.id }),
      db.rpc('is_customer_admin_for', { _user_id: user.id, _customer_id: body.customer_id }),
    ]);
    if (global.error || company.error || !canManageWatchguard(global.data, company.data)) return reply({ error: 'Δεν έχετε δικαίωμα διαχείρισης αυτής της εταιρείας.' }, 403);
    if (body.action === 'delete') {
      const { error } = await db.from('customer_watchguard_settings').delete().eq('customer_id', body.customer_id);
      if (error) throw error;
      return reply({ ok: true });
    }
    if (body.action === 'save') {
      if (!body.credentials || !body.region) return reply({ error: 'Συμπληρώστε όλα τα στοιχεία σύνδεσης.' }, 400);
      const { error } = await db.from('customer_watchguard_settings').upsert({ customer_id: body.customer_id, region: body.region, credentials_enc: await encrypt(body.credentials), last_test_at: null, last_test_ok: null, updated_at: new Date().toISOString() });
      if (error) throw error;
      return reply({ ok: true });
    }
    const { data: settings, error } = await db.from('customer_watchguard_settings').select('*').eq('customer_id', body.customer_id).maybeSingle();
    if (error) throw error;
    if (body.action === 'load') return reply({ configured: Boolean(settings), region: settings?.region ?? 'deu', last_test_at: settings?.last_test_at, last_test_ok: settings?.last_test_ok });
    if (!settings) return reply({ error: 'Αποθηκεύστε πρώτα τη σύνδεση.' }, 400);
    const c = await decrypt(settings.credentials_enc);
    const urls = watchguardUrls(settings.region);
    const form = new URLSearchParams({ grant_type: 'client_credentials', scope: 'api-access' });
    if (c.audience) form.set('audience', c.audience);
    const result = await fetch(urls.token, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${c.access_id}:${c.password}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(15000) });
    const token = await result.json().catch(() => ({}));
    const ok = result.ok && typeof token.access_token === 'string';
    const { error: updateError } = await db.from('customer_watchguard_settings').update({ last_test_at: new Date().toISOString(), last_test_ok: ok }).eq('customer_id', body.customer_id);
    if (updateError) throw updateError;
    return reply({ ok, message: ok ? 'Επιτυχής έλεγχος Access ID και κωδικού. Το API Key δεν ελέγχθηκε σε endpoint προϊόντος.' : `Αποτυχία ταυτοποίησης WatchGuard (HTTP ${result.status}). Ελέγξτε Access ID, κωδικό και περιοχή.` });
  } catch {
    return reply({ error: 'Ο έλεγχος δεν ολοκληρώθηκε. Ελέγξτε τη σύνδεση και τη ρύθμιση κρυπτογράφησης.' }, 500);
  }
});
