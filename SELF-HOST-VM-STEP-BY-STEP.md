# Εγκατάσταση GeniusNet Portal σε Ubuntu 22.04 / 24.04 με Docker — βήμα βήμα

Κάνε τα βήματα **με τη σειρά**. Μετά από κάθε βήμα υπάρχει **Έλεγχος** — μην προχωράς αν αποτύχει.
Όλες οι εντολές τρέχουν ως `root` (ή με `sudo -i`).

```text
Internet ──443──> nginx (container)
                   ├── geniusnetsoc.gr      -> portal (container)
                   └── api.geniusnetsoc.gr  -> backend :8000 (βάση, login, functions, storage)
```

| Φάκελος στο VM | Τι περιέχει | Αρχείο ρυθμίσεων |
|---|---|---|
| `/opt/stack/supabase` | backend | `/opt/stack/supabase/.env` |
| `/opt/portal` | ο κώδικας του portal + nginx + scripts | `/opt/portal/.env` |
| `/opt/data` | CSV δεδομένων (πελάτες κ.λπ.) | — |

---

## Σύνοψη σειράς

| # | Τι | Script / εντολή |
|---|---|---|
| 0 | DNS, VM | — |
| 1 | Πακέτα + Docker | `apt-get …` |
| 2 | Firewall | `ufw …` |
| 3 | Ανέβασμα αρχείων (backend + portal) | `git clone` ή `scp` |
| 4 | Δημιουργία `.env` | `bash scripts/setup-self-host.sh prepare` |
| 5 | Συμπλήρωση κλειδιών Google/Microsoft/SMTP | `nano` |
| 6 | Έλεγχος ρυθμίσεων | `bash scripts/setup-self-host.sh doctor` |
| 7 | Εκκίνηση backend | `bash scripts/setup-self-host.sh backend` |
| 8 | Migrations (δομή βάσης) | `bash scripts/setup-self-host.sh migrate` |
| 9 | Ανέβασμα & εισαγωγή δεδομένων | `scp` + `psql \copy` |
| 10 | Portal + HTTPS | `bash scripts/setup-self-host.sh https` |
| 11 | Τελικός έλεγχος | `bash scripts/setup-self-host.sh check` |
| 12 | Καθολικός admin | SQL |
| 13 | Backup | cron |

---

## Βήμα 0 — Προαπαιτούμενα

- VM Ubuntu 22.04 ή 24.04, **4 vCPU, 8 GB RAM, 60 GB δίσκο**, δημόσια IP.
- Στο DNS φτιάξε **3 A records** προς την IP του VM:
  `geniusnetsoc.gr`, `www.geniusnetsoc.gr`, `api.geniusnetsoc.gr`.
- Στον firewall του cloud provider άνοιξε **μόνο 22, 80, 443**.

**Έλεγχος:**
```bash
for h in geniusnetsoc.gr www.geniusnetsoc.gr api.geniusnetsoc.gr; do dig +short $h; done
```
→ 3 φορές η IP του VM.

---

## Βήμα 1 — Πακέτα και Docker

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg git jq openssl python3 postgresql-client dnsutils ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

**Έλεγχος:** `docker compose version` → v2.x

---

