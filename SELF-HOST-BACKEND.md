# Πλήρες self-hosting (frontend + backend) σε Linux VM — από το μηδέν

Όλα τρέχουν στο VM σου: PostgreSQL, Auth (GoTrue), REST, Realtime, Storage, Edge Functions
και το portal. Το Lovable Cloud χρησιμοποιείται μόνο για το αρχικό export δεδομένων.

> **Απαιτήσεις VM:** Ubuntu 22.04/24.04, **4 vCPU / 8 GB RAM / 60 GB disk**,
> public IP, domain `geniusnetsoc.gr` + subdomain `api.geniusnetsoc.gr`.

```text
                 ┌───────────────────────────────┐
  geniusnetsoc.gr│ nginx proxy (80/443, certbot) │
             ───▶└──────┬────────────────┬───────┘
                        │                │
             ┌──────────▼──────┐   ┌─────▼─────────────────────────┐
             │ portal (React)  │   │ Supabase stack (Kong :8000)   │
             │ Docker + nginx  │   │ db · auth · rest · realtime   │
             └─────────────────┘   │ storage · functions · studio  │
  api.…gr ─────────────────────────▶ meta · imgproxy · analytics   │
                                   └───────────────────────────────┘
```

---

## ΒΗΜΑ 0 — Τι εγκαθιστούμε στο VM

| Πακέτο | Γιατί |
|---|---|
| `docker-ce` + `docker compose plugin` | τρέχει και το Supabase stack και το portal |
| `git` | κατέβασμα του repo |
| `curl`, `ca-certificates` | downloads / health checks |
| `openssl` | παραγωγή passwords & JWT secret |
| `jq` | επεξεργασία JSON (keys, API tests) |
| `postgresql-client` | `psql`/`pg_dump` από το host (προαιρετικό, τα migrations τρέχουν μέσα στο container) |
| `python3` | παραγωγή ANON/SERVICE_ROLE JWT (script πιο κάτω) |
| `ufw` | firewall |

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker --version && docker compose version

# Υπόλοιπα
sudo apt update
sudo apt install -y git curl ca-certificates openssl jq postgresql-client python3 python3-pip ufw

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable
```

**DNS (πριν το certbot):** A records → public IP του VM για `@`, `www`, `api`.

```bash
dig +short geniusnetsoc.gr www.geniusnetsoc.gr api.geniusnetsoc.gr
```

---

## ΒΗΜΑ 1 — Κατέβασμα των δύο repos

```bash
sudo mkdir -p /opt/portal /opt/stack && sudo chown -R $USER:$USER /opt/portal /opt/stack

# 1α. Το portal (GitHub → Connect to GitHub από το Lovable)
git clone https://github.com/<org>/<repo>.git /opt/portal

# 1β. Το επίσημο Supabase docker stack
cd /opt/stack
git clone --depth 1 https://github.com/supabase/supabase.git supabase-src
cp -r supabase-src/docker supabase
cd supabase && cp .env.example .env
```

---

## ΒΗΜΑ 2 — Παραγωγή κλειδιών

```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 24)
export JWT_SECRET=$(openssl rand -hex 32)          # >= 32 χαρακτήρες
export DASHBOARD_PASSWORD=$(openssl rand -base64 18)
export AZURE_AD_ENC_KEY=$(openssl rand -base64 32) # AES-GCM key για τα Azure secrets
export SECRET_KEY_BASE=$(openssl rand -hex 32)
export VAULT_ENC_KEY=$(openssl rand -hex 16)       # ακριβώς 32 χαρακτήρες
```

### ANON_KEY & SERVICE_ROLE_KEY (υπογεγραμμένα με το ίδιο JWT_SECRET)

```bash
pip3 install --quiet pyjwt
python3 - <<'PY' | tee /opt/stack/keys.txt
import os, time, jwt
s = os.environ["JWT_SECRET"]; iat = int(time.time()); exp = iat + 10*365*24*3600
for role in ("anon", "service_role"):
    print(role.upper()+"_KEY=" + jwt.encode({"role":role,"iss":"supabase","iat":iat,"exp":exp}, s, algorithm="HS256"))
