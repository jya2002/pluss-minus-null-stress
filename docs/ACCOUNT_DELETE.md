# Account-delete — sikker deploy og avgrenset test

Status 24. oktober 2026, `develop`: **én uttrykkelig godkjent live-integrasjonstest bestod med 5/5 kontroller og fullført testopprydding**. Kun de to disponible studentkontoene og de dokumenterte testobjektene ble opprettet og fjernet. `account-delete` er deployet kun til utviklingsprosjektet; ingen nye deployer, secrets eller innstillingsendringer ble utført under slettetesten. Google OAuth er separat bekreftet av brukeren, se [GOOGLE_OAUTH.md](GOOGLE_OAUTH.md).

## Ekte slettetest — bestått og ryddet

Kjøring `9f553e64-ad75-45d8-8feb-02792e6f0fee`, bare utviklingsprosjekt `gawhbppuhnixqvhnnpnn`. Brukeren godkjente én kjøring med nøyaktig omfanget nedenfor, inkludert disponibel A gjennom Edge og verifisert fixture-opprydding inkludert B. Prosjektbinding, alle fire kildehashene, testmarkører, aliasformat, egne godkjenningsflagg og Git-ignorert manifest ble kontrollert før kjøringen. Ingen test- eller funksjonskode måtte endres.

| Etterspurt kontroll | Faktisk resultat |
| --- | --- |
| Sletting gjennom Edge Function | Bestått: fersk passordinnlogging for A, selv-sletting ga HTTP 200 og `{deleted:true}`. Forsøk på å angi testkonto B som mål ble først avvist med HTTP 400 uten å fjerne B eller bildene. |
| Auth, database og Storage | Bestått før testopprydding: A ga Auth-404, A sine kontrollerte personrader var borte, forslagsforfatter var null og forslaget fortsatt skjult. A sine to personlige bilder var borte. B, B-avatar og testarrangementet var beholdt; A sin gamle sesjon kunne ikke hente Auth-brukeren. |
| Ventelisteopprykk | Bestått: A var confirmed og B waitlisted før sletting; B var confirmed etter A sin Edge-sletting. |
| Separat fixture-opprydding | Bestått etter eierskapskontroller: begge Auth-kontoene, kontrollerte personrader, eget arrangement, gruppe, forslag og alle tre testbildene ble verifisert fraværende. |
| Feil og rester | Ingen feil, exit-kode 0. Ingen fixture-rester funnet. Audit-logger beholdt med hensikt; privat lokalt manifest beholdt som dokumentasjon. |

Sluttresultat: `5 Edge integration checks passed; Edge deletion verified: true; cleanup complete: true.` Den vellykkede Edge-slettingen og etterkontrollene ble registrert **før** separat administrativ opprydding. Ingen ekstra kjøring eller manuell opprydding ble utført. Ingen eksisterende kontoer eller foreningsobjekter ble valgt som skrive-/slettemål. Ingen e-post, cron, andre Edge Functions, secrets, Auth-/databaseinnstillinger, push, merge eller frontenddeploy inngikk.

**Avgrensning:** Dette er ekte backend-ende-til-ende med disponible passordkontoer, ikke en ekte Google-/Min side-nettlesertest eller offentlig Pages-test. Siste administrator, utløpt innlogging, privat outbox og ekstra FK-scenarioer er dekket av de tidligere lokale testene; de ble ikke prøvd på eksisterende live-kontoer eller kjørt på nytt nå. Storage/Auth er fortsatt ikke én atomisk transaksjon.

## Godkjent utviklingsdeploy — gjennomført

Brukeren har 24. oktober separat godkjent deploy av **bare `account-delete` til `gawhbppuhnixqvhnnpnn`** og opprettelse av **kun `ALLOWED_ORIGIN=http://127.0.0.1:5173`**, etter kontroll av andre aktive funksjoner. Senere ble nøyaktig én avgrenset live-slettetest godkjent og gjennomført som dokumentert ovenfor.

Alle fire SHA-256-verdiene i `.runtime/account-delete-deploy-plan.json` samsvarer fortsatt med kildefilene og `supabase/config.toml`. Grenen er `develop`. Ingen ny kodeendring eller gjentakelse av beståtte testsuiter var nødvendig.

