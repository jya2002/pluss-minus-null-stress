# Nettlesertesting av brukerflyten

**24. oktober:** Se [PRELAUNCH_REVIEW.md](PRELAUNCH_REVIEW.md) for nyeste kontroll. 40 ulike UI-tester, 8 offentlige demo-tester og 2 Pages-tester bestod på desktop/mobil. Det omfatter samlet konto-/medlems-/event-/forslags-/poll-flyt, kontaktbehandling og nye frontendregresjoner. Ingen ny live-fixture ble opprettet. Manuell interaktiv nettleserstyring var utilgjengelig; visuell kontroll av lokale skjermbilder er dokumentert separat fra automatiske tester.

Nyeste utviklingsrunde: **22 ulike lokale Playwright-tester bestod etter målrettede omkjøringer**, inkludert medlemskap, forslag, avstemninger og autentisert mobil-/tilgjengelighetstest. Se [COMMUNITY_TESTS.md](COMMUNITY_TESTS.md) for resultater, sikkerhetsrettinger og godkjenningskrevende neste steg. Brukeren har også rapportert den tidligere ekte nettlesertesten av arrangementssystemet bestått. Statusen nedenfor er historikk fra klargjøringen av den testen.

Status 23. oktober 2026: **10 Playwright-tester bestod på desktop og mobil med simulerte Supabase-svar**. TypeScript strict og målrettet ESLint bestod. Ingen produksjonskode, database eller Auth-innstilling er endret. Ingen nye Supabase-testdata er opprettet av agenten.

Brukeren har separat rapportert at alle åtte ekte Supabase-API-integrasjonstester bestod og at testdataene ble ryddet. Dette resultatet er ikke en ekte nettlesertest og er ikke en ny kjøring utført av agenten.

## Hva som faktisk er kjørt

| Brukerhandling                                                                            | Desktop og mobil, simulerte API-svar | Ekte Supabase i nettleseren                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| Student logger inn gjennom passordskjemaet                                                | Bestått                              | Klargjort, ikke kjørt                           |
| Åpner arrangementsoversikten gjennom navigasjonen                                         | Bestått                              | Klargjort, ikke kjørt                           |
| Student A melder seg på og ser bekreftelse                                                | Bestått                              | Klargjort, ikke kjørt                           |
| Separat student B melder seg på og ser venteliste                                         | Bestått                              | Klargjort, ikke kjørt                           |
| A avbestiller gjennom Min side og bekrefter dialogen                                      | Bestått                              | Klargjort, ikke kjørt                           |
| B laster Min side på nytt og ser bekreftet plass og opprykksvarsel                        | Bestått                              | Klargjort, ikke kjørt                           |
| Alle utfylte arrangementsfelt beholdes ved skriving og ekte utklippstavleinnliming i Sted | Bestått                              | Klargjort, ikke kjørt                           |
| Student avvises ved direkte navigasjon til Styreportalen                                  | Bestått                              | Klargjort, ikke kjørt                           |
| Administrator oppretter et utkast, redigerer og ser lagrede verdier etter omlasting       | Bestått                              | Klargjort, ikke kjørt                           |
| Tekstmarkering som ender i dialogens innvendige luft lukker ikke skjemaet                 | Bestått                              | Tidligere retting; ikke kjørt mot ekte Supabase |
| Lukkeknapp, Escape og faktisk bakteppe virker fortsatt                                    | Bestått                              | Ikke kjørt mot ekte Supabase                    |

De to nye flyttestene kjøres i to enhetsstørrelser, sammen med tre eksisterende dialogtester i begge størrelser: totalt ti beståtte tester. Student A og B har separate nettleserøkter. Administratoren logger også inn gjennom det faktiske React-skjemaet. React, React Router, Supabase-klienten og TanStack Query brukes; bare Auth-/API-responsene simuleres.

Simuleringen har en enkel påmeldings-/ventelistetilstand for å teste UI-reaksjoner. Den er **ikke** bevis for reell autentisering, PostgreSQL-låsing, kapasitetsgarantier eller RLS. Disse må vurderes separat med de reelle API-/databasetestene.

Opprykket er kontrollert etter at B laster Min side på nytt. Oppdatering uten omlasting er ikke verifisert og skal ikke beskrives som testet sanntidsoppdatering.

