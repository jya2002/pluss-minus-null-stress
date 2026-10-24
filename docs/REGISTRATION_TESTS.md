# Påmelding og venteliste: testresultater 23. oktober 2026

De kritiske SQL-flytene er testet lokalt. Brukeren har deretter rapportert at alle åtte ekte Supabase-API-tester bestod og at testdataene ble ryddet. Ti desktop-/mobiltester med simulerte API-svar er nå også bestått. Ekte autentisert nettleserintegrasjon er klargjort, men avventer separat godkjenning. Se [BROWSER_TESTS.md](BROWSER_TESTS.md). Agenten har ikke opprettet nye Supabase-fixtures i nettleserarbeidet.

| Kontroll                                                    | Resultat                          | Testgrunnlag                                                            |
| ----------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| Kapasitet 1, venteliste aktiv                               | Bestått                           | Egen midlertidig PostgreSQL-database                                    |
| Student A får `confirmed`                                   | Bestått                           | Faktisk RPC-funksjon og lagret rad                                      |
| Student B får `waitlisted`                                  | Bestått                           | Faktisk RPC-funksjon og lagret rad                                      |
| A avbestiller, B får automatisk `confirmed`                 | Bestått                           | Transaksjon, FIFO og én opprykksnotifikasjon                            |
| Duplikater, også samtidige forespørsler                     | Bestått                           | SQL-feil `23505`, én aktiv rad                                          |
| Student kan ikke melde på/av andre                          | Bestått                           | Avvist falsk brukerparameter, rå insert/update/delete og avbestilling   |
| Påmelding etter fristen                                     | Bestått etter retting             | Også forespørsel som må vente på arrangementsradens lås                 |
| Kapasitet ved samtidighet                                   | Bestått                           | 20 separate forbindelser, kapasitet 1: én bekreftet og 19 på venteliste |
| Samtidig avbestilling og ny påmelding                       | Bestått                           | Ventelisten beholder prioritet                                          |
| RLS, student/styre/admin/anonym                             | Bestått lokalt                    | Reelle databaseprivilegier og RLS; simulerte Auth-identiteter           |
| Påmeldingsskjema: status, feil, duplikatsperre og samtykke  | 6 bestått                         | React-komponenter, simulerte API-svar                                   |
| Innlogging og øvrig validering                              | 17 bestått                        | Vitest; Auth-svar simuleres, øvrige tester er rene funksjonstester      |
| Eksisterende SQL-funksjoner inkludert lag og medlemsgrenser | 39 bestått                        | Kjørt igjen fordi migrasjonen erstatter funksjonene                     |
| Ny målrettet databasesuite                                  | 19 bestått                        | Faktisk PostgreSQL med minimale Auth-/Storage-grensesnitt               |
| Ekte Supabase-påmelding og venteliste via API               | 8 bestått, rapportert av brukeren | Opprydding også bekreftet av brukeren                                   |
| Ekte Supabase i nettleseren                                 | Ikke kjørt                        | Én desktop-test klargjort; ny godkjenning kreves                        |

TypeScript strict og full ESLint-kontroll bestod også. Testene som er oppgitt som bestått, er faktisk kjørt. Den separate Supabase-testens syntaks, lint, forhåndsvisning og sperre uten godkjenning er kontrollert; testens API-flyt er ikke kjørt. Utviklingsprosjektets URL matcher forventet prosjekt. Live-kjøring avventer fortsatt lokal konfigurasjon og egen godkjenning. Skriptet bruker nå plussaliaser fra brukerens private Gmail-adresse; tretten lokale sikkerhetstester bestod etter denne endringen.

## Feilen som ble funnet

Før rettingen feilet regresjonstesten for en påmelding som ventet på en låst arrangementsrad. `now()` beholdt tidspunktet fra transaksjonsstart, slik at forespørselen kunne bli godkjent etter fristen. Dette var ikke en overbooking; fristkontrollen var feil under låseventing.

[202610230006_registration_deadline.sql](../supabase/migrations/202610230006_registration_deadline.sql) erstatter bare definisjonene av `register_event` og den private opprykksfunksjonen med kontroll mot `clock_timestamp()`. Den kjører ingen påmeldinger, endrer ingen rader, rettigheter eller RLS-policyer, og aktiverer ingen jobber eller e-post. Begge låseventingstilfellene er nå testet: sen påmelding avvises, og avbestilling etter fristen utløser ikke et sent opprykk.