PY
chmod 600 /opt/stack/keys.txt
```

> Κράτα το `JWT_SECRET` — αν αλλάξει, όλα τα keys ακυρώνονται (`Invalid API key`).

---

## ΒΗΜΑ 3 — `/opt/stack/supabase/.env` (backend)

Άνοιξε το αρχείο και βάλε **αυτές** τις τιμές (τα υπόλοιπα του `.env.example` μένουν ως έχουν):

```env
############ Database ############
POSTGRES_PASSWORD=<POSTGRES_PASSWORD>
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############ API keys ############
JWT_SECRET=<JWT_SECRET>
ANON_KEY=<ANON_KEY>
SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
SECRET_KEY_BASE=<SECRET_KEY_BASE>
VAULT_ENC_KEY=<VAULT_ENC_KEY>

############ Studio (μην το εκθέσεις δημόσια) ############
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<DASHBOARD_PASSWORD>
STUDIO_DEFAULT_ORGANIZATION=GeniusNet
STUDIO_DEFAULT_PROJECT=GeniusNet Portal

############ URLs — ΚΡΙΣΙΜΑ για το login ############
SITE_URL=https://geniusnetsoc.gr
API_EXTERNAL_URL=https://api.geniusnetsoc.gr
SUPABASE_PUBLIC_URL=https://api.geniusnetsoc.gr
ADDITIONAL_REDIRECT_URLS=https://geniusnetsoc.gr/**,https://www.geniusnetsoc.gr/**

############ Auth ############
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
JWT_EXPIRY=3600
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

############ Google OAuth ############
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<google client id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<google client secret>
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.geniusnetsoc.gr/auth/v1/callback

############ Azure / Entra ID OAuth ############
GOTRUE_EXTERNAL_AZURE_ENABLED=true
GOTRUE_EXTERNAL_AZURE_CLIENT_ID=<application (client) id>
GOTRUE_EXTERNAL_AZURE_SECRET=<client secret value>
GOTRUE_EXTERNAL_AZURE_URL=https://login.microsoftonline.com/<tenant-id>/v2.0
GOTRUE_EXTERNAL_AZURE_REDIRECT_URI=https://api.geniusnetsoc.gr/auth/v1/callback

############ SMTP (auth emails) ############
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=noreply@geniusnetsoc.gr
SMTP_PASS=<app password>
SMTP_ADMIN_EMAIL=admin@geniusnetsoc.gr
SMTP_SENDER_NAME=GeniusNet Portal

############ Secrets των edge functions ############
MICROSOFT_SHAREPOINT_API_KEY=<sharepoint key>
AZURE_AD_ENC_KEY=<AZURE_AD_ENC_KEY>
OPENAI_API_KEY=<sk-...>            # ή GEMINI key, δες ΒΗΜΑ 8
FUNCTIONS_VERIFY_JWT=true