## Kjør bare testene uten ekte data

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome' # På denne maskinen brukes installert Chrome.
npm run test:e2e -- --config playwright.ui.config.ts
```

Serveren starter på `http://127.0.0.1:5177` med en fiktiv Supabase-URL og offentlig testnøkkel. Alle backend-kall avskjæres. Uventede eksterne forespørsler avvises. Den virkelige lokale `.env`-tilkoblingen brukes ikke. Disse testene er lagt til i CI, uten nøkler eller krav om godkjenning til Supabase-skriving.

## Feil og begrensninger funnet

Ingen ny funksjonsfeil i applikasjonen ble funnet av den fullførte nettleserkjøringen. Den første kjøringen av de nye testene feilet fordi den simulerte testserveren avviste lesende `event_summary`-/`suggestion_feed`-RPC-er sendt med POST. Testserveren er rettet; alle ti tester bestod deretter. Dette krevde ingen endring i appen eller databasen.

## Klargjort ekte nettleserintegrasjon — krever ny godkjenning

`playwright.live.config.ts` inneholder én sammenhengende desktop-test for de ni etterspurte brukerhandlingene. Den gjenbruker de samme nettleserhandlingene som testene ovenfor, sammen med `scripts/registration-live-safety.mjs` fra API-testen.

Omfang per kjøring:

- Bare utviklingsprosjekt `gawhbppuhnixqvhnnpnn`.
- Tre nye bekreftede testbrukere: student A, student B og administrator. Gmail-plussaliaser og tilfeldige passord beholdes.
- To tydelig merkede testarrangementer: ett publisert med kapasitet 1 og venteliste, samt ett utkast opprettet og redigert gjennom administratorens skjema.
- Bare egne verifiserte fixtures ryddes med den eksisterende eierskapskontrollen. Revisjonslogger beholdes. En atomisk, Git-ignorert oversikt over ID-er lagres før skriving, uten passord eller token.

Opprettelse av kontoer og det første arrangementet skjer i Node-fixturen. Servernøkkelen sendes aldri til nettleseren. Alle faktiske brukerhandlinger går gjennom UI og Supabase med brukerens ekte JWT og reell RLS. Midlertidige kontoer får e-postpreferansene slått av før påmelding. OTP, invitasjoner, e-postutsending, cron og produksjonsdeploy brukes ikke.

For å kunne rydde et arrangement selv ved en tvetydig nettverksfeil tildeler testharnessen den UI-opprettede draft-raden en forhåndsregistrert UUID. Den endrer ingen andre felt i forespørselen og fabrikerer ingen API-/Auth-respons. Browserforespørsler videresendes til den ekte backend uten å følge omdirigeringer. Skrivemål må være kjøringens testarrangementer og testkontoer; uvedkommende mål blokkeres.

Playwright-trace, skjermbilder og video er slått av i live-konfigurasjonen fordi slike artefakter kan fange legitimasjon og JWT-er. Passordfeltet tømmes ved mislykket innlogging. Eventuelle lokale feilrapporter skal fortsatt behandles som private og er Git-ignorert. Vanlige avbrudd håndteres med opprydding; ved hard prosessavslutning brukes oversikten for manuell gjennomgang, uten generell massesletting.

Eksisterende verdier i `.env` og `.env.registration-tests.local` gjenbrukes. Ingen nye nøkler, domener eller tjenester trengs. Se [LIVE_TEST_PREFLIGHT.md](LIVE_TEST_PREFLIGHT.md) for variablene.

Den lesende oppdagelsen er kjørt:

```sh
npm run test:e2e -- --config playwright.live.config.ts --list
```

Resultatet var én oppdaget test. Dette oppretter ingen fixtures, starter ingen nettleserflyt og teller **ikke** som en bestått integrasjonstest.

Følgende kommando skal **bare** brukes etter uttrykkelig godkjenning av omfanget ovenfor:

```powershell
$env:PMNS_APPROVE_BROWSER_FIXTURES='gawhbppuhnixqvhnnpnn'
$env:PLAYWRIGHT_CHANNEL='chrome'
try {
  npm run test:e2e -- --config playwright.live.config.ts
} finally {
  Remove-Item Env:PMNS_APPROVE_BROWSER_FIXTURES -ErrorAction SilentlyContinue
}
```

Både konfigurasjonen og fixturen krever dette eksplisitte flagget før en faktisk kjøring. Live-suiten ligger utenfor standardtestene og CI. Mobil brukerflyt er foreløpig bare kjørt med simuleringer; live-suiten er bevisst begrenset til desktop for å holde det godkjenningskrevende fixture-omfanget lite og forutsigbart.
