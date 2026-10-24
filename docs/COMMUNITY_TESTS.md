# Medlemskap, forslag, avstemninger og mobil — 23. oktober 2026

**Oppdatering 24. oktober:** Brukeren har rapportert alle seks ekte community-API-tester bestått med oppryddede testdata. Ikke kjør migrasjoner eller live-testene på nytt som følge av den historiske instruksjonen nedenfor. Nyeste pilotvurdering og gjenstående oppgaver finnes i [PRELAUNCH_REVIEW.md](PRELAUNCH_REVIEW.md).

Arbeidet er utført på `develop`. Ingen endringer er merget eller deployet. Ingen nye live-kontoer, forslag, avstemninger, filer eller migrasjoner er skrevet til Supabase i denne runden. Tidligere ekte API- og nettlesertester av arrangementssystemet er oppgitt bestått av brukeren; disse er ikke kjørt om igjen mot Supabase.

## Kartlegging og endringer

Alle tre fagområder hadde allerede tabeller, RLS, RPC-er og fungerende skjermbilder. Medlemskap hadde søknad/status på Min side og styrebehandling; ingen ny medlemsfunksjon eller migrasjon var nødvendig. Forslag hadde innsending, stemme/tilbaketrekking og alle fem modereringsstatuser. Avstemninger hadde opprettelse, publisering/avpublisering, tidsvindu, målgruppe og skjulte resultater.

Lagt til eller rettet:

- Styret kan redigere avstemningens åpning og stenging, med datovalidering. «Avslutt nå» oppdateres straks etter lagring. Stemming er sperret mens egen tidligere stemme lastes eller oppslaget feiler.
- Anonyme forslag sendes uten bilde. Et tidligere valgt bilde blir ikke lastet opp når anonymitet velges; øvrige skjemafelt beholdes.
- Den vannrette administrasjonsmenyen holder seg innenfor mobilskjermen. Store tabeller ruller i egne, navngitte områder som kan fokuseres med tastatur.
- Tab/Shift+Tab går mellom første og siste dialogkontroll. Escape og tilbakeføring av fokus til åpneknappen er kontrollert; tidligere retting av Sted-feltet er bevart.

## Sikkerhetsfunn — rettet lokalt, avventer Supabase-godkjenning

Tre separate, avgrensede migrasjoner er klargjort. De oppretter ingen testdata, sletter ingen rader/filer og starter ingen jobber:

1. [007 — anonym forslagsfeed](../supabase/migrations/202610230007_suggestion_anonymity.sql): eksisterende `image_path` inneholdt avsenderens UUID selv når navnet var anonymt. RPC-en returnerer nå `null` for slike bilder, også for gamle forslag.
2. [008 — avstemningsfrist](../supabase/migrations/202610230008_poll_deadline.sql): en forespørsel som ventet på radlås over fristen kunne godtas fordi `now()` var tidspunktet ved transaksjonsstart. Den bruker nå faktisk klokkeslett etter låsen. Regresjonen feilet før retting og består etterpå.
3. [009 — forslagsbilder og fillisting](../supabase/migrations/202610230009_suggestion_storage_privacy.sql): offentlig listing av `suggestion-images` avslørte kontomapper. Bare eier/styre kan nå liste metadata i denne bucketen. Regresjonen viste at en uvedkommende kunne lese én slik rad før retting og null etterpå. Andre buckets er uendret.

