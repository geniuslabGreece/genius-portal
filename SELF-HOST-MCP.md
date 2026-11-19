# Microsoft / Google και MCP agents στο VM

## Τι επιβεβαιώθηκε

Στον έλεγχο της 19/11/2026 το `https://api.geniusnetsoc.gr/auth/v1/health`, τα settings και το OAuth discovery επέστρεφαν **HTTP 502**. Δεν επιβεβαιώθηκε επιτυχής σύνδεση, εγγραφή ή προσθήκη agent στο VM. Στο Cloud Google/Microsoft και εγγραφές είναι ενεργά, το email απαιτεί επιβεβαίωση και ο OAuth server/DCR είναι ήδη ενεργός. Δεν ενεργοποιήθηκε νέα υπηρεσία Cloud.

## 1. Πρώτα διορθώστε το 502

Στο VM, από `/opt/portal`:

```bash
bash scripts/setup-self-host.sh doctor
curl -f https://api.geniusnetsoc.gr/auth/v1/health
```

Ακολουθήστε το SELF-HOST-BACKEND.md για υπηρεσίες, firewall και HTTPS. Μην προχωρήσετε αν το health δεν δίνει 200. Το 502 αποδεικνύει πρόβλημα πρόσβασης στο API, όχι συγκεκριμένη αιτία firewall.

## 2. Σύνδεση και εγγραφή Google / Microsoft

- Οι OAuth πάροχοι δημιουργούν λογαριασμό στην πρώτη επιτυχή σύνδεση· χρησιμοποιούνται και από την καρτέλα Εγγραφή.
- Στο `/opt/stack/supabase/.env` βάλτε τα δικά σας Google/Azure στοιχεία σύμφωνα με τα βήματα 4–5 του SELF-HOST-BACKEND.md.
- Και στους δύο παρόχους το callback είναι ακριβώς `https://api.geniusnetsoc.gr/auth/v1/callback`.
- Microsoft: ενεργό email claim και σωστό tenant. Google: τα δοκιμαστικά accounts πρέπει να είναι test users αν το consent είναι σε testing.
- `SITE_URL=https://geniusnetsoc.gr` και allow-list για `https://geniusnetsoc.gr/**` / `https://www.geniusnetsoc.gr/**`, που καλύπτει `/login` και `/.lovable/oauth/consent`.
- Αντικαταστήστε το VM override με τη νέα έκδοση και επανεκκινήστε μέσω του installer:

```bash
cp docker/selfhost/portal.override.yml /opt/stack/supabase/portal.override.yml
bash scripts/setup-self-host.sh backend
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build
```

Σε ιδιωτικό παράθυρο δοκιμάστε **και τους δύο** παρόχους, μία φορά με υφιστάμενο και μία με νέο λογαριασμό. Επιβεβαιώστε επιστροφή στο portal, σωστό email και εταιρεία. Μην αντιγράφετε login κωδικούς ή tokens στα logs/chat.

## 3. Ξεχωριστή ρύθμιση MCP για το VM

Στο `/opt/portal/.env` προσθέστε:

```dotenv
VITE_SUPABASE_URL=https://api.geniusnetsoc.gr
VITE_SUPABASE_PROJECT_ID=selfhosted
VITE_MCP_OAUTH_ISSUER=https://api.geniusnetsoc.gr/auth/v1
```

Το υπάρχον δημόσιο κλειδί πρέπει να παραμένει αυτό του VM. Η ρύθμιση issuer είναι build-time και πρέπει να συμφωνεί **ακριβώς** με το discovery. Δεν χρησιμοποιείται ο OAuth server του Cloud για λογαριασμούς του VM.

## 4. Προϋποθέσεις OAuth του VM — πριν ενεργοποιηθεί

Το VM χρειάζεται έκδοση Auth με OAuth server/DCR και ενεργά ασύμμετρα κλειδιά υπογραφής. Ο installer παράγει legacy HS256 keys και **δεν** τα μετατρέπει αυτόματα: πρώτα πάρτε backup και ακολουθήστε τη διαδικασία signing-key migration της εγκατεστημένης έκδοσης. Μην αλλάξετε JWT_SECRET/ANON_KEY/SERVICE_ROLE_KEY πρόχειρα και μην χρησιμοποιήσετε browser session token ως σύνδεση agent.

Μετά τον έλεγχο signing στο VM `.env`:

```dotenv
GOTRUE_OAUTH_SERVER_ENABLED=true
GOTRUE_OAUTH_SERVER_ALLOW_DYNAMIC_REGISTRATION=true
```

