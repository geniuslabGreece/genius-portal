# Πλήρες self-hosting (frontend + backend) σε Linux VM — από το μηδέν

Όλα τρέχουν στο VM σου: PostgreSQL, Auth (GoTrue), REST, Realtime, Storage, Edge Functions
και το portal. Το Lovable Cloud χρησιμοποιείται μόνο για το αρχικό export δεδομένων.

> **Απαιτήσεις VM:** Ubuntu 22.04/24.04, **4 vCPU / 8 GB RAM / 60 GB disk**,
> public IP, domain `geniusnetsoc.gr` + subdomain `api.geniusnetsoc.gr`.

> **Κατάσταση ελέγχου:** τα scripts ελέγχονται τοπικά, όχι σε πραγματικό VM.
> Η εγκατάσταση δεν θεωρείται ολοκληρωμένη πριν περάσουν τα login Google/Microsoft,
> τα δικαιώματα και μία πραγματική απάντηση του AI. Η μεταφορά SharePoint και MCP
> έχει πρόσθετες εξαρτήσεις που αναφέρονται παρακάτω.

## Γρήγορη εγκατάσταση με το script

Το script **δεν συνδέεται στο VM**, δεν εγκαθιστά Docker, δεν κάνει export δεδομένων
και δεν ζητά ή δημιουργεί Google/Azure credentials. Τρέχεις τα παρακάτω **στο VM**,
αφού ολοκληρώσεις τα Βήματα 0–1. Χρησιμοποίησε checkout του portal χωρίς το Cloud `.env`:
αν υπάρχει `/opt/portal/.env`, κράτα ιδιωτικό αντίγραφο πριν το αντικαταστήσεις.

```bash
cd /opt/portal
# Το script δημιουργεί αρχεία μόνο όταν δεν υπάρχουν· ποτέ δεν αλλάζει υπάρχοντα κλειδιά.
# Στο backend κράτα .env.example, αλλά ΜΗΝ το αντιγράψεις σε .env για την αυτόματη μέθοδο.
bash scripts/setup-self-host.sh prepare
nano /opt/stack/supabase/.env
nano /opt/portal/.env
# Συμπλήρωσε Google/Azure credentials, βάλε τα ENABLED=true μόνο όταν είναι έτοιμα,
# πραγματικό email Certbot και SMTP. Έλεγξε τις ενότητες των δύο .env παρακάτω.
bash scripts/setup-self-host.sh backend
bash scripts/setup-self-host.sh migrate
# Τώρα εισάγεις ελεγμένα δεδομένα — Βήμα 5. Όχι τυφλό restore πάνω σε production.
bash scripts/setup-self-host.sh https
bash scripts/setup-self-host.sh check
```

Το `prepare` παράγει ασφαλή κλειδιά, δύο `.env` με δικαιώματα `600` και αντιγράφει
το `docker/selfhost/portal.override.yml` στο backend. Το `backend` αντιγράφει τις
εννέα λειτουργίες χωρίς να αντικαθιστά τον upstream φάκελο `main` και εκκινεί το stack.
Το `migrate` τρέχει πρώτα `supabase/migrations`, μετά `drizzle/migrations`, με ιστορικό
και διακοπή στο πρώτο σφάλμα. Το `https` εκδίδει το πιστοποιητικό και εκκινεί τον proxy.
Το `check` ελέγχει τη δημόσια οθόνη σύνδεσης και Auth — **όχι** πραγματική σύνδεση χρήστη.

Για διαφορετική τοποθεσία backend: `STACK_DIR=/άλλη/διαδρομή bash scripts/setup-self-host.sh prepare`.
Χρησιμοποίησε την ίδια μεταβλητή στα επόμενα βήματα. Δεν υπάρχει αυτόματο destructive reset.

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
sudo apt update
sudo apt install -y curl ca-certificates
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
# Διάβασε το script πριν το τρέξεις με δικαιώματα root.
sudo sh /tmp/get-docker.sh
sudo usermod -aG docker $USER && newgrp docker
docker --version && docker compose version

