# Før ekte integrasjonstest

Brukeren har nå rapportert at alle åtte ekte Supabase-API-tester bestod og at testdataene ble ryddet. **Ekte nettlesertest er ikke kjørt**; den er klargjort med separat godkjenningsomfang i [BROWSER_TESTS.md](BROWSER_TESTS.md). Ti Playwright-tester med simulerte API-svar bestod på desktop og mobil.

Brukeren har også kjørt migrasjon `202610230006_registration_deadline.sql` i utviklingsprosjektet og oppgitt at alle boolske felt fra den lesende `registration-readiness.sql`-kontrollen er `true`. Det bekrefter at de aktive funksjonsdefinisjonene matcher migrasjonen, at funksjonsrettigheter og relevant RLS er forventet, og at ingen kjente PMNS-cronjobber var aktive ved kontrollen. Kilden er brukerens resultat fra SQL Editor; agenten har ikke kjørt spørringen direkte mot Supabase. Ingen nye RPC-er, migrasjoner eller rettigheter er opprettet der under nettleserarbeidet.

## 1. Bekreft migrasjonen uten testdata

Velg prosjekt `gawhbppuhnixqvhnnpnn`, åpne SQL Editor og kjør hele [registration-readiness.sql](../supabase/checks/registration-readiness.sql). Den kjører i en lesende transaksjon og avslutter med rollback. Den gjør ingen innlogging, påmelding, DDL eller jobbaktivering.

Forvent:

- To funksjonsrader der `function_exists`, `migration_body_matches`, `security_definer`, `search_path_locked` og `permissions_expected` er `true`.
- Én rad der `relevant_rls_enabled` og `known_pmns_jobs_inactive` er `true`.

Funksjonskroppene sammenlignes med fingeravtrykk av migrasjonsfilen; linjeskift og mellomrom normaliseres. Ved `false` skal testen vente på gjennomgang, ikke omgå kontrollen. Kjøringshistorikk i SQL Editor er ikke alene bevis for at de aktuelle funksjonsdefinisjonene fortsatt er aktive.

Jobbkontrollen omfatter kjente PMNS-jobber i pg_cron, dersom utvidelsen finnes. Den kan ikke oppdage en ekstern tjeneste som kaller en worker. Ingen worker eller automatiske e-postjobber skal startes. Ingen nøkler, brukere, funksjonskropper eller jobbkommandoer vises i resultatet.

Kontrollfilen er også verifisert i en midlertidig lokal PostgreSQL-database. Den eksterne bekreftelsen er brukerens påfølgende resultat fra SQL Editor, beskrevet øverst. Kontrollen trenger ikke gjentas nå.

## 2. Sikkerhetsgjennomgang av skriptet

`scripts/test-registration-live.mjs` og `scripts/registration-live-safety.mjs` har disse kontrollene:

- Bare `https://gawhbppuhnixqvhnnpnn.supabase.co` godtas. Undersider, andre prosjekter, HTTP, andre porter og query-parametre som prosjektadresse avvises. Nettverkstransporten avviser også andre origins og HTTP-videresendinger.
- `--plan` og kjøring uten `--allow-development-writes` gjør ingen nettverkskall. Flagget skal bare brukes etter separat godkjenning fra brukeren. Testen finnes ikke i CI eller standardtestkommandoene.
- Klientnøkkelen må være publishable eller en legacy anon-nøkkel for riktig prosjekt. En secret/service_role-nøkkel i klientfeltet avvises, slik at en feilkonfigurert klient ikke gir falske RLS-testresultater.
- En separat Node-klient med servernøkkel brukes til egne testkontoer og opprydding. Alle elev-/styre-/administratortester bruker den offentlige nøkkelen og ekte passordøkter.
- Testkontoer opprettes med individuelle tilfeldige passord og bekreftes administrativt. De fem adressene er unike Gmail-plussaliaser under én adresse brukeren kontrollerer. Hovedadressen opprettes aldri som testkonto. Ingen OTP, invitasjon eller endring av prosjektets globale bekreftelseskrav brukes. Bare disse kontoenes e-postpreferanser slås av før påmelding.
- Ingen worker, cron-jobb, e-postleverandør eller produksjonsdeploy kalles. Påmelding oppretter in-app-varsler og køposter; testkontoenes preferanser hindrer levering gjennom den implementerte workeren. Automatiske jobber skal uansett forbli inaktive.
- Ingen passord, nøkkel, access token, session-objekt eller rå API-respons logges. HTTP-forespørsler har tidsgrense. Testen avventer samtidige forespørsler før den begynner opprydding.

