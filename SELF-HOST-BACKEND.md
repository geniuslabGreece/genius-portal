# Self-host στο VM — οδηγίες βήμα βήμα

Στόχος: όλο το σύστημα σε ένα Linux VM με Docker.

```text
Internet ──443──> nginx proxy (container)
                   ├── geniusnetsoc.gr      -> portal (container, React)
                   └── api.geniusnetsoc.gr  -> Kong :8000 (backend stack: DB, Auth, REST, Functions, Storage)
```

| Φάκελος | Τι περιέχει | Αρχείο ρυθμίσεων |
|---|---|---|
| `/opt/stack/supabase` | backend (βάση, login, functions) | `/opt/stack/supabase/.env` |
| `/opt/portal` | αυτό το repo (portal + nginx + certbot) | `/opt/portal/.env` |

Κάνε τα βήματα **με τη σειρά**. Μετά από κάθε βήμα υπάρχει έλεγχος — μην προχωράς αν αποτύχει.
Όλες οι εντολές τρέχουν ως `root` (ή με `sudo`). Μην στέλνεις πουθενά τα περιεχόμενα των `.env`.

---

## Βήμα 0 — Προαπαιτούμενα

- Ubuntu 22.04/24.04 ή Debian 12, **4 vCPU, 8 GB RAM, 60 GB δίσκο**.
- Δημόσια IP. Στο DNS του domain φτιάξε **3 A records** προς αυτή την IP:
  `geniusnetsoc.gr`, `www.geniusnetsoc.gr`, `api.geniusnetsoc.gr`.

Έλεγχος (από τον υπολογιστή σου):
```bash
for h in geniusnetsoc.gr www.geniusnetsoc.gr api.geniusnetsoc.gr; do dig +short $h; done
```
Πρέπει να βγάλει 3 φορές την IP του VM.

---