# Υπόλοιπα
sudo apt update
sudo apt install -y git curl ca-certificates openssl jq postgresql-client python3 dnsutils ufw

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable
```

**DNS (πριν το certbot):** A records → public IP του VM για `@`, `www`, `api`.

Αν υπάρχουν AAAA records, πρέπει να δείχνουν επίσης στο σωστό VM ή να αφαιρεθούν.
Μην εκθέσεις δημόσια θύρες 8000, 8443, 5432, 6543, Studio ή Docker socket.
Τα published ports του Docker μπορούν να παρακάμψουν το UFW: βάλε και κανόνες
στο firewall του παρόχου/DOCKER-USER ή περιορισμένα bindings. Ο proxy χρησιμοποιεί
`host.docker.internal:8000`, άρα το API πρέπει να είναι προσβάσιμο από το Docker bridge,
όχι αποκλειστικά στο loopback του host. Πρόσβαση διαχείρισης μόνο μέσω SSH/VPN.

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
cd supabase
# Για το script: ΜΗΝ κάνεις cp .env.example .env, το prepare το δημιουργεί.
# Μόνο για χειροκίνητη εγκατάσταση:
# cp .env.example .env && chmod 600 .env
```

---

## ΒΗΜΑ 2 — Παραγωγή κλειδιών

**Προτεινόμενο:** `bash scripts/setup-self-host.sh prepare` από `/opt/portal`.
Παράγει και γράφει τα κλειδιά χωρίς να τα εμφανίζει. Για χειροκίνητη μέθοδο:

```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 24)
export JWT_SECRET=$(openssl rand -hex 32)          # >= 32 χαρακτήρες
export DASHBOARD_PASSWORD=$(openssl rand -base64 18)
export AZURE_AD_ENC_KEY=$(openssl rand -base64 32) # AES-GCM key για τα Azure secrets
export SECRET_KEY_BASE=$(openssl rand -hex 32)
export VAULT_ENC_KEY=$(openssl rand -hex 16)       # ακριβώς 32 χαρακτήρες
export REALTIME_DB_ENC_KEY=$(openssl rand -hex 8)  # ακριβώς 16 χαρακτήρες
export PG_META_CRYPTO_KEY=$(openssl rand -hex 32)
export LOGFLARE_PUBLIC_ACCESS_TOKEN=$(openssl rand -hex 32)
export LOGFLARE_PRIVATE_ACCESS_TOKEN=$(openssl rand -hex 32)
export S3_PROTOCOL_ACCESS_KEY_ID=$(openssl rand -hex 16)
export S3_PROTOCOL_ACCESS_KEY_SECRET=$(openssl rand -hex 32)
```

### ANON_KEY & SERVICE_ROLE_KEY (υπογεγραμμένα με το ίδιο JWT_SECRET)

```bash
# Χωρίς pip και χωρίς εκτύπωση των κλειδιών στο terminal.
umask 077
python3 - <<'PY' > /opt/stack/keys.txt
import os, sys
sys.path.insert(0, '/opt/portal/scripts')
from importlib import import_module
keygen = import_module('prepare-self-host-env')
for role in ('anon', 'service_role'):
    print(role.upper() + '_KEY=' + keygen.jwt(os.environ['JWT_SECRET'], role))
PY
chmod 600 /opt/stack/keys.txt
```

> Κράτα το `JWT_SECRET` — αν αλλάξει, όλα τα keys ακυρώνονται (`Invalid API key`).

Κράτα **όλα** τα κλειδιά κρυπτογράφησης και ένα ιδιωτικό backup των `.env`.
Μην χρησιμοποιήσεις demo keys από το upstream `.env.example`. Σε νέα upstream έκδοση
έλεγξε και τις πρόσθετες απαιτήσεις κλειδιών· μην κάνεις ανεξέλεγκτο upgrade παραγωγής.
Αν εισάγεις υπάρχοντα κρυπτογραφημένα Azure credentials, χρειάζεται το **ίδιο**
`AZURE_AD_ENC_KEY` της πηγής, διαφορετικά τα ξανακαταχωρίζεις στο Admin μετά τη μεταφορά.

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
REALTIME_DB_ENC_KEY=<REALTIME_DB_ENC_KEY>
PG_META_CRYPTO_KEY=<PG_META_CRYPTO_KEY>
LOGFLARE_PUBLIC_ACCESS_TOKEN=<LOGFLARE_PUBLIC_ACCESS_TOKEN>
LOGFLARE_PRIVATE_ACCESS_TOKEN=<LOGFLARE_PRIVATE_ACCESS_TOKEN>
S3_PROTOCOL_ACCESS_KEY_ID=<S3_PROTOCOL_ACCESS_KEY_ID>
S3_PROTOCOL_ACCESS_KEY_SECRET=<S3_PROTOCOL_ACCESS_KEY_SECRET>

