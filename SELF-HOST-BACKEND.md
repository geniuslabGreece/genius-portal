# Πλήρες self-hosting (frontend + backend) σε Linux VM

Σενάριο 2: **όλα τρέχουν στο VM σου** — database, auth, storage, edge functions και το portal.
Το Lovable Cloud δεν χρησιμοποιείται πλέον από το app· μένει μόνο ως πηγή για το αρχικό export.

> Ελάχιστες απαιτήσεις: **4 vCPU / 8 GB RAM / 60 GB disk**, Ubuntu 22.04 ή 24.04,
> ένα domain (π.χ. `geniusnetsoc.gr`) και ένα subdomain για το API (π.χ. `api.geniusnetsoc.gr`).

---

## 0. Επισκόπηση

```text
                 ┌───────────────────────────────┐
  portal.…gr ───▶│ nginx proxy (80/443, certbot) │
                 └──────┬────────────────┬───────┘
                        │                │
             ┌──────────▼──────┐   ┌─────▼─────────────────────────┐
             │ portal (React)  │   │ Supabase stack (Kong :8000)   │
             │ Dockerfile      │   │ db · auth · rest · realtime   │
             └─────────────────┘   │ storage · functions · studio  │
  api.…gr ─────────────────────────▶ meta · imgproxy · analytics   │
                                   └───────────────────────────────┘
```

---

## 1. Προαπαιτούμενα στο VM

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
sudo apt update && sudo apt install -y git postgresql-client jq openssl
```

DNS: `A` records για `geniusnetsoc.gr` και `api.geniusnetsoc.gr` → public IP του VM.
Firewall: `sudo ufw allow 80,443/tcp`.

---

## 2. Το Supabase stack

```bash
sudo mkdir -p /opt/stack && sudo chown -R $USER:$USER /opt/stack
cd /opt/stack
git clone --depth 1 https://github.com/supabase/supabase.git supabase-src
cp -r supabase-src/docker supabase
cd supabase
cp .env.example .env
```

### 2.1 Κλειδιά

```bash
# Postgres password
openssl rand -hex 24
# JWT secret (>= 32 χαρακτήρες)
openssl rand -hex 32
# Dashboard password
openssl rand -base64 18
```

Με βάση το JWT secret φτιάξε **ANON_KEY** και **SERVICE_ROLE_KEY** από το
[Supabase JWT generator](https://supabase.com/docs/guides/self-hosting#api-keys)
(roles: `anon` και `service_role`, exp ~10 χρόνια).

### 2.2 `.env` του stack (τα σημαντικά)

```env
POSTGRES_PASSWORD=<από πάνω>
JWT_SECRET=<από πάνω>
ANON_KEY=<generated>
SERVICE_ROLE_KEY=<generated>

DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<από πάνω>

SITE_URL=https://geniusnetsoc.gr
API_EXTERNAL_URL=https://api.geniusnetsoc.gr
SUPABASE_PUBLIC_URL=https://api.geniusnetsoc.gr
ADDITIONAL_REDIRECT_URLS=https://geniusnetsoc.gr/**

DISABLE_SIGNUP=false
ENABLE_EMAIL_AUTOCONFIRM=false
STUDIO_DEFAULT_PROJECT=GeniusNet Portal

# SMTP για auth emails
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=noreply@geniusnetsoc.gr
SMTP_PASS=<app password>
SMTP_ADMIN_EMAIL=admin@geniusnetsoc.gr
SMTP_SENDER_NAME=GeniusNet Portal
```

### 2.3 Εκκίνηση

```bash
docker compose pull
docker compose up -d
docker compose ps          # όλα healthy
curl -I http://localhost:8000/auth/v1/health
```

Studio: `http://<vm-ip>:8000` (basic auth με DASHBOARD_USERNAME/PASSWORD) — **μην το αφήσεις εκτεθειμένο**.

---

## 3. Μεταφορά schema