Offentlige bildeadresser er fremdeles offentlige. Dette er [Supabase sin dokumenterte bucket-modell](https://supabase.com/docs/guides/storage/buckets/fundamentals); rettingen opphever ikke tidligere delte adresser eller nettlesercacher. Anonymitet gjelder offentlig visning, ikke overfor styret. Selvavslørende tekst kan fortsatt røpe identitet. Anonyme forslag har derfor ikke bilde i den nåværende løsningen. [Storage-policyene](https://supabase.com/docs/guides/storage/security/access-control) begrenser separat listing og filoperasjoner.

## Resultater

| Arbeidsområde            | Lokal PostgreSQL                                                                                                                                                   | Playwright desktop og mobil                                                                                                                     | Ekte Supabase i denne runden |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Medlemskap               | 9 bestått: søknad, duplikat, privat status, rå skriverettigheter, egen godkjenning, styre/admin, ny søknad, automatisk godkjenning og medlemsbegrenset arrangement | 2 bestått: søknad, omlasting, godkjenning, avslag og ny søknad i separate student-/adminøkter                                                   | Ikke kjørt                   |
| Forslag                  | 11 bestått: servervalidering, anonym identitet/bilde/metadata, samtidige duplikatstemmer, uttak, eierskap, roller, alle statuser og skjuling                       | 2 bestått: ugyldig/gyldig skjema, anonymt bilde deaktivert, stemme/uttak, alle statuser, skjul/vis                                              | Ikke kjørt                   |
| Avstemninger             | 13 bestått: roller, utkast, duplikat/samtidighet, skjulte resultater, rå manipulering, åpning/stenging, målgruppe, fremmed alternativ og lås over frist            | 2 bestått: opprettelse, av/publisering, tastaturstemme, lagret stemme, resultatskjuling, periode og stenging                                    | Ikke kjørt                   |
| Mobil og tilgjengelighet | Ikke relevant                                                                                                                                                      | 6 bestått: offentlige sider, passord, Min side, forslag/polls, alle ti adminfaner, event-/poll-/forslagsdialoger, viewport, skip-lenke og fokus | Ikke kjørt                   |

Totalt **35 databasekontroller**, inkludert atomiske migrasjoner og lesende readiness-kontroll. Dette er ekte PostgreSQL med reelle roller, RLS, constraints, transaksjoner og samtidige forbindelser. Bare Supabase Auth-/Storage-grensesnittene er lokale testgrensesnitt; det verifiserer ikke drift av ekte Auth eller Storage HTTP API.

Totalt **22 ulike Playwright-tester bestod etter målrettede omkjøringer**: de 12 ovenfor og ti bevarte arrangements-/dialogregresjoner. Testserveren bruker fiktiv backend og avskjærer alle backend-kall; uventede eksterne forespørsler avvises. PostgreSQL-sikkerhet blir ikke utledet fra denne simuleringen. Tidlige feil i nye testlokatorer og forventning om synkron checkbox-oppdatering ble rettet i testene.

**7 målrettede Vitest-tester bestod**, inkludert anonymt bilde og bevarte felt samt arrangementsskjemaets regresjoner. **9 offline sikkerhetstester** for det nye live-skriptet bestod. TypeScript strict, ESLint og lokal produksjonsbuild bestod. Første buildforsøk ble blokkert av sandboxens prosessbegrensning; autorisert lokal omkjøring fullførte uten kodeendring. Ingen publisering ble utført.

Axe kontrollerer WCAG A/AA-regler på besøkte sider og dialoger. Ingen regelavvik gjenstår i disse testene. Dette erstatter ikke manuell skjermleser, zoom eller test på ekte iOS/Android og innebærer ingen tilgjengelighetssertifisering. Mobiltestene bruker Chromium med iPhone-størrelse/berøring, ikke Safari.

## Kjør lokalt

```powershell
npm run typecheck
npm run lint
npm run test:db -- --community # Bare egen midlertidig database på localhost
npx vitest run src/pages/Thursday.suggestions.test.tsx src/pages/Events.registration.test.tsx
node --test tests/scripts/community-live-safety.test.mjs
$env:PLAYWRIGHT_CHANNEL='chrome' # Installert Chrome på denne maskinen
npm run test:e2e -- --config playwright.ui.config.ts
```

Databasetestene krever den lokale PostgreSQL-instansen, standard port 55439. CI har fått community-databasetestene og offline sikkerhetstestene; nettleserfilene inkluderes automatisk i eksisterende UI-jobb. Live-skriptet inngår ikke i CI.

## Neste steg — krever uttrykkelig godkjenning

1. Gjennomgå og godkjenn **bare migrasjon 007, 008 og 009** i utviklingsprosjekt `gawhbppuhnixqvhnnpnn`. Kjør dem i rekkefølge i SQL Editor etter godkjenning. Ikke kjør hovedoppsettet på nytt.
2. Kjør [community-readiness.sql](../supabase/checks/community-readiness.sql) i samme SQL Editor etterpå. Dette er lesende, viser bare signaturer/boolske felt og skal gi `true` i alle boolske felt. Listing-feltet bekrefter at eierkontrollen finnes; de lokale RLS-testene kontrollerer den faktiske isolasjonen.
3. Godkjenn separat omfanget til `scripts/test-community-live.mjs`: **tre midlertidige, bekreftede passordkontoer, ett offentlig merket anonymt forslag og tre offentlig merkede avstemninger**. Ingen arrangementer eller filer opprettes. Forslaget inneholder en syntetisk bildesti uten fil for å teste anonym redigering av feeden. Kontoene bruker kontrollerte Gmail-plussaliaser og tilfeldige passord. Ingen OTP, invitasjoner, bekreftelsesmailer eller e-postarbeidere brukes.

Eksisterende `.env` og `.env.registration-tests.local` gjenbrukes uendret: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `PMNS_TEST_SERVICE_ROLE_KEY` og `PMNS_TEST_EMAIL_BASE`. Se [LIVE_TEST_PREFLIGHT.md](LIVE_TEST_PREFLIGHT.md). Nøkler/passord skal ikke deles i chat eller Git.

Nettverksfri plan, trygt før godkjenning:

```powershell
node scripts/test-community-live.mjs --plan
```

**Bare etter separat live-godkjenning**:

```powershell
$env:PMNS_APPROVE_COMMUNITY_FIXTURES='gawhbppuhnixqvhnnpnn'
try {
  node scripts/test-community-live.mjs --allow-development-writes
} finally {
  Remove-Item Env:PMNS_APPROVE_COMMUNITY_FIXTURES -ErrorAction SilentlyContinue
}
```

Begge godkjenningsvilkår må være til stede. Prosjekt og nettverksorigin er fastlåst av eksisterende sikkerhetsmodul. Service-nøkkelen brukes bare i Node til egne fixtures; funksjonskontrollene bruker ekte bruker-JWT/RLS. Seks planlagte API-kontroller er skrevet, men **ikke kjørt**.

Opprydding lagrer eksakte markører/intensjoner før RPC-kall og bekrefter forfatter eller uforanderlig opprettelseslogg før sletting. Ved tvetydig svar gjenfinnes bare en rad med full UUID-markør. Kjente testforslag skjules og testavstemninger avpubliseres før avhengige stemmer kontrolleres. Fremmede stemmer, endret eier/markør, ukjent innhold eller API-feil stopper sletting av kontoer. Bare verifiserte egne rader slettes; revisjonslogger beholdes. Den atomiske, Git-ignorerte oversikten ligger i `.runtime/community-live/`, uten passord eller token. Ved hard prosessavslutning må oversikten gjennomgås manuelt; ingen generell massesletting brukes.

Før publisering gjenstår disse live-kontrollene, de tre godkjente migrasjonene og manuell enhets-/tilgjengelighetsgjennomgang, i tillegg til prosjektets øvrige dokumenterte lanseringskrav. Frontend, Auth-innstillinger, cron og e-postlevering er ikke deployet eller aktivert i denne runden.