Το override περνά αυτές τις επιλογές στην υπηρεσία auth, θέτει consent path `/.lovable/oauth/consent` και issuer `${API_EXTERNAL_URL}/auth/v1`. Αν η εγκατεστημένη έκδοση δεν τις υποστηρίζει, σταματήστε για αναβάθμιση/έλεγχο συμβατότητας. Η εμφάνιση δημόσιου key στο JWKS δεν αποδεικνύει ενεργό asymmetric signing: ελέγξτε το **alg** ενός φρέσκου OAuth token τοπικά, χωρίς να εμφανίσετε το token.

## 5. Παραγωγή ξεχωριστού bundle, χωρίς ενεργοποίηση

```bash
bash scripts/setup-self-host.sh mcp-stage
```

Παράγει το SDK-owned `mcp/index.ts` σε προσωρινό φάκελο `/tmp/socportal-vm-mcp-*`, με τις ρυθμίσεις του VM. Δεν το εγκαθιστά, δεν ξεκινά υπηρεσίες. Ποτέ μη χρησιμοποιείτε το Cloud-generated `supabase/functions/mcp/index.ts` από τον κώδικα χωρίς νέο VM build.

## 6. Έλεγχος του router functions πριν αντιγράψετε

Ο upstream router μπορεί να απορρίπτει όλα τα ανώνυμα requests όταν `VERIFY_JWT=true`. Το MCP χρειάζεται discovery και απάντηση 401 με `WWW-Authenticate` από το SDK, όχι το γενικό JWT gate. Απαιτείται **εξαίρεση μόνο για τη διαδρομή mcp** προς τον SDK handler, με έλεγχο OAuth από το SDK και ίδιο gate για όλες τις υπόλοιπες functions. Δεν παρέχεται αυτόματη τροποποίηση του upstream router, επειδή η έκδοση στο VM δεν έχει ελεγχθεί. Μην θέσετε συνολικά `FUNCTIONS_VERIFY_JWT=false` και μην ανοίξετε ανώνυμη πρόσβαση σε δεδομένα.

Όταν επιβεβαιωθεί ο router, αντιγράψτε το staged `mcp` directory στο `/opt/stack/supabase/volumes/functions/mcp`, επανεκκινήστε την υπηρεσία functions και ξαναχτίστε το portal. Διατηρήστε backup του προηγούμενου bundle/router για rollback.

## 7. Έλεγχος ετοιμότητας

```bash
bash scripts/setup-self-host.sh mcp-check
```

Ελέγχει health, login providers, εγγραφές, discovery, DCR, δημόσια signing keys και αν το MCP επιστρέφει 401 μαζί με resource metadata χωρίς token. Μη θεωρήσετε ότι η επιτυχία αυτών των ελέγχων αποτελεί ολοκληρωμένη OAuth δοκιμή.

## 8. Προσθήκη agent και πραγματική δοκιμή

Στον MCP client προσθέστε remote Streamable HTTP server:

```text
Name: SocPortal VM
URL: https://api.geniusnetsoc.gr/functions/v1/mcp
Authentication: OAuth
```

Ακολουθήστε τη σύνδεση Google ή Microsoft → εγκρίνετε την εφαρμογή → επιστροφή στον client. Πρέπει να εμφανιστούν 7 εργαλεία: `get_my_contracts`, `get_my_devices`, `get_my_licenses`, `get_copilot_usage`, `get_my_tickets`, `create_ticket`, `add_ticket_message`.

Πρώτα καλέστε μόνο `get_my_tickets` με `status=all` και συγκρίνετε με τα tickets του ίδιου λογαριασμού στο portal. Ελέγξτε και λογαριασμό άλλης εταιρείας: τα δεδομένα πρέπει να ακολουθούν τα υπάρχοντα δικαιώματα (ο global admin βλέπει όσα ήδη δικαιούται). Μην δημιουργήσετε ticket ή reply ως μέρος του απλού ελέγχου σύνδεσης.

Επαναλάβετε από νέο client/authorization με **Άρνηση**, άκυρο/ληγμένο authorization_id και επιστροφή από Εγγραφή. Η άρνηση δεν πρέπει να δίνει πρόσβαση και ο client πρέπει να δείχνει καθαρό σφάλμα. Μην εισάγετε στατικές session JWTs ή ιδιωτικά keys στον client.

**Εκκρεμεί:** διόρθωση 502, έλεγχος της πραγματικής έκδοσης/router/signing του VM και πραγματικό provider/agent round-trip. Χωρίς πρόσβαση διαχείρισης VM και διαδραστική έγκριση του κατόχου δεν μπορούν να επιβεβαιωθούν από το preview.