Όλο το schema του portal υπάρχει ήδη ως migrations στο repo (`supabase/migrations/*.sql`, 27 αρχεία).
Τρέχουν με τη σειρά:

```bash
cd /opt/portal        # το repo του portal
export PGPASSWORD='<POSTGRES_PASSWORD>'
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$f"
done
```

Έλεγχος:

```bash
psql -h 127.0.0.1 -U postgres -d postgres -c "\dt public.*"
psql -h 127.0.0.1 -U postgres -d postgres -c "select proname from pg_proc join pg_namespace n on n.oid=pronamespace where nspname='public';"
```

Πρέπει να δεις τους πίνακες (`profiles`, `customers`, `contracts`, `tickets`, `products`,
`user_roles`, `customer_azure_ad_*`, `softone_settings`, `mail_server_settings`,
`ai_assistant_settings`, …) και τα functions `has_role`, `is_admin`, `user_has_customer_access` κ.λπ.

---

## 4. Μεταφορά δεδομένων

Στο Lovable: **Cloud → Advanced settings → Export data** (μόνο export υπάρχει, όχι import).
Κατέβασε τα CSV και ανέβασέ τα στο VM.

Σειρά φόρτωσης (λόγω foreign keys):

```bash
cd /opt/data
export PGPASSWORD='<POSTGRES_PASSWORD>'
PSQL="psql -h 127.0.0.1 -U postgres -d postgres"

for t in customers customer_email_domains products contracts \
         customer_azure_ad_settings customer_azure_ad_groups customer_azure_ad_role_mappings \
         softone_settings mail_server_settings ai_assistant_settings; do
  $PSQL -c "\copy public.$t FROM '$t.csv' WITH CSV HEADER"
done
```

### 4.1 Χρήστες (auth.users)

Οι χρήστες **δεν** μεταφέρονται με CSV — δεν έχεις πρόσβαση στα password hashes του Cloud.
Δύο επιλογές:

* **Συνιστάται:** αφήνεις τους χρήστες να ξανακάνουν login με Google/Azure SSO. Το trigger
  `handle_new_user` δημιουργεί αυτόματα profile + ρόλο (`@geniusnet.gr` → admin).
* Εναλλακτικά, δημιουργείς τους προγραμματιστικά με το Admin API:

```bash
curl -X POST "https://api.geniusnetsoc.gr/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"johnz@geniusnet.gr","email_confirm":true,"password":"<προσωρινό>"}'
```

Μετά τη δημιουργία, φόρτωσε `profiles.csv`, `user_roles.csv`, `user_customer_admins.csv`
**αφού** αντιστοιχίσεις τα νέα `user_id` (τα παλιά UUID δεν διατηρούνται):

```bash
$PSQL -c "\copy public.profiles FROM 'profiles.csv' WITH CSV HEADER"   # μόνο αν κράτησες τα ίδια ids
```