############ Studio (μην το εκθέσεις δημόσια) ############
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<DASHBOARD_PASSWORD>
STUDIO_DEFAULT_ORGANIZATION=GeniusNet
STUDIO_DEFAULT_PROJECT=GeniusNet Portal

############ URLs — ΚΡΙΣΙΜΑ για το login ############
SITE_URL=https://geniusnetsoc.gr
API_EXTERNAL_URL=https://api.geniusnetsoc.gr
SUPABASE_PUBLIC_URL=https://api.geniusnetsoc.gr
# Επιτρεπτοί προορισμοί μετά το login (χωρίς κενά, χωρισμένα με κόμμα).
# Το localhost μόνο αν δοκιμάζεις το frontend τοπικά απέναντι στο VM.
ADDITIONAL_REDIRECT_URLS=https://geniusnetsoc.gr/**,https://www.geniusnetsoc.gr/**,http://localhost:8080/**

############ Auth ############
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
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

**Κρίσιμο:** το Docker `.env` δεν περνά αυτόματα τις μεταβλητές στις υπηρεσίες.
Το upstream compose έχει σχολιασμένα τα Google/Azure settings. Χρησιμοποίησε το
παρεχόμενο override, που περνά τις τιμές στο `auth` και τα secrets στο `functions`:

```bash
cp /opt/portal/docker/selfhost/portal.override.yml /opt/stack/supabase/portal.override.yml
chmod 600 /opt/stack/supabase/.env /opt/portal/.env
```

Τα `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` υπάρχουν ήδη
στο environment του upstream `functions`: URL προς το εσωτερικό API service
(`http://kong:8000` ή `http://api-gw:8000`, ανάλογα με την upstream έκδοση),
`ANON_KEY` και `SERVICE_ROLE_KEY` αντίστοιχα. Μην βάλεις το secret/service-role key
στο frontend. Διατήρησε τον upstream εσωτερικό URL, μην αντιγράψεις τυφλά service names.

Εκκίνηση:

```bash
cd /opt/stack/supabase
docker compose -f docker-compose.yml -f portal.override.yml config --quiet
docker compose -f docker-compose.yml -f portal.override.yml pull
docker compose -f docker-compose.yml -f portal.override.yml up -d
docker compose -f docker-compose.yml -f portal.override.yml ps
curl -s http://localhost:8000/auth/v1/health
```

---

## ΒΗΜΑ 4 — Schema (migrations)

```bash
cd /opt/portal
chmod +x scripts/apply-self-hosted-migrations.sh
./scripts/apply-self-hosted-migrations.sh          # DB_CONTAINER=<name> αν διαφέρει
```

Τρέχει πρώτα **όλα** τα SQL στο `supabase/migrations` και μετά στο `drizzle/migrations`.
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

Lovable → **Database → Manage → Settings → Export data** → CSV → ανέβασέ τα στο `/opt/data`.
Μην θεωρήσεις το CSV πλήρες backup χρηστών/αρχείων. Σταμάτα εγγραφές στην πηγή κατά
το τελικό export και κράτα αντίγραφο πριν την εισαγωγή. Σε υπάρχουσα βάση μην ξανατρέξεις
blind import: θα προκύψουν διπλότυπα και συγκρούσεις.

**Πριν την εισαγωγή:** τα CSV πρέπει να έχουν τις ίδιες στήλες με τη βάση στόχο
και σωστή σειρά, ή να χρησιμοποιήσεις ρητή λίστα στηλών στο `\copy`. Το `HEADER`
δεν αντιστοιχίζει ονόματα στηλών. Εισάγεις πρώτα ανεξάρτητα δεδομένα (πελάτες, προϊόντα),
μετά δεδομένα που τα αναφέρουν. Ο παρακάτω βρόχος είναι **παράδειγμα**, όχι πλήρης μεταφορά:

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