## Βήμα 1 — Πακέτα

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg git jq openssl python3 postgresql-client dnsutils ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo $ID)/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$(. /etc/os-release; echo $ID) $(. /etc/os-release; echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

Έλεγχος: `docker compose version` → v2.x.

---

## Βήμα 2 — Firewall (συχνή αιτία που «δεν παίζει»)

Ο nginx proxy (container) μιλά με το backend στη θύρα **8000 του host**. Με το UFW ενεργό,
αυτή η κίνηση κόβεται και το `api.geniusnetsoc.gr` βγάζει **502 Bad Gateway**.

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from 172.16.0.0/12 to any port 8000 proto tcp   # containers -> backend
ufw --force enable
```

Σημείωση: το Docker ανοίγει τις θύρες του (8000, 5432 κ.λπ.) **παρακάμπτοντας το UFW**.
Στον firewall του cloud provider άφησε ανοιχτές **μόνο 22, 80, 443**.

---

## Βήμα 3 — Κατέβασμα κώδικα

```bash
# Backend stack (επίσημο)
git clone --depth 1 https://github.com/supabase/supabase /tmp/supabase
mkdir -p /opt/stack
cp -r /tmp/supabase/docker /opt/stack/supabase
rm -rf /tmp/supabase

# Portal (αυτό το repo — βάλε το δικό σου URL)
git clone <URL-του-repo> /opt/portal
```

Έλεγχος: υπάρχουν τα `/opt/stack/supabase/docker-compose.yml`, `/opt/stack/supabase/.env.example`
και `/opt/portal/scripts/setup-self-host.sh`.

---

## Βήμα 4 — Δημιουργία των δύο `.env`

```bash
cd /opt/portal
bash scripts/setup-self-host.sh prepare
```

Φτιάχνει **μία φορά** (δεν πειράζει ποτέ υπάρχοντα αρχεία):
- `/opt/stack/supabase/.env` με τυχαία κλειδιά, `ANON_KEY` / `SERVICE_ROLE_KEY` υπογεγραμμένα
  με το ίδιο `JWT_SECRET`, και `AZURE_AD_ENC_KEY`.
- `/opt/portal/.env` με το ίδιο `ANON_KEY`.
- `/opt/stack/supabase/portal.override.yml` (Google/Azure login + κλειδιά functions).

> Αν ξανατρέξεις το `prepare` και λέει «already exists», είναι σωστό — δεν σβήνει τίποτα.
> Για καθαρή αρχή: `mv /opt/portal/.env /opt/portal/.env.bak` (το backend `.env` κράτησέ το).

### 4.1 Συμπλήρωσε το `/opt/stack/supabase/.env`

`nano /opt/stack/supabase/.env` — άλλαξε/έλεγξε **μόνο** αυτές τις γραμμές:

```env
SITE_URL=https://geniusnetsoc.gr
API_EXTERNAL_URL=https://api.geniusnetsoc.gr
SUPABASE_PUBLIC_URL=https://api.geniusnetsoc.gr
ADDITIONAL_REDIRECT_URLS=https://geniusnetsoc.gr/**,https://www.geniusnetsoc.gr/**

ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false

# Google (Βήμα 5.1)
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<Client ID>.apps.googleusercontent.com
GOTRUE_EXTERNAL_GOOGLE_SECRET=<Client secret>

# Microsoft / Azure (Βήμα 5.2)
GOTRUE_EXTERNAL_AZURE_ENABLED=true
GOTRUE_EXTERNAL_AZURE_CLIENT_ID=<Application (client) ID>
GOTRUE_EXTERNAL_AZURE_SECRET=<Client secret VALUE — όχι το Secret ID>
GOTRUE_EXTERNAL_AZURE_URL=https://login.microsoftonline.com/<Directory (tenant) ID>/v2.0

# AI (προαιρετικό — μπορεί να μπει και από Admin → Ρυθμίσεις AI)
OPENAI_API_KEY=

# Email (για επιβεβαίωση email / reset κωδικού)
SMTP_ADMIN_EMAIL=noreply@geniusnetsoc.gr
SMTP_HOST=<smtp server>
SMTP_PORT=587
SMTP_USER=<user>
SMTP_PASS=<password>
SMTP_SENDER_NAME=GeniusNet Portal
```

Μην αλλάξεις `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `AZURE_AD_ENC_KEY`
μετά την πρώτη εκκίνηση — χαλάνε τα logins και τα αποθηκευμένα Azure credentials.
Τα `*_REDIRECT_URI` τα βάζει αυτόματα το `portal.override.yml` = `https://api.geniusnetsoc.gr/auth/v1/callback`.

### 4.2 Έλεγξε το `/opt/portal/.env`

```env
VITE_SUPABASE_URL=https://api.geniusnetsoc.gr
VITE_SUPABASE_PUBLISHABLE_KEY=<ίδιο με ANON_KEY του backend — το έβαλε το prepare>
VITE_SUPABASE_PROJECT_ID=selfhosted
PORT=127.0.0.1:8080
DOMAIN=geniusnetsoc.gr
API_DOMAIN=api.geniusnetsoc.gr
SUPABASE_API_UPSTREAM=host.docker.internal:8000
LETSENCRYPT_EMAIL=<πραγματικό email σου>
```

Έλεγχος ότι τα δύο κλειδιά ταιριάζουν (δεν τυπώνει κλειδιά):
```bash
cd /opt/portal && bash scripts/setup-self-host.sh doctor
```

---

## Βήμα 5 — Google & Microsoft (μία φορά, στις κονσόλες τους)

Και οι δύο επιστρέφουν **στο backend**, όχι στο portal:
**`https://api.geniusnetsoc.gr/auth/v1/callback`**

### 5.1 Google — console.cloud.google.com
1. APIs & Services → OAuth consent screen → External → συμπλήρωσε όνομα/email → Publish.
2. Credentials → Create credentials → OAuth client ID → **Web application**.
3. Authorized JavaScript origins: `https://geniusnetsoc.gr`
4. Authorized redirect URIs: `https://api.geniusnetsoc.gr/auth/v1/callback`
5. Αντέγραψε Client ID / Secret στο Βήμα 4.1.

### 5.2 Microsoft — entra.microsoft.com
1. App registrations → New registration.
   Supported account types: *Accounts in any organizational directory* (multi-tenant) αν μπαίνουν
   πελάτες από άλλα tenants, αλλιώς single tenant.
2. Redirect URI: **Web** → `https://api.geniusnetsoc.gr/auth/v1/callback`
3. Certificates & secrets → New client secret → αντέγραψε το **Value**.
4. API permissions → Microsoft Graph (Delegated): `openid`, `profile`, `email`, `offline_access`, `User.Read` → Grant admin consent.
5. Token configuration → Add optional claim (ID) → `email`.
6. `GOTRUE_EXTERNAL_AZURE_URL`: single tenant → `https://login.microsoftonline.com/<tenant-id>/v2.0`,
   multi-tenant → `https://login.microsoftonline.com/common/v2.0`.

(Ο συγχρονισμός χρηστών/Copilot είναι ξεχωριστό app με Application permissions —
ρυθμίζεται από Admin → Tenant / Azure AD μέσα στο portal.)

---

## Βήμα 6 — Εκκίνηση backend

```bash
cd /opt/portal
bash scripts/setup-self-host.sh backend
```

Αντιγράφει τις functions, κατεβάζει images και περιμένει τη βάση.

Έλεγχος:
```bash
curl -s http://127.0.0.1:8000/auth/v1/health        # {"name":"GoTrue",...}
docker ps --format '{{.Names}}\t{{.Status}}' | grep supabase   # όλα "healthy"/"Up"
```
Αν κάποιο κάνει restart: `docker logs supabase-auth --tail 50` (ή `supabase-db`, `supabase-kong`).

---

## Βήμα 7 — Migrations (δομή βάσης)

```bash
bash scripts/setup-self-host.sh migrate
```
Τρέχει πρώτα τις 31 του `supabase/migrations`, μετά του `drizzle/migrations`. Κάθε αρχείο
καταγράφεται και δεν ξανατρέχει. Αν αποτύχει, σταματά στο συγκεκριμένο αρχείο — στείλε μου
το μήνυμα σφάλματος (χωρίς κωδικούς).

Έλεγχος:
```bash
docker exec supabase-db psql -U postgres -d postgres -Atc "select count(*) from portal_migrations.applied_migrations"
```
→ 33.

---

## Βήμα 8 — Δεδομένα (πελάτες κ.λπ.)

Από το Lovable: Cloud → Database → πίνακας → **Export CSV**. Ανέβασε τα στο `/opt/data`.
Εισαγωγή με τη σειρά (πρώτα `customers`, μετά ό,τι τους αναφέρει):

```bash
cd /opt/data
for t in customers customer_email_domains products contracts ai_assistant_settings softone_settings; do
  [ -f "$t.csv" ] || continue
  cols=$(head -1 "$t.csv")
  docker cp "$t.csv" supabase-db:/tmp/$t.csv
  docker exec supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "\copy public.$t ($cols) FROM '/tmp/$t.csv' WITH CSV HEADER"
done
```

Οι χρήστες **δεν** μεταφέρονται: ο καθένας κάνει ξανά login με Google/Microsoft και παίρνει
αυτόματα ρόλο βάσει email domain. Τα Azure credentials πελατών ξαναμπαίνουν από το Admin
(κρυπτογραφούνται με το νέο `AZURE_AD_ENC_KEY`).

---

## Βήμα 9 — Portal + HTTPS

```bash
cd /opt/portal
bash scripts/setup-self-host.sh https
```
1. χτίζει το portal, 2. σηκώνει τον nginx σε HTTP, 3. βγάζει πιστοποιητικό για
`geniusnetsoc.gr`, `www.geniusnetsoc.gr`, `api.geniusnetsoc.gr`, 4. γυρίζει σε HTTPS.

Αν το certbot αποτύχει: σχεδόν πάντα DNS (Βήμα 0) ή κλειστή θύρα 80.

> Κάθε φορά που αλλάζεις το `/opt/portal/.env` ξαναχτίζεις:
> `docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build`

---

## Βήμα 10 — Τελικός έλεγχος

```bash
bash scripts/setup-self-host.sh check
```
Πρέπει να δείξει `"google": true, "azure": true`.

Μετά στον browser:
1. `https://geniusnetsoc.gr/login` → **Σύνδεση με Google** → επιστρέφεις στο portal.
2. Αποσύνδεση → **Σύνδεση με Microsoft** → το ίδιο.

---

## Βήμα 11 — john.zontos@gmail.com καθολικός admin

Αφού κάνει **μία φορά login**:

```bash
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into public.user_roles (user_id, role)
select id, r::public.app_role from auth.users, unnest(array['admin','customer_admin']) r
where lower(email)='john.zontos@gmail.com'
on conflict (user_id, role) do nothing;
update public.profiles set customer_id = null where lower(email)='john.zontos@gmail.com';
SQL
```
Αποσύνδεση/σύνδεση → βλέπει όλο το Admin και όλες τις εταιρείες.

---

## Βήμα 12 — Backup κάθε βράδυ

```bash
mkdir -p /opt/backups
( crontab -l 2>/dev/null; echo '0 3 * * * docker exec supabase-db pg_dump -U postgres postgres | gzip > /opt/backups/db-$(date +\%F).sql.gz' ) | crontab -
```

---

## Ενημέρωση κώδικα αργότερα

```bash
cd /opt/portal && git pull
bash scripts/setup-self-host.sh backend     # νέες functions
bash scripts/setup-self-host.sh migrate     # νέες migrations
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build
```

---

## Όταν κάτι δεν παίζει

Τρέξε πρώτα `bash scripts/setup-self-host.sh doctor` και στείλε μου την έξοδο.

| Σύμπτωμα | Αιτία | Λύση |
|---|---|---|
| `api.geniusnetsoc.gr` → 502 | UFW κόβει container → :8000, ή backend κάτω | Βήμα 2, `curl 127.0.0.1:8000/auth/v1/health` |
| Login → «Unsupported provider» | `*_ENABLED=false` ή λείπει client id | Βήμα 4.1, μετά `bash scripts/setup-self-host.sh backend` |
| Google: `redirect_uri_mismatch` | λάθος redirect στο Google | ακριβώς `https://api.geniusnetsoc.gr/auth/v1/callback` |
| Microsoft: `AADSTS50011` | ίδιο, στο Entra | Βήμα 5.2 βήμα 2 |
| Microsoft: «Error getting user email» | λείπει το claim `email` | Βήμα 5.2 βήμα 5 |
| Μετά το login γυρνάς σε `localhost:3000` | `SITE_URL` λάθος | Βήμα 4.1 + restart backend |
| Σελίδα φορτώνει αλλά «Invalid API key» | `VITE_SUPABASE_PUBLISHABLE_KEY` ≠ `ANON_KEY` | Βήμα 4.2 + rebuild portal |
| AI bot σφάλμα | κανένα key | Admin → Ρυθμίσεις AI ή `OPENAI_API_KEY` |
| Certbot αποτυγχάνει | DNS / θύρα 80 | Βήμα 0 και 2 |

### Γνωστοί περιορισμοί εκτός Cloud
- **SharePoint** (δελτία, εισαγωγή πελατών) χρησιμοποιεί ακόμα τον connector του Lovable — δεν
  δουλεύει στο VM χωρίς ξεχωριστή αλλαγή σε άμεσες κλήσεις Microsoft Graph.
- **MCP** (σύνδεση agents): βήμα-βήμα στο [SELF-HOST-MCP.md](SELF-HOST-MCP.md), με ξεχωριστό VM issuer, staged bundle και `mcp-check`. Απαιτεί συμβατή έκδοση Auth, ενεργό asymmetric signing και route-specific εξαίρεση στο functions router· δεν ενεργοποιείται αυτόματα.
- AI, Azure AD/Copilot sync, SoftOne, tickets, ειδοποιήσεις: δουλεύουν με δικά σου κλειδιά.