## Βήμα 2 — Firewall (η πιο συχνή αιτία «502 / δεν παίζει»)

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from 172.16.0.0/12 to any port 8000 proto tcp   # nginx container -> backend
ufw --force enable
```

**Έλεγχος:** `ufw status` → φαίνονται οι 4 κανόνες.

---

## Βήμα 3 — Ανέβασμα αρχείων στο VM (με αυτή τη σειρά)

### 3.1 Backend (επίσημο πακέτο)
```bash
git clone --depth 1 https://github.com/supabase/supabase /tmp/supabase
mkdir -p /opt/stack
cp -r /tmp/supabase/docker /opt/stack/supabase
rm -rf /tmp/supabase
```

### 3.2 Portal (ο κώδικάς σας)

**Τρόπος Α — από GitHub (προτείνεται):** στο Lovable σύνδεσε το project με GitHub, μετά:
```bash
git clone https://github.com/<λογαριασμός>/<repo>.git /opt/portal
```

**Τρόπος Β — από τον υπολογιστή σου με zip:**
```bash
# στον υπολογιστή σου
scp portal.zip root@<IP-VM>:/opt/
# στο VM
apt-get install -y unzip && cd /opt && unzip portal.zip -d portal
```

Τα σημαντικά αρχεία που πρέπει να υπάρχουν μέσα στο `/opt/portal`:

| Αρχείο / φάκελος | Ρόλος |
|---|---|
| `scripts/setup-self-host.sh` | κεντρικό script (prepare / doctor / backend / migrate / https / check) |
| `scripts/prepare-self-host-env.py` | φτιάχνει τα `.env` με ασφαλή κλειδιά |
| `scripts/apply-self-hosted-migrations.sh` | τρέχει τις migrations με τη σωστή σειρά |
| `supabase/migrations/` | migrations βάσης (τρέχουν 1ες) |
| `drizzle/migrations/` | νεότερες migrations (τρέχουν 2ες) |
| `supabase/functions/` | backend functions (AI, tickets, SoftOne, Azure…) |
| `docker/selfhost/portal.override.yml` | προσθέτει Google/Microsoft login στο backend |
| `docker/proxy/` | nginx + certbot |
| `docker-compose.yml`, `docker-compose.proxy.yml`, `Dockerfile` | portal + nginx containers |

**Έλεγχος:**
```bash
ls /opt/stack/supabase/docker-compose.yml /opt/stack/supabase/.env.example /opt/portal/scripts/setup-self-host.sh
```
→ και τα 3 υπάρχουν.

---

## Βήμα 4 — Δημιουργία των `.env` (script 1)

```bash
cd /opt/portal
bash scripts/setup-self-host.sh prepare
```

Φτιάχνει **μία φορά** (ποτέ δεν σβήνει υπάρχοντα):
- `/opt/stack/supabase/.env` με τυχαία κλειδιά (`JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `AZURE_AD_ENC_KEY`)
- `/opt/portal/.env` με το ίδιο `ANON_KEY`
- `/opt/stack/supabase/portal.override.yml`

> Αν γράψει «already exists» είναι σωστό.

---

## Βήμα 5 — Συμπλήρωση κλειδιών

### 5.1 Google (console.cloud.google.com)
1. OAuth consent screen → External → Publish.
2. Credentials → OAuth client ID → **Web application**.
3. Authorized JavaScript origins: `https://geniusnetsoc.gr`
4. Authorized redirect URIs: `https://api.geniusnetsoc.gr/auth/v1/callback`

### 5.2 Microsoft (entra.microsoft.com)
1. App registrations → New registration (multi-tenant αν μπαίνουν πελάτες από άλλες εταιρείες).
2. Redirect URI **Web**: `https://api.geniusnetsoc.gr/auth/v1/callback`
3. Certificates & secrets → New client secret → κράτα το **Value**.
4. API permissions (Delegated): `openid profile email offline_access User.Read` → Grant admin consent.
5. Token configuration → Add optional claim (ID) → `email`.

### 5.3 Γράψε τα στο backend `.env`
`nano /opt/stack/supabase/.env` — άλλαξε **μόνο** αυτές:
```env
SITE_URL=https://geniusnetsoc.gr
API_EXTERNAL_URL=https://api.geniusnetsoc.gr
SUPABASE_PUBLIC_URL=https://api.geniusnetsoc.gr
ADDITIONAL_REDIRECT_URLS=https://geniusnetsoc.gr/**,https://www.geniusnetsoc.gr/**
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false

GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<Client ID>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<Client secret>

GOTRUE_EXTERNAL_AZURE_ENABLED=true
GOTRUE_EXTERNAL_AZURE_CLIENT_ID=<Application (client) ID>
GOTRUE_EXTERNAL_AZURE_SECRET=<Secret VALUE>
GOTRUE_EXTERNAL_AZURE_URL=https://login.microsoftonline.com/common/v2.0
# single tenant: https://login.microsoftonline.com/<tenant-id>/v2.0

SMTP_ADMIN_EMAIL=noreply@geniusnetsoc.gr
SMTP_HOST=<smtp server>
SMTP_PORT=587
SMTP_USER=<user>
SMTP_PASS=<password>
SMTP_SENDER_NAME=GeniusNet Portal
```

### 5.4 Portal `.env`
`nano /opt/portal/.env` — βάλε μόνο το email σου:
```env
LETSENCRYPT_EMAIL=<το email σου>
```
(τα υπόλοιπα τα έβαλε το `prepare`).

