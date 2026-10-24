# Google-innlogging — oppsett og verifikasjon

Status 24. oktober 2026: Google er implementert som primær innlogging i frontend på `develop`. Brukeren har nå bekreftet ekte Google-innlogging mot Supabase: Min side åpnes, kontoen har studentrolle (ikke administrator), og utlogging/ny innlogging fungerer. Dette er brukerens gjennomførte test, ikke en ny live-kjøring utført av agenten. Testadresse, mobil og offentlig Pages-origin er ikke særskilt oppgitt som verifisert. Gmail SMTP er ikke lenger primærløsningen.

Innloggingen bruker Supabase sin støttede Google OAuth-flyt. Det kreves ikke kjøp av eget domene, en SMTP-avsender, Gmail API, ekstra frontendbibliotek eller Google-passord i appen. En Google-konto må være tilgjengelig for studenten; Google-innlogging beviser ikke at studenten går på UiO. Målgruppekontroll skjer fortsatt gjennom medlemskap og grupper.

## Implementasjonen

1. «Fortsett med Google» kaller `signInWithOAuth` med `provider: google`, bare `openid email profile`, og kontovalg. Ingen offline-tilgang eller tilgang til innboks, kalender eller Drive forespørres.
2. Supabase-klienten oppretter PKCE-verifikatoren. Google-samtykke, OAuth-state og leverandørvalidering håndteres av Supabase. Retur til appen settes til `origin + pathname`, uten HashRouter-fragment. En begrenset intern retursti lagres separat i sessionStorage.
3. Google returnerer til **Supabase**, som returnerer til **frontendens rotsti med `?code=…`**. Den eksisterende callback-håndteringen fjerner koden fra adresselinjen og utveksler den én gang før HashRouter-navigasjonen fortsetter. Ingen ny callback-rute eller server på GitHub Pages trengs.
4. Appen bruker Supabase-sesjonen og leser rollen fra `public.user_roles`. Google-metadata kan ikke tildele en applikasjonsrolle. Ingen manuell sammenslåing av kontoer eller kopiering av privilegier er lagt til.

«Andre innloggingsmåter» beholder den eksisterende e-postflyten. Den er lukket som standard i produksjonsbuilden; faktisk e-postlevering er fortsatt uavklart. Utviklingspassordet beholdes bak `DEV` + `VITE_ENABLE_DEV_PASSWORD_LOGIN=true`, med åpen alternativseksjon i dette miljøet. Produksjonsbuilden viser aldri passordskjemaet.

Avbrutt samtykke, ugyldig/utløpt kode og manglende verifier gir trygg norsk feilmelding og mulighet til å prøve Google på nytt. Ingen e-post sendes som automatisk reserve. Eksisterende gyldige sesjoner slettes ikke på grunn av en dårlig callback. Det opprettes ikke ekstra lagring av Google provider-tokens; eventuell provider-informasjon i SDK-sesjonen behandles som autentiseringsdata, ikke som tilgang til andre Google-tjenester.