Brukeren har nå kjørt migrasjonen i Supabase og bekreftet at alle boolske felt fra den lesende kontrollen er `true`. Dermed matcher de aktive funksjonsdefinisjonene migrasjonen og relevante sikkerhetskontroller er som forventet, basert på brukerens resultat fra SQL Editor. Se [LIVE_TEST_PREFLIGHT.md](LIVE_TEST_PREFLIGHT.md). Ikke kjør migrasjonen eller hovedoppsettet på nytt for å kontrollere status.

## Gjenta lokale tester

Med den lokale testdatabasen startet:

```sh
npm test -- src/lib/workflows.test.ts src/pages/Auth.test.tsx src/pages/Events.registration.test.tsx
npm run test:db -- --registration
npm run typecheck
npm run lint
```

Databaserunneren tillater bare localhost. Den oppretter og fjerner sin egen tilfeldig navngitte database. Ingen lokale databasekontroller kobler til Supabase. Den nye påmeldingssuiten er også lagt til i CI.

## Klargjort automatisk test mot Supabase-utvikling

`scripts/test-registration-live.mjs` er den separate API-testen. Brukeren har nå rapportert at alle åtte tester bestod og at oppryddingen var fullført. Agenten har ikke kjørt denne testen på nytt. Den finnes ikke i CI eller i standard testkommandoer. Uten eksplisitt flagg stopper den før nettverkstilgang. Nye kjøringer forutsetter godkjenning av nye testdata; nettlesertesten har et eget omfang beskrevet i [BROWSER_TESTS.md](BROWSER_TESTS.md).

Forhåndsvis omfanget uten nettverkstilgang:

```sh
node scripts/test-registration-live.mjs --plan
```

Godkjenningsomfang: prosjekt `gawhbppuhnixqvhnnpnn`, fem midlertidige, bekreftede passordbrukere (tre studenter, ett styremedlem og én administrator), fire tydelig merkede testarrangementer og testpåmeldinger. Skriptet tester ekte passordøkter, påmelding, venteliste, opprykk, samtidighet og rettigheter. Opprydding sletter bare egne verifiserte arrangements-/bruker-ID-er; revisjonslogger beholdes. Det genereres in-app-varsler og køoppføringer som slettes med testdataene; skriptet starter ingen utsending eller worker. Se [sikkerhetsgjennomgangen](LIVE_TEST_PREFLIGHT.md) for prosjektavgrensning, nøkkelkontroll, eierskap og gjenoppretting etter avbrudd.

Etter godkjenning trenger Node-prosessen en servernøkkel for **utviklingsprosjektet**. Legg følgende i lokal, Git-ignorert `.env.registration-tests.local`; aldri i chat, Git eller en `VITE_`-variabel:

```dotenv
PMNS_TEST_SERVICE_ROLE_KEY=<utviklingsprosjektets service_role- eller server secret-nøkkel>
PMNS_TEST_EMAIL_BASE=<din faktiske private Gmail-adresse, uten +tagg>
```

Prosjektets offentlige URL og klientnøkkel leses fra eksisterende `.env`. Servernøkkelen brukes bare i Node til midlertidige fixtures og opprydding. Alle student-/styre-/administratorkontroller bruker egne passordøkter med den offentlige klientnøkkelen og reell RLS. Passord genereres i minnet og logges eller lagres ikke. Ingen global e-postbekreftelse endres. De fem unike testadressene er plussaliaser under samme kontrollerte Gmail-innboks; hovedadressen brukes aldri som testkonto eller slettemål. Det gamle domenefeltet støttes ikke lenger.

Den godkjente kjøringen er:

```sh
node scripts/test-registration-live.mjs --allow-development-writes
```

Ved avbrutt prosess eller ufullstendig opprydding må bare testarrangementer med den oppgitte AUTOTEST-koden og testbrukere med samme kjørings-ID gjennomgås i Dashboard. Dette er ikke en automatisk lanseringsgodkjenning.

En bestått API-test vil verifisere Auth/PostgREST/RLS i utviklingsprosjektet. Den beviser ikke e-postlevering eller full nettleserintegrasjon. Sistnevnte må fortsatt automatiseres/kjøres med godkjente testkontoer, eller verifiseres manuelt: innlogging, påmelding på arrangementssiden, avbestilling på Min side og synlig opprykksstatus hos student B. Den eksisterende autentiserte Playwright-suiten krever en full lokal Supabase-stack og er ikke kjørt i denne økten.
