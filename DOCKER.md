# Εκτέλεση του Portal με Docker

## 1. Προαπαιτούμενα (μία φορά ανά VM)

Ubuntu/Debian:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version && docker compose version
```

## 2. Κατέβασμα του κώδικα

```bash
git clone <TO_GIT_REPO_URL> geniusnet-portal
cd geniusnet-portal
```

## 3. Ρύθμιση μεταβλητών

```bash
cp .env.docker.example .env
nano .env
```

Το `.env` πρέπει να έχει:

```env
VITE_SUPABASE_PROJECT_ID="osshbsfuqawrljizeruq"
VITE_SUPABASE_URL="https://osshbsfuqawrljizeruq.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
PORT=8080
```

Σημείωση: αυτά είναι public (anon) κλειδιά — δεν είναι μυστικά. Τα δεδομένα προστατεύονται από RLS.
Το Vite τα «ψήνει» μέσα στο build, άρα **κάθε αλλαγή τους απαιτεί rebuild**.

## 4. Build & εκκίνηση

```bash
docker compose up -d --build
```

Έλεγχος:

```bash
docker compose ps
docker compose logs -f portal
curl -I http://localhost:8080
```

Η εφαρμογή τρέχει στο `http://<IP_TOU_VM>:8080`.

## 5. Ενημέρωση σε νέα έκδοση

```bash
git pull
docker compose up -d --build
docker image prune -f
```

## 6. Χρήσιμες εντολές

```bash
docker compose restart portal     # restart
docker compose down               # σταμάτημα
docker compose down -v            # σταμάτημα + καθάρισμα volumes
docker compose logs --tail=100 portal
docker exec -it geniusnet-portal sh
```

## 7. HTTPS / domain (προαιρετικά αλλά απαραίτητο για login)

Το OAuth (Google/Azure) θέλει σταθερό https URL. Βάλε reverse proxy Nginx στο host:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/portal
```

```nginx
server {
    listen 80;
    server_name portal.geniusnet.gr;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d portal.geniusnet.gr
```

## 8. Τελευταίο βήμα: redirect URLs

Στις ρυθμίσεις Authentication του backend πρόσθεσε:

- Site URL: `https://portal.geniusnet.gr`
- Redirect URLs: `https://portal.geniusnet.gr/**`

Το ίδιο και στο Azure AD App Registration (Redirect URI).
Χωρίς αυτό το login με Google/Azure θα γυρνάει σε σφάλμα.

## Troubleshooting

| Πρόβλημα | Λύση |
|---|---|
| Λευκή σελίδα | Λείπουν τα `VITE_SUPABASE_*` στο build → συμπλήρωσε `.env` και `docker compose up -d --build` |
| 404 σε refresh π.χ. `/portal/admin` | Το SPA fallback είναι ήδη στο `docker/nginx.conf`· βεβαιώσου ότι δεν το παρακάμπτει proxy |
| Δεν ανοίγει η θύρα | `sudo ufw allow 8080/tcp` (ή 80/443 αν έχεις proxy) |
| Build σφάλμα npm | `docker compose build --no-cache portal` |
| Login redirect error | Λάθος Site/Redirect URLs (βήμα 8) |
