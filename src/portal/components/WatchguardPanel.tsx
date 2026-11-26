import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Save, PlugZap, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function WatchguardPanel({ customerId }: { customerId: string }) {
  return <Connection key={customerId} customerId={customerId} />;
}
function Connection({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [region, setRegion] = useState('deu');
  const [mode, setMode] = useState('read_only');
  const [accessId, setAccessId] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [audience, setAudience] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  async function invoke(action: string, extra = {}) {
    const { data, error } = await supabase.functions.invoke('watchguard-connection', { body: { customer_id: customerId, action, ...extra } });
    if (error || data?.error) throw new Error(data?.error || 'Η ενέργεια δεν ολοκληρώθηκε. Ελέγξτε τα δικαιώματα και τη σύνδεσή σας.');
    return data;
  }
  const queryKey = ['watchguard-settings', customerId];
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: async () => {
    const settings = await invoke('load');
    setRegion(settings.region);
    return settings;
  } });
  async function run(action: 'save' | 'test' | 'delete') {
    if (action === 'delete' && !window.confirm('Να διαγραφεί η σύνδεση WatchGuard αυτής της εταιρείας;')) return;
    setBusy(true); setResult('');
    try {
      if (action === 'save' && (!accessId.trim() || !password || !apiKey.trim())) throw new Error('Συμπληρώστε Access ID, κωδικό και API Key.');
      const response = await invoke(action, action === 'save' ? { region, credentials: { access_id: accessId.trim(), password, api_key: apiKey.trim(), audience: audience.trim(), mode } } : {});
      if (action === 'test') setResult(response.message);
      else { setAccessId(''); setPassword(''); setApiKey(''); setAudience(''); toast.success(action === 'save' ? 'Η σύνδεση αποθηκεύτηκε.' : 'Η σύνδεση διαγράφηκε.'); }
      await qc.invalidateQueries({ queryKey });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Αποτυχία σύνδεσης.'); }
    finally { setBusy(false); }
  }
  const prefix = `wg-${customerId}`;
  if (isLoading) return <p className="text-sm text-muted-foreground">Φόρτωση WatchGuard…</p>;
  if (error) return <p className="text-sm text-destructive">Δεν έχετε πρόσβαση στις ρυθμίσεις WatchGuard ή η υπηρεσία δεν είναι διαθέσιμη.</p>;
  return <section className="space-y-4 border-t pt-6">
    <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">WatchGuard Cloud</h2></div>
    <p className="text-sm text-muted-foreground">{data?.configured ? 'Αποθηκευμένη σύνδεση' : 'Χωρίς σύνδεση'}{data?.last_test_at ? ` · ${data.last_test_ok ? 'Επιτυχής' : 'Αποτυχημένος'} έλεγχος ταυτοποίησης: ${new Date(data.last_test_at).toLocaleString('el-GR')}` : ''}</p>
    <form onSubmit={e => { e.preventDefault(); void run('save'); }} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Περιοχή</Label><Select value={region} onValueChange={setRegion}><SelectTrigger aria-label="Περιοχή WatchGuard"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="deu">Ευρώπη / EMEA</SelectItem><SelectItem value="usa">Αμερική</SelectItem><SelectItem value="jpn">Ασία / Ειρηνικός</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Δικαιώματα Access ID</Label><Select value={mode} onValueChange={setMode}><SelectTrigger aria-label="Δικαιώματα WatchGuard"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="read_only">Read-only</SelectItem><SelectItem value="read_write">Read-write</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-id`}>Access ID</Label><Input id={`${prefix}-id`} type="password" autoComplete="off" value={accessId} onChange={e => setAccessId(e.target.value)} maxLength={200} required /></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-password`}>Κωδικός Access ID</Label><Input id={`${prefix}-password`} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={1024} required /></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-key`}>API Key</Label><Input id={`${prefix}-key`} type="password" autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} maxLength={2048} required /></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-audience`}>Audience λογαριασμού (προαιρετικό)</Label><Input id={`${prefix}-audience`} value={audience} onChange={e => setAudience(e.target.value)} maxLength={200} /></div>
      </div>
      <dl className="space-y-1 text-xs text-muted-foreground"><div><dt>Authentication API URL</dt><dd className="break-all">https://api.{region}.cloud.watchguard.com/oauth/token</dd></div><div><dt>API URL (base)</dt><dd className="break-all">https://api.{region}.cloud.watchguard.com/rest/</dd></div></dl>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}><Save className="mr-2 h-4 w-4" />Αποθήκευση</Button><Button type="button" variant="outline" disabled={busy || !data?.configured} onClick={() => void run('test')}><PlugZap className="mr-2 h-4 w-4" />Έλεγχος ταυτοποίησης</Button><Button type="button" variant="ghost" disabled={busy || !data?.configured} onClick={() => void run('delete')}><Unplug className="mr-2 h-4 w-4" />Αποσύνδεση</Button></div>
    </form>
    {result && <p role="status" className="text-sm">{result}</p>}
  </section>;
}