############ Kong / ports ############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
```

Στο `docker-compose.yml` του stack, στο service `functions`, πέρασε τα secrets:

```yaml
  functions:
    environment:
      MICROSOFT_SHAREPOINT_API_KEY: ${MICROSOFT_SHAREPOINT_API_KEY}
      AZURE_AD_ENC_KEY: ${AZURE_AD_ENC_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
```

Εκκίνηση:

```bash
cd /opt/stack/supabase
docker compose pull
docker compose up -d
docker compose ps                      # όλα healthy
curl -s http://localhost:8000/auth/v1/health
```

---

## ΒΗΜΑ 4 — Schema (migrations)

```bash
cd /opt/portal
chmod +x scripts/apply-self-hosted-migrations.sh
./scripts/apply-self-hosted-migrations.sh          # DB_CONTAINER=<name> αν διαφέρει
```

Τρέχει **μέσα** στο `supabase-db` container (παρακάμπτει τον Supavisor), κρατά ιστορικό στο
`portal_migrations.applied_migrations`, `--single-transaction`, σταματά στο πρώτο error.

Έλεγχος:

```bash
docker exec supabase-db psql -X -U postgres -d postgres -c "\dt public.*"
docker exec supabase-db psql -X -U postgres -d postgres \
  -c "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where nspname='public';"
```

Πρέπει να υπάρχουν `profiles`, `customers`, `contracts`, `tickets`, `products`, `user_roles`,
`customer_azure_ad_*`, `softone_settings`, `mail_server_settings`, `ai_assistant_settings`
και οι functions `has_role`, `is_admin`, `is_customer_admin_for`, `handle_new_user`,
`match_customer_for_domain`.

> Το μήνυμα `(ENOIDENTIFIER) no tenant identifier provided` σημαίνει ότι έτρεξες SQL προς τον
> pooler (`127.0.0.1:5432`) αντί για το container. Χρησιμοποίησε το script.

---

## ΒΗΜΑ 5 — Δεδομένα

Lovable → **Cloud → Advanced settings → Export data** → CSV → ανέβασέ τα στο `/opt/data`.

```bash
cd /opt/data
for t in customers customer_email_domains products contracts \
         customer_azure_ad_settings customer_azure_ad_groups customer_azure_ad_role_mappings \
         softone_settings mail_server_settings ai_assistant_settings; do
  [ -f "$t.csv" ] || continue
  docker cp "$t.csv" "supabase-db:/tmp/$t.csv"
  docker exec supabase-db psql -X -U postgres -d postgres \
    -c "\copy public.$t FROM '/tmp/$t.csv' WITH CSV HEADER"
  docker exec supabase-db rm -f "/tmp/$t.csv"
done
```

**Χρήστες:** δεν μεταφέρονται με CSV (δεν έχεις τα password hashes). Συνιστάται να ξανακάνουν
login με Google/Azure — το trigger `handle_new_user` φτιάχνει profile και δίνει
`customer_admin` βάσει email domain (και `admin` για `@geniusnet.gr`).

**Storage bucket:**

```sql
insert into storage.buckets (id, name, public) values ('mygn','mygn',false)
on conflict (id) do nothing;
```

---

## ΒΗΜΑ 6 — Edge functions

```bash
cp -r /opt/portal/supabase/functions/* /opt/stack/supabase/volumes/functions/
cd /opt/stack/supabase && docker compose restart functions
curl -i "http://localhost:8000/functions/v1/softone-sync"   # 401 = ΟΚ (όχι 404)
```

Functions: `ai-assistant`, `azure-ad-sync`, `mcp`, `notify-ticket`,
`sharepoint-import-customers`, `sharepoint-sync-worklogs`, `sharepoint-worklogs`,
`softone-sync`, `support-chat`.

---

## ΒΗΜΑ 7 — `/opt/portal/.env` (frontend + proxy)

```env
# ── Frontend → self-hosted backend ──────────────────────────────
VITE_SUPABASE_URL="https://api.geniusnetsoc.gr"
VITE_SUPABASE_PUBLISHABLE_KEY="<ANON_KEY από το ΒΗΜΑ 2>"
VITE_SUPABASE_PROJECT_ID="selfhosted"

# ── Reverse proxy ───────────────────────────────────────────────
PORT=127.0.0.1:8080                 # το app δεν εκτίθεται δημόσια
DOMAIN=geniusnetsoc.gr
API_DOMAIN=api.geniusnetsoc.gr
SUPABASE_API_UPSTREAM=host.docker.internal:8000
LETSENCRYPT_EMAIL=admin@geniusnetsoc.gr
```

Πρώτο σήκωμα (εκδίδει certificates για apex + www + api):

```bash
cd /opt/portal
cp .env.docker.example .env && nano .env
chmod +x docker/proxy/init-certbot.sh
./docker/proxy/init-certbot.sh
```

Επόμενα deploys:

```bash
cd /opt/portal && git pull
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build
```

> Τα `VITE_*` ψήνονται στο build → κάθε αλλαγή θέλει `--build`.
> Αν το Supabase stack είναι σε δικό του docker network αντί για host ports, βάλε
> `SUPABASE_API_UPSTREAM=kong:8000` και σύνδεσε τον proxy σε εκείνο το network.

---

## ΒΗΜΑ 8 — Google & Azure Auth (πλήρης ρύθμιση)

Το callback URL είναι πάντα:

```text
https://api.geniusnetsoc.gr/auth/v1/callback
```

### 8.1 Google

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client → Web**.
2. Authorized JavaScript origins: `https://geniusnetsoc.gr`
3. Authorized redirect URIs: `https://api.geniusnetsoc.gr/auth/v1/callback`
4. OAuth consent screen → Authorized domains: `geniusnetsoc.gr`; scopes `openid`,
   `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
5. Client id/secret → `GOTRUE_EXTERNAL_GOOGLE_*` στο `/opt/stack/supabase/.env`.

### 8.2 Azure / Entra ID

1. Entra portal → **App registrations → New registration** (Accounts in this organizational directory).
2. **Authentication → Redirect URI (Web)**: `https://api.geniusnetsoc.gr/auth/v1/callback`
3. **Certificates & secrets** → New client secret → κράτα το **Value**.
4. **API permissions (Application)**: `User.Read.All`, `Group.Read.All`, `Device.Read.All`,
   `Reports.Read.All`, `Organization.Read.All` → **Grant admin consent**.
5. Tenant id / client id / secret → `GOTRUE_EXTERNAL_AZURE_*` και στο Admin → **Tenant / Azure AD**
   tab του portal (για user/device/license sync· το secret κρυπτογραφείται με `AZURE_AD_ENC_KEY`).

```bash
cd /opt/stack/supabase && docker compose up -d auth
curl -s https://api.geniusnetsoc.gr/auth/v1/settings | jq '.external'
```

Πρέπει να δείχνει `"google": true, "azure": true`.

### 8.3 Σημείωση για τον κώδικα

Ο Lovable managed OAuth broker (`lovable.auth.signInWithOAuth`) **δεν δουλεύει self-hosted**.
Το `src/portal/pages/Login.tsx` έχει fallback σε:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",            // ή "azure"
  options: { redirectTo: `${window.location.origin}/portal` },
});
```

Αν κολλήσει το login στο preview-style popup, άφησε μόνο αυτή τη διαδρομή.

### 8.4 AI provider

Το `LOVABLE_API_KEY` δεν λειτουργεί εκτός Lovable. Στο **Admin → AI Bot** διάλεξε provider
(OpenAI ή Google Gemini), βάλε δικό σου API key και base URL. Συνδρομές Gemini Advanced /
Microsoft 365 Copilot **δεν** είναι API keys.

---

## ΒΗΜΑ 9 — Ο λογαριασμός `john.zontos@gmail.com`

Πρώτα κάνει login μία φορά (Google) ώστε να δημιουργηθεί στο `auth.users`. Μετά:

```bash
docker exec -i supabase-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
-- Portal Admin
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users where lower(email)='john.zontos@gmail.com'
on conflict (user_id, role) do nothing;

-- Customer Admin (ο ρόλος + πρόσβαση σε ΟΛΟΥΣ τους πελάτες)
insert into public.user_roles (user_id, role)
select id, 'customer_admin'::public.app_role from auth.users where lower(email)='john.zontos@gmail.com'
on conflict (user_id, role) do nothing;

insert into public.user_customer_admins (user_id, customer_id)
select u.id, c.id from auth.users u cross join public.customers c
where lower(u.email)='john.zontos@gmail.com'
on conflict do nothing;

-- Δεν δένεται σε μία εταιρεία (μένει global)
update public.profiles set customer_id = null
where lower(email)='john.zontos@gmail.com';
SQL
```

Το trigger `protect_primary_portal_admin_roles_trigger` εμποδίζει την αφαίρεση αυτών των ρόλων,
και η `is_customer_admin_for()` δίνει έτσι κι αλλιώς πρόσβαση σε κάθε πελάτη σε όποιον είναι
Portal Admin. Έλεγχος:

```bash
docker exec supabase-db psql -X -U postgres -d postgres -c \
"select p.email, r.role from public.profiles p join public.user_roles r on r.user_id=p.id
 where lower(p.email)='john.zontos@gmail.com';"
```

Οι υπόλοιποι χρήστες γίνονται αυτόματα Customer Admin **της δικής τους εταιρείας μόνο**,
εφόσον το domain τους είναι καταχωρημένο στο Admin → Πελάτες → Email domains
(τα generic domains, π.χ. gmail.com, αγνοούνται).

---

## ΒΗΜΑ 10 — Τελικός έλεγχος

| Έλεγχος | Εντολή | Αναμενόμενο |
|---|---|---|
| DB | `docker exec supabase-db psql -U postgres -d postgres -c "select count(*) from public.customers"` | αριθμός πελατών |
| REST | `curl -I https://api.geniusnetsoc.gr/rest/v1/ -H "apikey: $ANON_KEY"` | 200 |
| Auth | `curl https://api.geniusnetsoc.gr/auth/v1/health` | `GoTrue` |
| Providers | `curl -s https://api.geniusnetsoc.gr/auth/v1/settings \| jq .external` | google/azure true |
| Functions | `curl -i https://api.geniusnetsoc.gr/functions/v1/softone-sync` | 401 (όχι 404) |
| Frontend | `https://geniusnetsoc.gr` | login screen |
| SSO | Login με Google | redirect στο `/portal` |
| Ρόλοι | Admin panel για `john.zontos@gmail.com` | όλα τα tabs |

---

## ΒΗΜΑ 11 — Backups

```bash
sudo tee /etc/cron.daily/portal-backup >/dev/null <<'SH'
#!/bin/sh
docker exec supabase-db pg_dump -U postgres -Fc postgres > /var/backups/portal-$(date +%F).dump
find /var/backups -name 'portal-*.dump' -mtime +14 -delete
SH
sudo chmod +x /etc/cron.daily/portal-backup
```

Restore: `docker exec -i supabase-db pg_restore -U postgres -d postgres -c < dump`.
Κράτα και τα volumes storage (`/opt/stack/supabase/volumes/storage`).

---

## Troubleshooting

| Πρόβλημα | Αιτία / Λύση |
|---|---|
| Λευκή σελίδα | Λάθος/κενά `VITE_SUPABASE_*` → διόρθωσε `/opt/portal/.env` και `up -d --build` |
| `Invalid API key` | Το ANON_KEY δεν υπογράφηκε με το ίδιο `JWT_SECRET` |
| `(ENOIDENTIFIER) no tenant identifier provided` | SQL προς Supavisor → χρησιμοποίησε `scripts/apply-self-hosted-migrations.sh` |
| Login redirect σε λάθος domain | `SITE_URL` / `ADDITIONAL_REDIRECT_URLS` στο stack `.env` |
| `redirect_uri_mismatch` | Το URI στο Google/Azure πρέπει να είναι ακριβώς `https://api.geniusnetsoc.gr/auth/v1/callback` |
| «Δεν βλέπω δεδομένα» (RLS) | Δεν έτρεξαν όλες οι migrations (λείπουν GRANTs/policies) |
| Functions 404 | Δεν αντιγράφηκαν στο `volumes/functions` ή δεν έγινε restart |
| Azure sync error | Λείπει `AZURE_AD_ENC_KEY` ή admin consent στα Graph permissions |
| Certbot fail | Λάθος DNS ή κλειστή θύρα 80 |
| OOM στο build | `NODE_OPTIONS=--max-old-space-size=4096` |

---

## Τι χάνεις φεύγοντας από το Cloud

Αυτόματα backups/monitoring/updates, Lovable AI Gateway, managed OAuth broker, και το
preview/publish του Lovable δεν ενημερώνει το VM — κάθε αλλαγή θέλει `git pull` + rebuild +
`./scripts/apply-self-hosted-migrations.sh`.