En servernøkkel har fortsatt brede rettigheter og omgår RLS. Den kan ikke beskrives som teknisk begrenset til testdata av Supabase. Avgrensningen ligger i skriptets prosjekt-, ID- og eierskapskontroller. En dedikert utviklingsnøkkel gir separat rotasjon, men færre databaseprivilegier oppnås ikke ved bare å gi nøkkelen et annet navn.

## 3. Hva kan slettes?

Det finnes ingen generell sletting av kontoer, tabeller eller revisjonslogger. Alle test-ID-er genereres av denne kjøringen. Et arrangement slettes bare hvis ID, hele kjørings-ID-en i tittelen, `is_demo=true` og den verifiserte testoppretteren stemmer. Disse betingelsene gjentas i selve DELETE-forespørselen.

En bruker må i tillegg ha riktig ID, eksakt test-e-post og administrativt kjøringsmerke i `app_metadata`. Aliaset må kunne gjenskapes fra den registrerte hovedadressen, kjørings-ID-en og en av de fem tillatte testrollene. Hovedadressen og uvedkommende aliaser avvises før API-tilgang. Dersom en konto ikke kan verifiseres, slettes den ikke. Ved uverifiserte eller gjenværende testarrangementer utføres ingen kaskadesletting av testkontoene. En konto som fremdeles står som oppretter av et annet arrangement beholdes også.

Eksisterende kontoer eller arrangementer inngår ikke i slettemålene. Fremmednøklene rydder tilhørende testpåmeldinger, varsler og køposter når verifiserte testdata slettes. Revisjonslogger beholdes; slettede testaktører anonymiseres av eksisterende fremmednøkkelregel. Det er ingen endring av RLS eller prosjektets ordinære brukere.

## 4. Opprydding ved feil og avbrudd

Skriptet kjører opprydding i `finally`. Feil på én forespørsel hindrer ikke kontroll av de andre testarrangementene. Usikre treff beholdes og rapporteres, og testen avsluttes med feilstatus ved ufullstendig opprydding.

En oversikt skrives atomisk til `.runtime/registration-live/<kjørings-ID>.json` før hver opprettelse. Den inneholder prosjekt, test-ID-er, e-postens hovedadresse og testaliaser, testetiketter og oppryddingsstatus, men ingen passord, nøkler eller token. Mappen er Git-ignorert. `SIGINT`/`SIGTERM` avbryter testforespørslene og lar `finally` bruke en separat klient til opprydding.

Hard prosessavslutning, maskinstans eller nettverksbrudd kan fortsatt etterlate testdata. Da brukes oversikten til å gjennomgå bare denne kjøringens data i Dashboard. Det er ingen automatisk massesletting eller opprydding av eldre kjøringer.

## 5. Miljøvariabler

Velg først **utviklingsprosjektet** `gawhbppuhnixqvhnnpnn` i Dashboard.

