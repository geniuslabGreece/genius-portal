# Διόρθωση self-hosted migrations και Gemini provider

## Αλλαγές

1. **Αξιόπιστα migrations σε νέο VM**
   - Προσθήκη script που εκτελεί κάθε SQL migration απευθείας μέσα στο container της PostgreSQL.
   - Δεν θα χρησιμοποιεί το host `127.0.0.1:5432`, ώστε να αποφεύγεται ο Supavisor pooler και το σφάλμα `ENOIDENTIFIER / no tenant identifier provided`.
   - Θα σταματά αμέσως στο πρώτο SQL error και θα εμφανίζει ποιο migration απέτυχε.

2. **Διόρθωση οδηγιών εγκατάστασης**
   - Αντικατάσταση των λανθασμένων εντολών `psql -h 127.0.0.1 -p 5432` με το νέο script / `docker exec`.
   - Σαφής διάκριση μεταξύ database container, API gateway και pooler.
   - Προσθήκη ελέγχων μετά το migration και troubleshooting για το συγκεκριμένο μήνυμα σφάλματος.

3. **Gemini API στο AI panel**
   - Έτοιμη επιλογή για Google Gemini API με το συμβατό OpenAI endpoint της Google.
   - Αυτόματη μετατροπή model id από `google/gemini-…` σε `gemini-…` όταν χρησιμοποιείται απευθείας Gemini endpoint.
   - Καθαρότερες οδηγίες στο panel για OpenAI, Gemini και custom OpenAI-compatible providers.
   - Το API key θα συνεχίσει να εισάγεται από τον admin χωρίς να ενσωματώνεται στον frontend κώδικα.

## Σημαντική διευκρίνιση

- Η συνδρομή **Gemini Advanced / Google One AI Premium** δεν περιλαμβάνει αυτόματα Gemini API credits. Χρειάζεται ξεχωριστό Gemini API key από Google AI Studio ή Google Cloud και ενδέχεται να απαιτείται ενεργό API billing.
- Η συνδρομή **Microsoft 365 Copilot** χρησιμοποιείται για τα Copilot reports/usage του portal, αλλά δεν δίνει γενικό LLM API key. Για μοντέλα Microsoft απαιτείται ξεχωριστό Azure OpenAI resource/key και ειδική ρύθμιση endpoint/deployment.

## Έλεγχος

- Shell validation του migration script.
- Επιλεκτικά tests για την κανονικοποίηση OpenAI/Gemini model ids.
- Έλεγχος ότι οι οδηγίες νέου VM δεν παραπέμπουν πλέον στη θύρα του pooler για migrations.
