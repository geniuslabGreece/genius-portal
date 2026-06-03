# Welcome to Genisunet tech portal
. Google OAuth
1.1 Google Cloud Console
Άνοιξε console.cloud.google.com
APIs & Services → Credentials → Create Credentials → OAuth client ID
Application type: Web application
Authorized redirect URIs — προσθέτεις:

   https://tduxoophctrkrrsxwgbl.supabase.co/auth/v1/callback

Αποθήκευσε Client ID και Client Secret

1.2 Supabase Dashboard

Project tduxoophctrkrrsxwgbl → Authentication → Providers
Ενεργοποίησε Google
Βάλε:

Client ID: (από Google Console)
Client Secret: (από Google Console)
Save

1.3 Allowed Redirect URLs στο Supabase
Authentication → URL Configuration:
Site URL:
  https://geniusnetsoc.gr

Additional redirect URLs:
  http://localhost:5173/login
  http://localhost:8080/login
  https://geniusnetsoc.gr/login
  https://www.geniusnetsoc.gr/login
  https://geniusnetsoc.online/login

2. Microsoft / Azure AD OAuth
2.1 Azure App Registration

Άνοιξε portal.azure.com → Entra ID → App registrations → New registration
Όνομα: GeniusNet Customer Portal
Supported account types: Accounts in any organizational directory and personal Microsoft accounts
(για να δουλεύουν και personal accounts τύπου @outlook.com, @hotmail.com)
Redirect URI:

Platform: Web
URI: https://tduxoophctrkrrsxwgbl.supabase.co/auth/v1/callback

Register

2.2 Client Secret
App Registration → Certificates & secrets → New client secret

Description: supabase-auth
Expires: 24 months (ή ό,τι θέλεις)
Αποθήκευσε το Value (φαίνεται μόνο μία φορά!)

2.3 API Permissions (αν χρειαστεί)
Αρκούν οι default:

openid
profile
email

2.4 Supabase Dashboard

Authentication → Providers → Azure
Βάλε:

Application (client) ID: (από Azure App Registration → Overview)
Application (client) Secret: (το client secret value από βήμα 2.2)
Azure Tenant: common (για multi-tenant / personal accounts)
ή το tenant ID σου αν θέλεις μόνο corporate accounts

Save

3. Supabase Email Auth (email/password + magic link)
Ήδη ενεργό. Ρυθμίσεις:

Authentication → Email → Confirm email: ενεργό (προτείνεται)
Minimum password length: 6 (ήδη enforce-αρεται από το UI)
SMTP: Ρύθμισε custom SMTP για production (Settings → SMTP)

4. Έλεγχος μετά τη ρύθμιση
Τοπικά (dev)
bashnpm run dev
# Άνοιξε http://localhost:5173/login
Δοκίμασε:

 Login με Google → ανοίγει Google login → redirect στο /portal
 Login με Microsoft → ανοίγει MS login → redirect στο /portal
 Register με email → email επιβεβαίωσης → login
 Forgot password → email → /reset-password → νέος κωδικός

Production
bashnpm run build
# Deploy dist/ στον web server σου
Βεβαιώσου ότι:

Ο web server σερβίρει index.html για όλα τα paths (SPA routing)
Nginx: try_files $uri $uri/ /index.html;
Τα redirect URLs στο Supabase και Google/Azure περιλαμβάνουν το production domain