| Variabel                        | Lokal fil                       | Hvor verdien finnes                                                                                                                                                                                      |
| ------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | `.env` — allerede konfigurert   | Project Connect-dialogen. Forvent `https://gawhbppuhnixqvhnnpnn.supabase.co`, uten `/rest/v1`.                                                                                                           |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` — allerede konfigurert   | Connect eller Settings → API Keys → publishable key. Legacy anon støttes også.                                                                                                                           |
| `PMNS_TEST_SERVICE_ROLE_KEY`    | `.env.registration-tests.local` | Settings → API Keys → Secret keys, `sb_secret_…`. Legacy `service_role` finnes under legacy-nøklene og støttes også. Aldri bruk denne som `VITE_…`.                                                      |
| `PMNS_TEST_EMAIL_BASE`          | `.env.registration-tests.local` | Din faktiske private `@gmail.com`-adresse, uten `+tagg`. Du må kontrollere denne innboksen. Det kreves ikke eget domene. |

En tom mal er opprettet lokalt i `.env.registration-tests.local`. Filen leses av Node-testen via Vites `registration-tests`-miljø, og brukes ikke av vanlig frontend-bygg. Passord og token genereres i minnet; de trenger ingen miljøvariabel. Det kreves ingen Supabase Management API-token eller databasepassord til selve live-testen.

### Anbefalt løsning: én Gmail-adresse med plussaliaser

Google dokumenterer at `+tagg` etter Gmail-brukernavnet går til samme innboks. Ingen egen Gmail-innstilling eller ny e-postkonto trengs. Kilden er [Gmail Help: Use Gmail aliases](https://support.google.com/mail/answer/22370?hl=en#zippy=%2Cfilter-using-your-gmail-alias).

Sett bare din egen, eksisterende Gmail-adresse i `PMNS_TEST_EMAIL_BASE`. Ikke oppgi Gmail-passordet, og ikke lim inn et eksempel eller en annens adresse. Ingen adresse er forhåndsutfylt. Andre e-postleverandører, plassholderdomener og en base som allerede inneholder `+tagg` avvises; skriptet antar ikke at andre leverandører støtter plussaliaser.

Skriptet lager fem forskjellige aliaser etter mønsteret `<ditt-brukernavn>+pmns-<kjøringskode>-a@gmail.com`, med sluttetikettene `a`, `b`, `c`, `board` og `admin`. Mønsteret er en forklaring, ikke en adresse som kan brukes direkte. Brukernavnet beholdes uendret. Kjøringskoden er avledet fra en ny tilfeldig UUID for hver kjøring og begrenses i lengde slik at også lange Gmail-brukernavn får gyldig adresselengde. Full UUID lagres fortsatt i de administrative eierskapsmerkene.

Dette gir fem separate Supabase-testkontoer i API-testen som bruker samme kontrollerte innboks. Den nye nettlesertesten trenger tre kontoer. `createUser({ email_confirm: true })` og tilfeldige passord beholdes; det sendes ingen OTP, invitasjon eller bekreftelsesmail. E-postpreferansene for testkontoene slås av før påmelding. Brukeren har rapportert at API-testen med aliaser bestod. Dersom en senere kjøring avvises, stopper testen uten å falle tilbake til hovedadressen.

Den gamle `PMNS_TEST_EMAIL_DOMAIN` brukes ikke lenger og kan fjernes. Det er ingen grunn til å kjøpe domene eller SMTP-tjeneste. Den lokale konfigurasjonsfilen er oppdatert med et tomt `PMNS_TEST_EMAIL_BASE`-felt; øvrige verdier er bevart.

Behold nøklene lokalt; ikke send dem i chat. Git-ignorering er kontrollert. Bruk bare nøkkel fra utviklingsprosjektet, og ikke endre produksjonsinnstillinger.

Se [Supabase: API keys](https://supabase.com/docs/guides/getting-started/api-keys) for Dashboard-plassering og rettigheter, og [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) for administrativ bekreftelse av testkontoene.

## 6. Lokale kontroller i denne gjennomgangen

- Tretten sikkerhetstester med simulerte klienter bestod, inkludert Gmail-validering, fem unike aliaser, adressegrenser, avvisning av hovedadresse/uvedkommende aliaser ved opprydding og alle tidligere prosjekt-/eierskapskontroller.
- Den lesende SQL-kontrollen bestod mot de faktiske migrasjonene i en midlertidig lokal database.
- Brukeren bekreftet deretter at alle boolske felt er `true` fra SQL Editor i utviklingsprosjektet.
- Målrettet ESLint og Node-syntakskontroll bestod. Ingen frontend- eller TypeScript-kode er endret i denne gjennomgangen.
- Ingen live-integrasjonstest eller skriving til Supabase ble utført.

Den lesende Supabase-kontrollen er gjennomgått og bestått, og brukeren har rapportert fullført API-test med opprydding. Neste trinn er separat godkjenning av nettlesertestens tre midlertidige brukere, to arrangementer og opprydding; se [BROWSER_TESTS.md](BROWSER_TESTS.md). Eksisterende miljøvariabler gjenbrukes. Ingen ny live-kjøring skal utføres før den nye godkjenningen foreligger.