**Χρήστες:** νέα σύνδεση Google/Azure δημιουργεί νέα IDs· δεν μεταφέρει αυτόματα τα
παλιά tickets/messages/profiles. Χρειάζεται αντιστοίχιση παλιού → νέου user ID και
ελεγμένη μεταφορά των σχετικών αναφορών, ή πλήρες εγκεκριμένο auth export εφόσον
είναι διαθέσιμο. Μην παρακάμψεις foreign keys για να περάσει η εισαγωγή.
Το trigger `handle_new_user` φτιάχνει profile και δίνει
`customer_admin` βάσει email domain (και `admin` για `@geniusnet.gr`).

**Storage:** το bucket μόνο του δεν μεταφέρει αρχεία· κατέβασε/ανέβασε τα αντικείμενα
με την ίδια διαδρομή, διατηρώντας ownership και policies. Μόνο στο δικό σου VM:

```sql
insert into storage.buckets (id, name, public) values ('mygn','mygn',false)
on conflict (id) do nothing;
```

---

## ΒΗΜΑ 6 — Edge functions

```bash
cp -r /opt/portal/supabase/functions/* /opt/stack/supabase/volumes/functions/
cd /opt/stack/supabase
docker compose -f docker-compose.yml -f portal.override.yml up -d --force-recreate functions
curl -i "http://localhost:8000/functions/v1/softone-sync"   # 401 = ΟΚ (όχι 404)
```

Functions: `ai-assistant`, `azure-ad-sync`, `mcp`, `notify-ticket`,
`sharepoint-import-customers`, `sharepoint-sync-worklogs`, `sharepoint-worklogs`,
`softone-sync`, `support-chat`.

**Περιορισμοί πλήρους αποσύνδεσης από Cloud:**
- AI: δικό σου OpenAI key (environment ή Admin → AI Bot) ή Gemini key στο panel.
- Azure sync: Microsoft Graph απευθείας, με tenant credentials και admin consent.
- SharePoint: οι τρεις υπάρχουσες functions καλούν τον connector gateway του Lovable.
  Η αντιγραφή τους και ένα `MICROSOFT_SHAREPOINT_API_KEY` **δεν** τις κάνει ανεξάρτητες.
  Χρειάζεται ξεχωριστή αντικατάσταση με άμεσες Graph κλήσεις πριν δηλωθεί πλήρες self-host.
- MCP: ο υπάρχων issuer δείχνει στο Cloud, όχι στο VM. Απαιτούνται ξεχωριστή ρύθμιση
  issuer/OAuth server και δοκιμές MCP· μην υποθέσεις ότι λειτουργεί μόνο με την αντιγραφή.
- Ειδοποιήσεις: η AI ταξινόμηση χρησιμοποιεί προαιρετικά το Cloud key· χωρίς αυτό
  υπάρχει τοπικό fallback. Έλεγξε ξεχωριστά τη διαμόρφωση SMTP στο Admin και την αποστολή.

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
LETSENCRYPT_EMAIL=<πραγματικό email επικοινωνίας>
```

Σειρά εκκίνησης proxy:
1. Το `bootstrap.conf.template` σηκώνεται πρώτο σε port 80 και σερβίρει **μόνο** το ACME challenge (όλα τα άλλα 503).
2. Το certbot εκδίδει ένα certificate για apex + www + api.
3. Ο proxy αλλάζει στο `default.conf.template` (HTTPS, OAuth routing).

Έλεγχος μετά:
```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml exec proxy nginx -t
curl -sI https://api.geniusnetsoc.gr/auth/v1/health
curl -s  https://api.geniusnetsoc.gr/auth/v1/settings | jq '.external'
```

Πρώτο σήκωμα (εκδίδει certificates για apex + www + api):

```bash
cd /opt/portal
# Αν έτρεξες prepare, το .env είναι ήδη έτοιμο — μην το αντικαταστήσεις.
nano .env
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
4. Για **login**: delegated OIDC scopes `openid`, `profile`, `email` και optional claim
   `email` όπου χρειάζεται. Τα Application permissions `User.Read.All`, `Group.Read.All`,
   `Device.Read.All`, `Reports.Read.All`, `Organization.Read.All` αφορούν **ξεχωριστά τον
   συγχρονισμό** μέσω Graph και απαιτούν **Grant admin consent**, όχι απλώς OAuth login.
5. Tenant id / client id / secret → `GOTRUE_EXTERNAL_AZURE_*` και στο Admin → **Tenant / Azure AD**
   tab του portal (για user/device/license sync· το secret κρυπτογραφείται με `AZURE_AD_ENC_KEY`).