Før endringen viste Supabase CLI **2.122.0** ingen deployede Edge Functions og ingen konfigurert `ALLOWED_ORIGIN`. Lokal `account-delete` og `image-upload` leser denne verdien, og den delte CORS-hjelperen bruker den også; `notifications` kaller ikke denne hjelperen. Ingen annen aktiv funksjon kunne dermed påvirkes av opprettelsen. Ingen andre funksjoner ble deployet.

Kun den godkjente secreten ble opprettet. En lesende kontroll bekreftet én `ALLOWED_ORIGIN` med SHA-256-avtrykk lik forventet verdi, uten å skrive ut andre secret-verdier. Deretter ble alle fire kildehashene kontrollert på nytt og funnet uendret. Deployen brukte `--use-api` for serverbasert bundling uten Docker. Etterkontrollen viste nøyaktig én funksjon: `account-delete`, **ACTIVE**, versjon **1**, `verify_jwt=false` som i den gjennomgåtte konfigurasjonen. Eksplisitt Auth-validering ligger fortsatt i handleren.

`node scripts/test-account-delete-live.mjs --preflight` bestod med exit-kode 0. Skriptet krever **GET 405**, **OPTIONS 204** og eksakt `Access-Control-Allow-Origin: http://127.0.0.1:5173`. Den separate preflighten skrev ingen testdata. De samme kontrollene bestod automatisk før første skriving i den senere godkjente slettetesten.

## Verifisert før eventuell deploy

- Brukeren har kjørt [account-deletion-readiness.sql](../supabase/checks/account-deletion-readiness.sql) i utviklingsprosjektet og rapportert **alle boolske felt true**. Kontrollen er lesende og sammenligner blant annet de gjennomgåtte funksjonsdefinisjonene, execute-grants, slettetrigger og sentrale FK-er. Agenten har ikke lest private brukerdata eller endret databasen.
- Før deploy returnerte funksjonskontrollen historisk **HTTP 404**. Dette er nå erstattet av bestått lesende GET/OPTIONS-preflight mot den deployede funksjonen; det er fortsatt ikke bevis for faktisk kontosletting.
- Lokal Deno-typekontroll, TypeScript og lint består. Ingen produksjonskode eller migrasjon var nødvendig å endre i denne runden; testdekningen inkluderer nå Google/OAuth-AMR. Tidligere bestått Google-innlogging og hele frontend-suiten er ikke kjørt på nytt.

## Sikkerhetskontroll av funksjonen

`supabase/functions/account-delete/index.ts` bruker `handler.ts` og `_shared/client.ts`. Importen av Supabase SDK er versjonsfestet. Serverlegitimasjon hentes bare fra Edge-miljøet.

| Krav | Implementert kontroll | Verifikasjon |
| --- | --- | --- |
| Ekte autentisering | `auth.getUser(token)` validerer token før claims brukes | Lokal handler-test med avvist Auth-resultat; ekte servervalidering skal bekreftes etter deploy |
| Nylig innlogging | Maks 15 minutter for `iat`, brukerens `last_sign_in_at` og relevant signert AMR-tidspunkt for denne sesjonen; også `oauth` støttes | Lokale tester for fersk OAuth, gamle/ugyldige tidsstempler, refresh og innlogging på en annen enhet |
| Bare egen konto | ID kommer fra den verifiserte brukeren. POST krever nøyaktig `{ "confirmation": "SLETT" }`; andre felt, inkludert `user_id`, avvises | Lokal sikkerhetstest; avgrenset live-test forsøker å angi den andre **testkontoen** som mål |
| Siste administrator | `prepare_account_deletion()` med callerens JWT før Storage; SQL-triggeren gjentar kontrollen ved faktisk sletting under samme administrasjonslås som rolleendringer | Ekte lokal PostgreSQL: både forberedelse og Auth-cascade blokkeres. Også rolleendring mellom forberedelse og sletting er testet |
| Storage-eierskap | Bare personlige UUID-stier i `avatars` og `suggestion-images`, via Storage API. Ingen rekursiv SQL-/bucket-sletting. Ukjente mapper/navn stopper sletting | Lokale handler- og oppryddingstester; reell Storage skal prøves etter godkjenning |
| Foreningsdata | `event-images` beholdes; forslag/kaptein/oppretter/audit-aktør anonymiseres der data beholdes | Handler-test og lokal PostgreSQL for FK-/triggeradferd |
| Feil og origin | Eksakt konfigurert origin; ingen wildcard. Generiske feil og `no-store`. Feilet Storage stopper Auth-sletting | Lokale feiltester; GET/OPTIONS kontrolleres før live-fixtures |