Ο βασικός admin πάντως εξασφαλίζεται με το χέρι:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'john.zontos@gmail.com'
on conflict do nothing;
```

### 4.2 Storage bucket `mygn`

```sql
insert into storage.buckets (id, name, public) values ('mygn','mygn',false)
on conflict (id) do nothing;
```

Τα αρχεία κατεβαίνουν από το Cloud και ανεβαίνουν ξανά μέσω Studio ή Storage API.

---

## 5. Edge functions

Οι 9 functions (`ai-assistant`, `azure-ad-sync`, `mcp`, `notify-ticket`,
`sharepoint-import-customers`, `sharepoint-sync-worklogs`, `sharepoint-worklogs`,
`softone-sync`, `support-chat`) τρέχουν στο container `functions` του stack:

```bash
cp -r /opt/portal/supabase/functions/* /opt/stack/supabase/volumes/functions/
docker compose restart functions
```

### 5.1 Secrets των functions

Στο self-hosted δεν υπάρχει secrets UI — μπαίνουν ως env vars.
Πρόσθεσε στο `/opt/stack/supabase/.env`:

```env
MICROSOFT_SHAREPOINT_API_KEY=...
AZURE_AD_ENC_KEY=...        # openssl rand -base64 32
LOVABLE_API_KEY=...         # ή δικό σου OpenAI/Anthropic key στο AI Bot tab
```

και στο `docker-compose.yml` του stack, στο service `functions`, πέρασέ τα:

```yaml
  functions:
    environment:
      MICROSOFT_SHAREPOINT_API_KEY: ${MICROSOFT_SHAREPOINT_API_KEY}
      AZURE_AD_ENC_KEY: ${AZURE_AD_ENC_KEY}
      LOVABLE_API_KEY: ${LOVABLE_API_KEY}
```

> Το `LOVABLE_API_KEY` (AI Gateway) δεν λειτουργεί εκτός Lovable. Στο self-hosted βάλε δικό σου
> κλειδί μοντέλου από το **Admin → AI Bot** tab.

Έλεγχος:

```bash
curl -s "https://api.geniusnetsoc.gr/functions/v1/softone-sync" -H "Authorization: Bearer $ANON_KEY" -i | head -20
```

---

## 6. Frontend προς το νέο backend

Στο `/opt/portal/.env`:

```env
VITE_SUPABASE_URL="https://api.geniusnetsoc.gr"
VITE_SUPABASE_PUBLISHABLE_KEY="<ANON_KEY του self-hosted>"
VITE_SUPABASE_PROJECT_ID="selfhosted"
PORT=127.0.0.1:8080
DOMAIN=geniusnetsoc.gr
LETSENCRYPT_EMAIL=admin@geniusnetsoc.gr
```

```bash
cd /opt/portal
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build
```

> Τα `VITE_*` ψήνονται στο build — κάθε αλλαγή θέλει `--build`.

### 6.1 nginx για το `api.` subdomain

Πρόσθεσε server block που κάνει proxy στο Kong (`127.0.0.1:8000`):

```nginx
server {
    listen 443 ssl;
    server_name api.geniusnetsoc.gr;
    ssl_certificate     /etc/letsencrypt/live/api.geniusnetsoc.gr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.geniusnetsoc.gr/privkey.pem;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # realtime websockets
        proxy_set_header Connection "upgrade";
    }
}
```

Cert: `sudo certbot certonly --webroot -w /var/www/certbot -d api.geniusnetsoc.gr`.

---

## 7. Re-configure OAuth providers

Το callback URL αλλάζει από το Lovable Cloud στο δικό σου API domain:

```text
https://api.geniusnetsoc.gr/auth/v1/callback
```

### 7.1 Google

1. Google Cloud Console → **APIs & Services → Credentials → OAuth client (Web)**.
2. **Authorized JavaScript origins**: `https://geniusnetsoc.gr`
3. **Authorized redirect URIs**: `https://api.geniusnetsoc.gr/auth/v1/callback`
4. OAuth consent screen → Authorized domains: `geniusnetsoc.gr`
5. Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`

Στο `/opt/stack/supabase/.env`:

```env
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<client id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<client secret>
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.geniusnetsoc.gr/auth/v1/callback
```

### 7.2 Azure AD / Entra ID

1. Entra portal → **App registrations** → το app σου → **Authentication**.
2. Redirect URI (Web): `https://api.geniusnetsoc.gr/auth/v1/callback`
3. **Certificates & secrets** → νέο client secret.
4. **API permissions** (application): `User.Read.All`, `Group.Read.All`, `Device.Read.All`,
   `Reports.Read.All` (Copilot usage) → **Grant admin consent**.

```env
GOTRUE_EXTERNAL_AZURE_ENABLED=true
GOTRUE_EXTERNAL_AZURE_CLIENT_ID=<app id>
GOTRUE_EXTERNAL_AZURE_SECRET=<secret>
GOTRUE_EXTERNAL_AZURE_URL=https://login.microsoftonline.com/<tenant-id>/v2.0
GOTRUE_EXTERNAL_AZURE_REDIRECT_URI=https://api.geniusnetsoc.gr/auth/v1/callback
```

```bash
cd /opt/stack/supabase && docker compose up -d auth
```

### 7.3 Σημαντικό για τον κώδικα

Το `lovable.auth.signInWithOAuth()` (Lovable managed OAuth broker) **δεν δουλεύει self-hosted**.
Στο self-hosted deployment το κουμπί Google πρέπει να καλεί απευθείας:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",                     // ή "azure"
  options: { redirectTo: `${window.location.origin}/portal` },
});
```

Το `src/portal/pages/Login.tsx` έχει ήδη fallback σε `supabase.auth.signInWithOAuth` όταν το
Lovable broker δεν απαντά — αν κολλήσει, άλλαξέ το να καλεί μόνο το supabase client.

---

## 8. Backups

```bash
# /etc/cron.daily/portal-backup
#!/bin/sh
docker exec supabase-db pg_dump -U postgres -Fc postgres \
  > /var/backups/portal-$(date +%F).dump
find /var/backups -name 'portal-*.dump' -mtime +14 -delete
```

Restore: `docker exec -i supabase-db pg_restore -U postgres -d postgres -c < dump`.
Κράτα και τα volumes του storage (`/opt/stack/supabase/volumes/storage`).

---

## 9. Έλεγχος ότι όλα παίζουν

| Έλεγχος | Εντολή / ενέργεια | Αναμενόμενο |
|---|---|---|
| DB | `psql … -c "select count(*) from public.customers"` | ο αριθμός των πελατών |
| API | `curl -I https://api.geniusnetsoc.gr/rest/v1/ -H "apikey: $ANON_KEY"` | 200 |
| Auth | `curl https://api.geniusnetsoc.gr/auth/v1/health` | `{"...":"GoTrue"}` |
| Functions | `curl -i https://api.geniusnetsoc.gr/functions/v1/softone-sync` | 401 (όχι 404) |
| Frontend | άνοιξε `https://geniusnetsoc.gr` | login screen |
| SSO | Login με Google | redirect πίσω στο `/portal` |
| Ρόλοι | Admin panel ορατό για `john.zontos@gmail.com` | όλα τα tabs |

---

## 10. Troubleshooting

| Πρόβλημα | Αιτία / Λύση |
|---|---|
| Λευκή σελίδα μετά το build | Λάθος/κενά `VITE_SUPABASE_*` → διόρθωσε `.env` και `--build` |
| `Invalid API key` | Το ANON_KEY δεν έχει υπογραφεί με το ίδιο `JWT_SECRET` |
| Login redirect σε λάθος domain | `SITE_URL` / `ADDITIONAL_REDIRECT_URLS` στο stack `.env` |
| `redirect_uri_mismatch` | Το URI στο Google/Azure δεν είναι ακριβώς `https://api.…/auth/v1/callback` |
| RLS: «δεν βλέπω δεδομένα» | Δεν έτρεξαν όλες οι migrations (λείπουν GRANTs/policies) |
| Functions 404 | Δεν αντιγράφηκαν στο `volumes/functions` ή δεν έγινε restart |
| Azure sync αποτυγχάνει | Λείπει `AZURE_AD_ENC_KEY` ή admin consent στα Graph permissions |
| Realtime δεν συνδέεται | Λείπουν τα `Upgrade`/`Connection` headers στο nginx |
| OOM στο build | `NODE_OPTIONS=--max-old-space-size=4096` |

---

## 11. Τι χάνεις φεύγοντας από το Cloud

* Αυτόματα backups, monitoring και updates — τα αναλαμβάνεις εσύ.
* Lovable AI Gateway (`LOVABLE_API_KEY`) — χρειάζεσαι δικό σου model API key.
* Managed OAuth broker — χρησιμοποιείς απευθείας τους providers (κεφ. 7).
* Το preview/publish του Lovable δεν ενημερώνει πια το self-hosted περιβάλλον· κάθε αλλαγή
  θέλει `git pull` + rebuild + νέες migrations στο VM.