```bash
cd /opt/stack/supabase
docker compose -f docker-compose.yml -f portal.override.yml up -d --force-recreate auth
curl -s https://api.geniusnetsoc.gr/auth/v1/settings | jq '.external'
```

Πρέπει να δείχνει `"google": true, "azure": true`.

### 8.3 Πώς ρέει το login (και τι κάνει ο κώδικας)

```text
geniusnetsoc.gr/login ──► api.geniusnetsoc.gr/auth/v1/authorize?provider=google|azure
   ──► Google / Microsoft ──► api.geniusnetsoc.gr/auth/v1/callback
   ──► 302 στο https://geniusnetsoc.gr/login#access_token=... ──► /portal
```

- Το `src/portal/auth/oauth.ts` καταλαβαίνει μόνο του ότι το backend **δεν** είναι managed
  (`VITE_SUPABASE_URL` ≠ `*.supabase.co`) και καλεί απευθείας `supabase.auth.signInWithOAuth`
  με `redirectTo = https://geniusnetsoc.gr/login`. Για Azure ζητά `openid profile email offline_access`.
- Το κουμπί **«Σύνδεση με Microsoft»** στέλνει `provider: "azure"`.
- Ο nginx (`docker/proxy/default.conf.template`) έχει ξεχωριστό `location /auth/v1/` με
  `X-Forwarded-Proto https`, `X-Forwarded-Host`, `proxy_buffering off`, `proxy_redirect off`
  και μεγάλα header buffers, ώστε τα callbacks και τα cookies να περνούν αυτούσια.

### 8.3α Checklist αν το login αποτυγχάνει

| Σύμπτωμα | Διόρθωση |
|---|---|
| `redirect_uri_mismatch` (Google) / `AADSTS50011` (Azure) | Ο provider πρέπει να έχει **ακριβώς** `https://api.geniusnetsoc.gr/auth/v1/callback` |
| `Unsupported provider` | Έλεγξε ENABLED=true **και το override**, έπειτα recreate του auth με τα δύο compose files |
| Μετά το login γυρνά στο `SITE_URL` αντί για `/login` | Πρόσθεσε το URL στο `ADDITIONAL_REDIRECT_URLS` |
| Callback με `http://` | Λείπει `API_EXTERNAL_URL=https://...` ή ο proxy δεν στέλνει `X-Forwarded-Proto` |
| `502 / upstream sent too big header` | Ξαναφόρτωσε τον proxy με το νέο template |
| Η Microsoft δεν επιστρέφει email | Στο Entra: Token configuration → optional claim `email`, και ο χρήστης να έχει mail |

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

Δοκίμασε και Microsoft login, AI απάντηση, ticket creation/read-back, πρόσβαση John σε
δύο διαφορετικούς πελάτες και περιορισμό απλού χρήστη στη δική του εταιρεία. Ένα HTTP 200
δεν αποδεικνύει σωστά δικαιώματα. Σε `permission denied` έλεγξε τα GRANTs της συγκεκριμένης
legacy migration — μη δώσεις δημόσια πρόσβαση για να ξεπεράσεις το σφάλμα.

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

Restore: μόνο σε ξεχωριστή δοκιμαστική εγκατάσταση πρώτα· το `pg_restore --clean`
διαγράφει υπάρχοντα αντικείμενα. Μην το τρέξεις τυφλά σε παραγωγή.
Κράτα και τα volumes storage (`/opt/stack/supabase/volumes/storage`).

Κράτα επίσης τα δύο `.env`, το `portal.override.yml`, τα certificate volumes και την
έκδοση του upstream stack. Τα backups περιέχουν secrets και προσωπικά δεδομένα:
χρησιμοποίησε δικαιώματα `600`, κρυπτογράφηση και αντίγραφο εκτός VM.

## Επόμενες ενημερώσεις

```bash
cd /opt/portal
# Μετά την ενημέρωση του κώδικα από το repository, πάρε πρώτα backup βάσης/volumes.
bash scripts/setup-self-host.sh backend
bash scripts/setup-self-host.sh migrate
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build
bash scripts/setup-self-host.sh check
```

Μην ξανατρέξεις `prepare` για update και μην ανανεώσεις encryption keys. Οι upstream
αναβαθμίσεις βάσης/stack γίνονται ξεχωριστά, πρώτα δοκιμαστικά, όχι με τυφλό νέο clone.

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
