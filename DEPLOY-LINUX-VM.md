# Εγκατάσταση του portal σε Linux VM (self-hosting)

Το app είναι **frontend-only** (Vite + React). Το backend (database, auth, edge functions, storage)
μένει στο Lovable Cloud — δεν χρειάζεται να τρέξει τίποτα άλλο στο VM πέρα από έναν web server.

---

## 1. Προαπαιτούμενα (Ubuntu 22.04/24.04, Debian 12)

```bash
sudo apt update && sudo apt install -y git curl nginx
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

(Προαιρετικά αντί για npm: `curl -fsSL https://bun.sh/install | bash`)

---

## 2. Κατέβασμα κώδικα

Στο Lovable: **GitHub → Connect to GitHub** και μετά:

```bash
cd /opt
sudo git clone https://github.com/<org>/<repo>.git portal
sudo chown -R $USER:$USER /opt/portal
cd /opt/portal
npm install
```

---

## 3. Μεταβλητές περιβάλλοντος

Δημιούργησε `/opt/portal/.env` με τις ίδιες τιμές που έχει ήδη το project:

```env
VITE_SUPABASE_PROJECT_ID="osshbsfuqawrljizeruq"
VITE_SUPABASE_URL="https://osshbsfuqawrljizeruq.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_eCTih28CyU86x6oLcWNoIA_VbdI30wE"
```

Αυτά είναι public keys (προστασία μέσω RLS) — δεν είναι μυστικά.
Τα πραγματικά secrets (SharePoint, SoftOne, AI keys) ζουν στο backend, όχι στο VM.

---

## 4. Build

```bash
cd /opt/portal
npm run build      # παράγει το /opt/portal/dist
```

---

## 5. Nginx (SPA routing – ΑΠΑΡΑΙΤΗΤΟ)

`/etc/nginx/sites-available/portal`:

```nginx
server {
    listen 80;
    server_name portal.geniusnet.gr;

    root /opt/portal/dist;
    index index.html;

    # SPA fallback — χωρίς αυτό το refresh σε /portal/admin δίνει 404
    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|woff2|svg|png|jpg|webp)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d portal.geniusnet.gr
```

---

## 7. Ρυθμίσεις Auth (σημαντικό!)

Στο Lovable → **Backend → Authentication → URL Configuration** πρόσθεσε το νέο domain:

- Site URL: `https://portal.geniusnet.gr`
- Redirect URLs: `https://portal.geniusnet.gr/**`

Και στα OAuth providers:
- **Google Cloud Console** → Authorized redirect URI: `https://osshbsfuqawrljizeruq.supabase.co/auth/v1/callback`
- **Azure / Entra ID** → ίδιο redirect URI

Αν λείψουν αυτά, το login κάνει redirect σε λάθος domain.

---

## 8. Ενημερώσεις (deploy script)

`/opt/portal/deploy.sh`:

```bash
#!/usr/bin/env bash
set -e
cd /opt/portal
git pull
npm ci
npm run build
sudo systemctl reload nginx
echo "Deployed OK"
```

```bash
chmod +x /opt/portal/deploy.sh
```

---

## 9. Έλεγχος

```bash
curl -I https://portal.geniusnet.gr
```
Μετά άνοιξε το site → Login με Google/Microsoft → πρέπει να μπεις στο `/portal`.

---

## Troubleshooting

| Πρόβλημα | Αιτία / Λύση |
|---|---|
| Λευκή σελίδα | Λείπουν τα `VITE_SUPABASE_*` κατά το build → ξανακάνε build με σωστό `.env` |
| 404 σε refresh | Λείπει το `try_files ... /index.html` |
| `tsx: command not found` | `npm install` (dev deps) — το `prebuild` χρειάζεται tsx |
| Login redirect loop | Δεν έχει προστεθεί το domain στα Redirect URLs του backend |
| Edge functions 401 | Ισχύουν κανονικά — τρέχουν στο Cloud, όχι στο VM |
| Out of memory στο build | `NODE_OPTIONS=--max-old-space-size=2048 npm run build` (min 2GB RAM) |

---

## 10. Εναλλακτικά: Docker (χωρίς χειροκίνητες ρυθμίσεις)

Στο VM αρκεί Docker + Compose:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Μετά:

```bash
cd /opt/portal
cp .env.docker.example .env     # οι ίδιες VITE_* τιμές + PORT
docker compose up -d --build
```

Το site τρέχει στο `http://<vm-ip>:8080` (nginx μέσα στο container, με SPA fallback,
gzip και cache headers ήδη ρυθμισμένα στο `docker/nginx.conf`).

Ενημέρωση:

```bash
git pull && docker compose up -d --build
```

Λογs / κατάσταση:

```bash
docker compose logs -f
docker compose ps
```

> Σημείωση: τα `VITE_*` ενσωματώνονται στο bundle **κατά το build**, γι' αυτό περνιούνται
> ως build args στο compose. Αν αλλάξουν, χρειάζεται `--build` ξανά.

Για HTTPS/custom domain υπάρχει έτοιμο overlay `docker-compose.proxy.yml` (nginx + certbot) — δες το κεφάλαιο 9 του `DOCKER.md`
και μην ξεχάσεις τα Redirect URLs του βήματος 7.

---

## 11. Πλήρες self-host (και backend στο VM)

Ο παραπάνω οδηγός κρατά το backend στο Lovable Cloud. Αν θέλεις **τα πάντα στο VM**
(database, auth, storage, edge functions) με export schema/δεδομένων και re-configure των
OAuth providers, δες το **[`SELF-HOST-BACKEND.md`](./SELF-HOST-BACKEND.md)**.
Απαιτήσεις: 4 vCPU / 8 GB RAM και δεύτερο subdomain για το API (π.χ. `api.geniusnet.gr`).