`verify_jwt=false` er eksisterende konfigurasjon: funksjonen utfører selv den eksplisitte Auth-valideringen ovenfor. Det er ingen anonym sletteadgang. En publishable key er ikke et brukertoken og gir ikke slettetilgang.

**Begrensning:** Storage og Auth/PostgreSQL er ikke én atomisk transaksjon. Allerede fjernede personlige bilder blir ikke gjenopprettet hvis et senere steg feiler. Kontoen beholdes ved en Storage-feil. Siste-admin-triggeren kan også avvise en konto etter filopprydding hvis roller endres samtidig. Gjentatt forsøk kan fullføre oppryddingen, mens ukjente filer krever manuell vurdering. Ikke lov full tilbakeføring eller umiddelbar invalidering av alle JWT-er: Auth-brukeren fjernes, private FK-data slettes og frontend logger ut; offentlig/stateless API-tilgang har egne tokenregler.

Referanser: [Supabase JWT-claims og AMR](https://supabase.com/docs/guides/auth/jwt-fields), [serverbasert deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [deploy av én Edge Function](https://supabase.com/docs/guides/functions/deploy).

## Gjennomført deployomfang

Bare funksjonen **`account-delete`** til **utviklingsprosjekt `gawhbppuhnixqvhnnpnn`**. Ingen frontend, andre funksjoner, migrasjoner, roller, Auth-provider, e-postworker eller cron skal endres.

`ALLOWED_ORIGIN` er opprettet og kontrollert som **`http://127.0.0.1:5173`** for utviklingsprøven. Verdien er prosjektfelles; fremtidige endringer krever særskilt godkjenning. Senere Pages-origin er `https://jya2002.github.io`, uten repo-sti, og er ikke satt nå.

Supabase stiller `SUPABASE_URL`, `SUPABASE_ANON_KEY` og `SUPABASE_SERVICE_ROLE_KEY` til disposisjon i Edge-miljøet. Disse skal ikke flyttes til frontend eller chat. CLI krever prosjektansvarligs innlogging; en service-role-key til testskriptet erstatter ikke CLI-tilgang.

Følgende avgrensede kommando er kjørt med Supabase CLI 2.122.0 via lokal npm-cache:

```powershell
supabase functions deploy account-delete --project-ref gawhbppuhnixqvhnnpnn --use-api
```

Deploy fra repo-roten med den gjennomgåtte konfigurasjonen. Ikke bruk en kommando som deployer alle funksjoner. Deno-checken er en lokal kontroll, ikke en deploy-dry-run. Et lokalt, Git-ignorert SHA-256-planark ligger i `.runtime/account-delete-deploy-plan.json`; det inneholder bare prosjekt, filstier, hashverdier og foreslått kommando. Nye kildeendringer må gjennomgås før godkjenningen brukes.

Etter deploy ble denne kontrollen kjørt uten testdata:

```powershell
node scripts/test-account-delete-live.mjs --preflight
```

Den leser bare offentlig prosjektkonfigurasjon og sender GET/OPTIONS til det fastlåste utviklingsprosjektet. Resultat: handler-405 ved GET og 204 med eksakt origin ved OPTIONS. 404 eller feil CORS ville stoppet før første skriving.

## Backend-ende-til-ende-test — omfanget som ble kjørt

[test-account-delete-live.mjs](../scripts/test-account-delete-live.mjs) tester ekte passordinnlogging → Edge Function → Storage → Auth/PostgreSQL, og verifiserer resultatene **før** separat testopprydding. Den er ikke en live nettlesertest av Min side. Den eksisterende simulerte UI-testen ligger i `tests/ui/account-deletion.spec.ts`; en faktisk Google-basert sletting fra Min side må avtales separat med en disponibel Google-konto, aldri med den eksisterende kontoen din.

Omfang per godkjent kjøring:

- To **nye** bekreftede studentkontoer A/B med kontrollerte Gmail-plussaliaser og tilfeldige passord, generert i minnet. Administrativ opprettelse sender ikke OTP, invitasjon eller bekreftelsesmail.
- Én ny tilgangsgruppe med bare A/B og ett tydelig merket demoarrangement, kapasitet 1, venteliste aktivert og målgruppe `groups`. Andre studenter kan ikke melde seg på. B er registrert som oppretter for at eierskap fortsatt kan kontrolleres etter sletting av A. Begge beholder studentrolle.
- Én skjult testidé med én A-stemme og én medlemskapssøknad for A. Forslaget er skjult slik at andre studenter ikke kan stemme på det. Ingen kontaktmelding sendes til styret.
- Tre gyldige, små PNG-filer med full kjøringsmarkør i filinnholdet: A-avatar, A-forslagsbilde og B-avatar som kontrollfil. Ingen foreningsbilder eller eksisterende filer brukes.
- A blir confirmed, B waitlisted. A forsøker først et avvist slettemål med B sin fixture-ID, og sletter deretter seg selv med fersk reell passordsesjon.
- Testen kontrollerer Auth-404 for A; fravær av A sine relevante offentlige personrader; anonymisert forfatter; tom personlig Storage for A; beholdt B-avatar/B-konto/arrangement; og B som confirmed etter opprykk.

Varslingspreferanser settes av for begge før påmelding. In-app-varsler og den vanlige køen kan opprettes av RPC-ene; mailworker/cron kalles ikke. Ingen Google-innstilling endres og ingen eksisterende Google-konto brukes som slettemål. At ekte Google-innlogging fungerer, beviser ikke i seg selv at sletting av en Google-konto fungerer.

Den lokale PostgreSQL-testen dekker i tillegg `poll_votes`, kontakter, lagkaptein, audit-anonymisering, private rategrenser og privat e-postkø. Disse slettescenarioene og siste administrator testes ikke på eksisterende live-kontoer. Den private køen er ikke eksponert i PostgREST bare for å gjøre live-testen enklere.

### Sikkerhetssperrer og opprydding

Testen gjenbruker prosjektbindingen, aliaser, redirect-forbud og kontoeierskapskontroll fra `registration-live-safety.mjs`. Den nye `account-delete-test-safety.mjs` krever i tillegg:

- Egen godkjenningsvariabel **og** et eget kommandoflagg. Gamle API-/browsergodkjenninger godtas ikke. `--plan` laster verken miljøfiler eller nettverk.
- Atomisk manifest før første live-skriving, med alle planlagte UUID-er, full markør og bildefingeravtrykk. Ingen passord, tokens eller servernøkler lagres. Manifestet inneholder lokale testadresser og skal forbli privat/Git-ignorert.
- Full kontroll av Auth-ID, eksakt alias, serverstyrt `pmns_test_run`, uendret studentrolle, event-/gruppe-/forslagsmarkør og faktiske bildefiler før opprydding. Uventede deltakere, stemmer, gruppetilknytninger, rolleendringer eller filer stopper alle innledende oppryddingsmutasjoner.
- Anonymisert forslag kan bare ryddes dersom forfatterkontoen faktisk er borte. Bare eksakte filstier med korrekt innholdshash fjernes. Ingen massesletting, e-postprefikssøk, bucket-tømming eller audit-sletting.
- Separat, ikke-avbrutt cleanup-transport i `finally`. Etterpå kontrolleres begge fixture-kontoer, deres personrader, eget arrangement/gruppe/forslag og personlige filstier som fraværende. Ved usikkerhet beholdes rester og manifest for gjennomgang.

En vellykket administrativ opprydding kan aldri gjøre en feilet Edge-test bestått: `edgeDeletionVerified` settes først etter at selve Edge-resultatet og alle etterkontroller består. `cleanupComplete` er et eget resultat. Nettverksfeil kan fortsatt gi delvis opprydding; det er ingen distribuerte transaksjoner eller garanti mot en hard prosessavslutning.

### Lokal konfigurasjon og kommando etter godkjenning

Eksisterende `.env` og `.env.registration-tests.local` gjenbrukes:

| Variabel | Hvor / kilde |
| --- | --- |
| `VITE_SUPABASE_URL` | Utviklingsprosjektets rot-URL, fastlåst til `https://gawhbppuhnixqvhnnpnn.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Prosjektets offentlige publishable key / passende legacy anon key |
| `PMNS_TEST_SERVICE_ROLE_KEY` | Supabase Dashboard > Project Settings > API Keys: secret/server key eller service-role-key. Bare Node-testen; aldri `VITE_`, chat eller Git |
| `PMNS_TEST_EMAIL_BASE` | Egen Gmail-adresse du kontrollerer, uten plusstag; tidligere godkjent aliasmekanisme gjenbrukes. Ingen e-post sendes |

Ikke skriv ut filene eller nøkkelverdiene for å kontrollere dem. Den lokale passordgranten må fortsatt være tilgjengelig for de disponible testkontoene; skriptet endrer ingen Auth-innstillinger for å få dette til.

Trygg planvisning, allerede kjørt lokalt:

```powershell
node scripts/test-account-delete-live.mjs --plan
```

**Bare etter eksplisitt godkjenning av omfanget ovenfor:**

```powershell
$env:PMNS_APPROVE_ACCOUNT_DELETE_TEST='gawhbppuhnixqvhnnpnn'
try {
  node scripts/test-account-delete-live.mjs --allow-development-account-deletion
} finally {
  Remove-Item Env:PMNS_APPROVE_ACCOUNT_DELETE_TEST -ErrorAction SilentlyContinue
}
```

Resultat fra den ene godkjente kjøringen: fem integrasjonskontroller bestått, `Edge deletion verified: true` og `cleanup complete: true`, exit-kode 0. Ethvert avvik eller tvetydig nettverkssvar gir feilstatus. Kommandoen skal ikke kjøres på nytt uten en ny godkjenning.

Ved hard avbrytelse: gjennomgå akkurat `.runtime/account-delete-live/<runUUID>.json`. Etter godkjenning av restene fra **den kjøringen**, bruk samme godkjenningsvariabel/flagget og `--cleanup-run=<runUUID>`. Kun UUID godtas, ikke en vilkårlig filsti. Manifest, operatørens aliasbase og alle faktiske eierskap må fortsatt stemme. Recovery oppretter ingen nye fixtures og teller aldri som bestått Edge-test. En uventet rolle/fil eller fremmed deltaker krever manuell gjennomgang, ikke en bredere slettekommando.

## Testresultater i denne runden

| Kontroll | Resultat | Miljø |
| --- | --- | --- |
| Google OAuth, Min side, studentrolle, ut/inn | Bestått, rapportert av brukeren | Ekte Supabase; ikke gjentatt av agenten |
| Database-readiness | Alle boolske felt true, rapportert av brukeren | Lesende SQL i utviklingsprosjektet |
| Handler-sikkerhet | 12/12 bestått, også fersk OAuth-AMR | Faktisk handler med simulerte Auth/RPC/Storage-svar |
| Fixture-/cleanup-sikkerhet | 29/29 bestått | Offline, ingen Supabase-kontakt |
| Slettetrigger, cascades, siste admin, rolleendring og opprykk | 6/6 bestått, inkludert kaptein og private rategrenser | Ekte lokal PostgreSQL, isolerte Auth/Storage-shims |
| TypeScript, lint, Deno-check, skriptsyntaks og offline plan | Bestått | Lokalt |
| Godkjent secret og deploy | Kun ALLOWED_ORIGIN opprettet; account-delete ACTIVE, versjon 1 | Ekte utviklingsprosjekt; ingen andre funksjoner deployet |
| Lesende funksjons-preflight | Bestått: GET 405, OPTIONS 204, eksakt lokal CORS-origin | Ekte utviklingsprosjekt; ingen fixtures eller POST |
| Live account-delete / live opprydding | 5/5 bestått; Edge deletion verified=true, cleanupComplete=true | Ekte utviklingsprosjekt, én godkjent kjøring, bare disponible fixtures |

CI er utvidet med bare offline sikkerhetstester og lokal PostgreSQL-test. Ingen live-slettetest eller deploy er lagt til i CI. En ugyldig CRC i den første lokale PNG-fixturen ble funnet og rettet før noen live-data ble opprettet; regresjonen validerer chunk-CRC og bildedata.

Deploy, den lokale origin-secreten og én avgrenset live-slettetest er separat godkjent og gjennomført. **Godkjenningen til den ene testkjøringen er nå brukt.** En ny kjøring, live nettlesertest med disponibel Google-konto, endret origin eller produksjonsdeploy krever ny godkjenning. Ingen eksisterende konto, produksjonsdata, produksjonsdeploy, push eller merge inngår.