Kilder: [Supabase Google-oppsett](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [SDK-metoden](https://supabase.com/docs/reference/javascript/auth-signinwithoauth), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow). Google-knappens uendrede G-asset er hentet fra [Googles merkevareveiledning](https://developers.google.com/identity/branding-guidelines) og leveres lokalt fra frontend-bundlen.

## Adressene må ikke blandes

| Hvor | Felt | Eksakt verdi |
| --- | --- | --- |
| Google Cloud, utviklingsklient | Authorized redirect URI | `https://gawhbppuhnixqvhnnpnn.supabase.co/auth/v1/callback` |
| Google Cloud | Authorized JavaScript origin, lokalt | `http://127.0.0.1:5173` |
| Google Cloud | Authorized JavaScript origin, senere Pages | `https://jya2002.github.io` |
| Supabase, utvikling | Tillatt redirect | `http://127.0.0.1:5173/` |
| Supabase, eventuell lokal Pages-prøve | Tillatt redirect | `http://127.0.0.1:4173/pluss-minus-null-stress/` |
| Supabase, senere godkjent offentlig bruk | Site URL og tillatt redirect | `https://jya2002.github.io/pluss-minus-null-stress/` |

Origins har ikke repo-sti eller avsluttende skråstrek. Supabase-redirectene har repo-sti der det er relevant, og avsluttende skråstrek. `#/logg-inn`, `#/min-side` og `/auth/callback` på frontend skal **ikke** registreres som Google redirect URI. Bruk eksakte adresser uten wildcard. `localhost` og `127.0.0.1` er ulike origins; denne oppskriften bruker sistnevnte.

Den lokale frontendens backend er fortsatt det hostede utviklingsprosjektet. Bruk derfor den hostede Supabase-callbacken også når frontend kjører lokalt. `http://127.0.0.1:54321/auth/v1/callback` gjelder bare en egen lokal Supabase-stack, som ikke brukes i denne oppskriften. Et senere annet Supabase-prosjekt må få sin egen callback/klientkonfigurasjon.

## Manuelt Google Cloud-oppsett

Disse stegene endrer ekstern konfigurasjon og skal utføres etter din godkjenning. Det er ikke nødvendig å aktivere betalte API-er eller opprette en service account for denne innloggingen.

1. Åpne [Google Cloud Console](https://console.cloud.google.com/), velg/opprett et avtalt utviklingsprosjekt som foreningen kan forvalte. Bruk **Google Auth Platform** (kan ligge under APIs & Services > OAuth consent screen i andre konsollvisninger).
2. Fyll ut **Branding** med `Pluss Minus Null Stress`, en reell kontakt-/supportadresse og ansvarlig utviklerkontakt. Ikke bruk oppdiktet kontaktinformasjon. Ved senere publisering må forsiden og den vedtatte personvernerklæringen være tilgjengelige på Pages-adressen. Nåværende personverntekst er fortsatt et utkast.
3. Velg **Audience: External**, siden private Google-kontoer skal kunne brukes. `Internal` er bare for kontoer i en bestemt Google Workspace-organisasjon, ikke generelt for UiO-studenter. Start med Testing og avtal kontrollerte testkontoer.
4. Under **Data Access**, velg bare `openid`, `…/auth/userinfo.email` og `…/auth/userinfo.profile` (konsollen kan vise de to siste som fulle `https://www.googleapis.com/auth/…`-adresser). Ikke legg til sensitive/restricted scopes eller Gmail-/Drive-/Calendar-tilgang.
5. Under **Clients > Create client**, velg **Web application**. Registrer JavaScript-origin og Supabase redirect URI fra tabellen. Hvis lokal produksjonsbuild på port 4173 skal prøves, legg også til origin `http://127.0.0.1:4173`.
6. Ta vare på **Client ID** og **Client Secret** i et sikkert administrativt verktøy. Secret skal bare kopieres til Supabase-providerens innstillinger. Ikke legg en nedlastet `client_secret*.json` i repoet; dette filnavnet er nå også Git-ignorert.

Google beskriver normalt opptil 100 testbrukere og sju dagers autorisasjon i Testing, men har et uttrykkelig unntak for bare grunnleggende navn/e-post/profil-scopes: testbrukerlisten og denne utløpsregelen er da ikke en sikker tilgangssperre. Ikke lov at Testing alene gir en lukket studentpilot. Google-/Workspace-kontopolicyer kan likevel avvise innlogging. Se [Google Audience](https://support.google.com/cloud/answer/15549945?hl=en).

Vanlig innlogging med disse grunnleggende scopene skal ikke forveksles med godkjenning av sensitive Google API-tilganger eller av foreningens merkevare. Før offentlig bruk må faktiske konsollkrav vurderes. Hvis Google krever domeneverifisering/brand verification, gjennomgå kravet konkret; ikke oppgi at dere eier `github.io` eller `supabase.co`, og ikke kjøp et domene automatisk. Standard Supabase-hosting fungerer som callback uten et kjøpt custom domain. Google kan vise Supabase-prosjektets domenenavn i innloggingsdialogen. Se [produksjonspolicy](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance) og [verifikasjonskrav](https://support.google.com/cloud/answer/13464321?hl=en).

## Manuelt Supabase-oppsett

1. Velg **utviklingsprosjekt `gawhbppuhnixqvhnnpnn`** i Dashboard.
2. Åpne **Authentication > Sign In / Providers > Google**. Sammenlign callbacken som Dashboard viser med tabellen.
3. Legg inn riktig web-Client ID og Client Secret og aktiver Google først etter godkjenning. Behold sikre standardinnstillinger; ikke aktiver «Skip nonce checks», tillat konto uten e-post eller senk e-postbekreftelsen for andre innloggingsmetoder.
4. Under **Authentication > URL Configuration**, behold lokal Site URL under utvikling og registrer de eksakte lokale redirectene som faktisk brukes. Ikke bytt til den offentlige Site URL eller endre produksjonsprosjektet nå.
5. Behold eksisterende signup-innstilling, signup-trigger, `user_roles`, RLS og grants. Ikke legg rolle i Google-metadata eller opprett en automatisk adminregel basert på e-postdomene.

Frontend trenger fortsatt bare `VITE_SUPABASE_URL` og `VITE_SUPABASE_PUBLISHABLE_KEY`; ingen `VITE_GOOGLE_CLIENT_SECRET` eller ny Google-variabel. Build-valideringen avviser også kjennelige `GOCSPX-`-secrets i alle `VITE_`-verdier. Rotasjon av Google Client Secret skjer bare hos Google og Supabase, ikke i klientkoden.

Nye `auth.users`-rader utløser eksisterende `private.on_signup()`: profil, studentrolle og varslingspreferanser opprettes; medlemskap og administratorrolle opprettes ikke. Supabase kan koble en Google-identitet til en eksisterende konto med samme verifiserte e-post. Da er det samme eksisterende bruker-ID og dens allerede tildelte rolle som gjelder; en betrodd styrekonto mister ikke rollen ved bytte av innloggingsmetode. Appen tilbyr ingen egen manuell kontokobling. Se [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## Testresultater og avgrensninger

| Kontroll | Resultat | Hva som faktisk er testet |
| --- | --- | --- |
| TypeScript strict, lint og Pages-produksjonsbuild | Bestått | Lokal kode med fiktiv offentlig testkonfigurasjon |
| Auth Vitest | 31 ulike tester bestått | Google-start, minste scopes/rot-redirect, ekstern retursti, dobbeltklikk/feil, eksisterende passord/e-post, callback og AuthProvider; simulerte svar |
| Frontend-konfigurasjon | 4/4 bestått | Blant annet avvisning av Google client-secret i offentlig miljøvariabel |
| PostgreSQL `--google-auth` | 6/6 bestått | Migrasjoner i egen midlertidig lokal database, faktisk signup-trigger/defaultrolle, metadata-spoofing, medlemskap og RLS; minimale Auth/Storage-shims |
| Google/callback Playwright, dev | 12/12 bestått | Desktop + mobil; simulerte Google-redirects og Supabase-utvekslinger, avbrudd/ugyldig kode og gamle e-post-callbacks |
| Tastatur/axe/layout | 2/2 bestått | Google-knapp og login-side på desktop + mobil |
| Eksisterende student-/adminflyt | 4/4 bestått | Fortsatt passordinnlogging, arrangement, venteliste/opprykk og redigering; simulerte API-er |
| Pages Playwright | 10/10 bestått | Produksjonsbuild med repo-sti; Google, e-post og ruting på desktop + mobil |
| Ekte Google/Supabase OAuth | Bestått, rapportert av brukeren 24. oktober | Innlogging, Min side, studentrolle uten admin, utlogging og ny innlogging. Ikke uavhengig gjentatt av agenten; øvrige live-scenarier/offentlig Pages-origin er ikke bekreftet |

Ingen offentlig eller ekstern tjeneste kontaktes av browser-testene. De avskjærer også selve provider-redirecten. Metadata med `role: admin` i den simulerte Google-brukeren gir ikke styretilgang i UI. Dette erstatter ikke en faktisk Google-utstedt sesjon. Databasetesten kontrollerer SQL-logikken, ikke Google eller Supabase sin virkelige kontokobling.

En ny tilgjengelighetstest fant at en eksisterende generell knapperegel overstyrte Google-knappens hvite bakgrunn. CSS-spesifisiteten er rettet; kontrasttestene består. Den første enhetstesten forventet at e-postalternativet var fjernet fra DOM, mens det med hensikt bare er lukket; testen er rettet. Pages-port 4173 var opptatt under kjøring; en alternativ lokal testport kan velges uten å stoppe en eksisterende server.

### Reprodusere de relevante lokale testene

```powershell
npx vitest run src/pages/Auth.test.tsx src/lib/auth-callback.test.ts src/lib/auth.test.tsx
node --test tests/scripts/frontend-config.test.mjs
# Krever lokal PostgreSQL. Runneren avviser remote host og lager bare sin egen testdatabase:
npm run test:db -- --google-auth
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e -- --config playwright.ui.config.ts tests/ui/google-auth.spec.ts tests/ui/auth-callback.spec.ts tests/ui/workflows.spec.ts
```

Pages-testene krever en build med `/pluss-minus-null-stress/`, fiktiv backend `https://pmns-ui.supabase.co`, offentlig testnøkkel `sb_publishable_ui_test` og demo av, som i CI. Sett eventuelt `PLAYWRIGHT_PAGES_PORT=4184` dersom 4173 er opptatt. Kjør deretter `npm run test:pages`. Testene endrer ikke Auth-innstillinger eller live-data. Portvalget for offline tester endrer ingen Supabase-redirectliste.

## Videre verifikasjon etter brukerens reelle prøve

Grunnflyten er nå bekreftet av brukeren. Oppsetts- og førstegangsinnloggingspunktene nedenfor er historisk fremgangsmåte eller gjelder nye miljøer; de skal ikke utføres på nytt uten behov. Ikke gjenta bestått innlogging bare for denne dokumentoppdateringen. Neste prioritet er [account-delete](ACCOUNT_DELETE.md).

- Du godkjenner og utfører Google Cloud-/Supabase-provideroppsettet ovenfor. Ingen domene- eller SMTP-kjøp inngår.
- Avtal kontrollert Google-testkonto og godkjenn reell innlogging. Første Google-innlogging kan opprette en studentkonto eller koble en ny identitet til en eksisterende konto; det er en ekstern dataendring. Ingen automatisk sletting av eksisterende kontoer inngår.
- Test lokalt: Google-knapp, samtykke, retur til ønsket side, Min side, medlemskap, avvist styretilgang, utlogging og nytt innloggingsforsøk. Avbryt også hos Google og kontroller trygg retur. Ikke lagre tokens eller Google-passord i testlogger; bruk ikke trace/video ved en senere live-browserprøve.
- Etter separat godkjent offentlig deploy: prøv den faktiske Pages-adressen og mobilnettleser. Eksisterende styrekonto må fortsatt ha riktig rolle. Kontroller samme verifiserte e-post ved eventuell kontokobling; ikke opprett en ekstra adminrolle som en snarvei.
- Kontosletting og øvrige P0-punkter i [PRELAUNCH_REVIEW.md](PRELAUNCH_REVIEW.md) gjelder fortsatt. Google fjerner SMTP-avhengigheten for innlogging, men aktiverer ikke arrangementsmailer eller slettefunksjonen.

Ingen live-prøve, Cloud-konfigurasjon, Supabase-endring, push, merge eller deploy startes av disse dokumenterte stegene automatisk.
