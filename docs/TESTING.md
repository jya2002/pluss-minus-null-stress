# Tester og bevis

Nyeste kontrollrunde: [medlemskap, forslag, avstemninger og mobil](COMMUNITY_TESTS.md). Kjør `npm run test:db -- --community` for 35 lokale databasekontroller. UI-konfigurasjonen omfatter nå 22 tester på desktop og mobil. De nye ekte community-API-testene er klargjort bak separat godkjenning og inngår ikke i standardtester eller CI. Tall og gjenstående live-kontroller lenger nede er eldre kontrollomfang.

Kjør fra prosjektroten med Node 24. Ikke bruk produksjonskontoer eller produksjonsdata som testfixtures. Status og konkrete kjøringer finnes i [VERIFICATION.md](VERIFICATION.md).

## Typer, lint og enhetstester

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Vitest kjører i eksplisitt testmodus uten Supabase-nettverk selv om `.env` finnes. Tolv tester dekker skjemaer, Oslo-tid og DST, CSV-formelsikring, forside, søk, utkastbegrensning og demo-admintilgang. Auth-skjemaet testes, men dette er ikke en leveringstest av innloggingsmail eller en live Auth-integrasjonstest.

## PostgreSQL-integrasjon og samtidighet

For målrettet påmelding/venteliste, kjør `npm run test:db -- --registration`. De 19 kontrollene og den separate, godkjenningskrevende Supabase-testen er beskrevet i [REGISTRATION_TESTS.md](REGISTRATION_TESTS.md). Der finnes også fristrettingen som ble funnet ved låseventing.

Start en isolert PostgreSQL-instans med en lokal administrativ testforbindelse. Standard er `postgresql://postgres@127.0.0.1:55439/postgres`. Alternativt:

```sh
TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:5432/postgres npm run test:db
```