> ⚠️ Μετά την πρώτη εκκίνηση **μην αλλάξεις ποτέ** `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `AZURE_AD_ENC_KEY`.

---

## Βήμα 6 — Έλεγχος ρυθμίσεων (script 2)

```bash
cd /opt/portal && bash scripts/setup-self-host.sh doctor
```
Τυπώνει PASS / FAIL χωρίς να δείχνει κλειδιά. Πριν το βήμα 7 είναι φυσιολογικό να βγάζει FAIL μόνο στο «backend :8000» και στο «proxy». Όλα τα άλλα πρέπει να είναι PASS.

---

## Βήμα 7 — Εκκίνηση backend (script 3)

```bash
bash scripts/setup-self-host.sh backend
```
Αντιγράφει τις functions, κατεβάζει images, ξεκινά τα containers και περιμένει τη βάση (5–10 λεπτά την πρώτη φορά).

**Έλεγχος:**
```bash
curl -s http://127.0.0.1:8000/auth/v1/health
docker ps --format '{{.Names}}\t{{.Status}}' | grep supabase
```
→ `{"name":"GoTrue",...}` και όλα `Up` / `healthy`.
Αν κάποιο κάνει restart: `docker logs supabase-auth --tail 50`.

---

## Βήμα 8 — Migrations (script 4)

```bash
bash scripts/setup-self-host.sh migrate
```
Τρέχει πρώτα `supabase/migrations`, μετά `drizzle/migrations`. Όσα πέτυχαν καταγράφονται και δεν ξανατρέχουν.

**Έλεγχος:**
```bash
docker exec supabase-db psql -U postgres -d postgres -Atc "select count(*) from portal_migrations.applied_migrations"
```
→ ίσο με το πλήθος αρχείων `.sql` των δύο φακέλων.

---

## Βήμα 9 — Ανέβασμα και εισαγωγή δεδομένων

1. Από το Lovable: Cloud → Database → κάθε πίνακας → **Export CSV**.
2. Ανέβασέ τα:
```bash
# στον υπολογιστή σου
ssh root@<IP-VM> mkdir -p /opt/data
scp *.csv root@<IP-VM>:/opt/data/
```
3. Εισαγωγή **με αυτή τη σειρά**:
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
- Οι **χρήστες δεν μεταφέρονται**: κάνουν ξανά login με Google/Microsoft.
- Τα Azure credentials πελατών ξαναμπαίνουν από το Admin.

---

## Βήμα 10 — Portal + HTTPS (script 5)

```bash
cd /opt/portal
bash scripts/setup-self-host.sh https
```
Χτίζει το portal → nginx σε HTTP → πιστοποιητικό Let's Encrypt για τα 3 domains → γυρίζει σε HTTPS.
Αν αποτύχει το certbot: DNS (Βήμα 0) ή θύρα 80 κλειστή (Βήμα 2).

---

## Βήμα 11 — Τελικός έλεγχος (script 6)

```bash
bash scripts/setup-self-host.sh check
bash scripts/setup-self-host.sh doctor
```
→ `"google": true, "azure": true` και όλα PASS.

Στον browser: `https://geniusnetsoc.gr/login` → Google → επιστρέφεις στο portal. Αποσύνδεση → Microsoft → το ίδιο.

---

## Βήμα 12 — john.zontos@gmail.com καθολικός admin

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

---

## Βήμα 13 — Backup κάθε βράδυ

```bash
mkdir -p /opt/backups
( crontab -l 2>/dev/null; echo '0 3 * * * docker exec supabase-db pg_dump -U postgres postgres | gzip > /opt/backups/db-$(date +\%F).sql.gz' ) | crontab -
```

---

## Ενημέρωση αργότερα (νέα έκδοση κώδικα)

```bash
cd /opt/portal && git pull
bash scripts/setup-self-host.sh backend
bash scripts/setup-self-host.sh migrate
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build
```

---

## Όταν κάτι δεν παίζει

Τρέξε `bash scripts/setup-self-host.sh doctor` και στείλε τις γραμμές **FAIL** (χωρίς κλειδιά).

| Σύμπτωμα | Λύση |
|---|---|
| `api.geniusnetsoc.gr` → 502 | Βήμα 2 (UFW) και `curl 127.0.0.1:8000/auth/v1/health` |
| Καμία απάντηση από το site | VM κλειστό ή θύρες 80/443 κλειστές στον provider |
| «Unsupported provider» | `*_ENABLED=true` + client id (Βήμα 5.3), μετά `setup-self-host.sh backend` |
| Google `redirect_uri_mismatch` / Microsoft `AADSTS50011` | redirect ακριβώς `https://api.geniusnetsoc.gr/auth/v1/callback` |
| Microsoft «Error getting user email» | claim `email` (Βήμα 5.2.5) |
| Μετά το login πας σε `localhost:3000` | λάθος `SITE_URL` |
| «Invalid API key» | το κλειδί του portal ≠ `ANON_KEY` → `doctor` |
| Certbot αποτυγχάνει | DNS / θύρα 80 |

**Γνωστοί περιορισμοί στο VM:** το SharePoint δεν δουλεύει ακόμα εκτός Lovable· το MCP (agents) θέλει τα επιπλέον βήματα του `SELF-HOST-MCP.md`.