PowerShell:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:local-test-only@127.0.0.1:5432/postgres'
npm run test:db
```

Runneren oppretter en tilfeldig, egen `pmns_test_<uuid>`-database, anvender migrasjonene i transaksjoner og bruker ekte PostgreSQL-roller/forbindelser. Den rydder bare opp databasen den selv opprettet, med navnevalidering. Bruk aldri en administrativ produksjonsforbindelse til dette skriptet. Testidentitetene bruker bare `example.test`-adresser.

Auth-grensesnittet `auth.uid()` og Storage-tabellene er minimale testgrensesnitt, ikke en komplett Supabase-emulator. PostgreSQL-låser, RLS, SQL-funksjoner, constraints, triggers og transaksjoner er reelle. Samtidighetstesten åpner 20 faktiske klientforbindelser og forventer nøyaktig fire bekreftede påmeldinger og seksten ventelisteplasser.

De 39 kontrollene dekker migrasjoner, signup-trigger, student-/styre-/administratorrestriksjoner, utkast, anonym tilgang, duplikater, kapasitetsomgåelse, private registreringer, FIFO-opprykk, kapasitet, lag, anonymt forslag, forslagsstemmer, input, moderering, poll-unikhet, skjulte resultater, pollstenging, separat medlemskap, medlems-/gruppebegrensning, roller, profilisolasjon, kostsamtykke, stengt venteliste, fremtidig poll, feil pollvalg, Storage-eierskap, retensjon, eksport, varsler, outbox-tilgang og kontosletting.

## Nettlesertester

Påmeldingsflyten og administrasjon testes også med `npm run test:e2e -- --config playwright.ui.config.ts`. Ti målrettede desktop-/mobiltester bestod med simulerte API-svar. Se [BROWSER_TESTS.md](BROWSER_TESTS.md) for dekning, gjenstående ekte nettleserintegrasjon og separat godkjenningskrav til testdata.

```sh
npx playwright install chromium
npm run test:e2e
```

På denne Windows-maskinen ble installert Chrome brukt:

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

Testene starter en egen Vite-server med **eksplisitt demomodus**, slik at `.env` ikke sender testhandlinger til utviklingsprosjektet. De kontrollerer desktop og mobil, forside, arrangementssøk, kalender, utkast, beskyttet adminside, forslagdialog, tastaturfokus, skip-lenke og vannrett overflow.

Axe kontrollerer fem offentlige sider per enhet for WCAG A/AA-regler. Skjermbilder lagres i ignorert `test-results/`. Dette er automatisert hjelp, ikke komplett WCAG-sertifisering. Manuell skjermleser, zoom, ekte iOS/Android og autentiserte skjemaer gjenstår som lanseringskontroll.

## Målrettet regresjonstest for arrangementsskjemaet

```sh
npm run test:e2e -- --config playwright.ui.config.ts
```

På Windows med installert Chrome: sett `$env:PLAYWRIGHT_CHANNEL='chrome'` først.
Denne kjøringen starter en isolert server på port 5177 med et fiktivt Supabase-prosjekt og simulerte API-svar. Den bruker ingen ekte testkontoer eller databaseendringer. Seks kontroller på desktop og mobil er bestått: skriving og ekte innliming i «Sted» beholder tidligere feltverdier; tekstmarkering som slutter i dialogens innvendige luft lukker ikke skjemaet; lukkeknapp, Escape og faktisk bakteppe fungerer fortsatt. Før rettingen feilet tekstmarkeringstesten fordi dialogen ble avmontert.

## Full Auth-/student-/styreflyt

`tests/e2e/backend.spec.ts` er skrevet for en **komplett lokal Supabase-stack**, aldri en fjernproduksjon. Installer Docker og Supabase CLI, start stacken og anvend migrasjonene der. Ikke kjør `supabase db reset` på et prosjekt med data dere trenger; sett opp en separat lokal teststack.

Sett bare i prosessmiljøet:

```text
E2E_SUPABASE_URL=http://127.0.0.1:54321
E2E_SUPABASE_PUBLISHABLE_KEY=<local anon/public key>
E2E_SUPABASE_SERVICE_ROLE_KEY=<local test server key>
```

Denne service-nøkkelen brukes bare av Playwrights Node-testprosess; den heter aldri `VITE_` og sendes ikke til nettleseren. E2E godtar bare localhost/127.0.0.1 som backend. Når disse variablene er satt, kjører konfigurasjonen bare backend-suiten og kobler Vite til den lokale stacken. Standardkjøringen hopper eksplisitt over disse to desktop-/mobiltestene.

Backend-suiten bruker ekte OTP-innlogging via UI og Supabase-adminens genererte engangskode. Den tester opprettelse av konto, påmelding, forslag, torsdagsstemme, styrets opprettelse av utkast, oppmøteregistrering og avbestilling. Den oppretter unike testkontoer og rydder sine egne fixtures. Testen er ikke bevis på SMTP-levering; den henter koden fra testadmin-API-et.

Docker/full Supabase var ikke tilgjengelig i den første lokale arbeidsøkten. Disse testene er derfor **ikke rapportert som bestått**. Utviklingsprosjektets brukerflyter kan også verifiseres manuelt etter Dashboard-oppsett uten å gi agenten serverhemmeligheter.

## Edge Functions

```sh
deno check --no-lock supabase/functions/account-delete/index.ts supabase/functions/image-upload/index.ts supabase/functions/notifications/index.ts
```

Deno-typekontroll er kjørt lokalt. Den beviser ikke at funksjonene er deployet eller virker mot ekte Storage, Auth, Resend og scheduler. Test følgende i utviklingsprosjektet: ingen token, utløpt token, student mot styreopplasting, feil origin, feil worker-secret, stor fil, feil filtype, faktisk bilde, profil-/kontosletting, utgående kø, preferanser og provider-feil.

## Pages-base

Bygg med `VITE_BASE_PATH=/pluss-minus-null-stress/`, og kjør `npm run test:pages`. En egen Playwright-test starter lokal preview og kontrollerer assets med HTTP 200, direkte `#/arrangementer`-lenke, omlasting og navigasjon under repo-stien. Denne testen er bestått lokalt. En lokal test er ikke bevis på at Pages er deployet. Ingen offentlig publisering er utført.
