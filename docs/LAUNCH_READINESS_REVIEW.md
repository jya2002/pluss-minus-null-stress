# Lanseringsgjennomgang — Pluss Minus Null Stress

Revidert **24. oktober 2026**, på `develop`. Planlagt adresse: **https://jya2002.github.io/pluss-minus-null-stress/**. Gjennomgått backend: **utviklingsprosjekt `gawhbppuhnixqvhnnpnn`**.

Dette er en revisjon. Ingen produktkode, eksisterende konfigurasjonsfiler, migrasjoner, roller, RLS, secrets eller backendfunksjoner er endret. Ingen ekte brukere, arrangementer, filer eller e-poster er opprettet, endret eller slettet. Ingen push, merge eller deploy er utført. Lokale testdatabaser/buildartefakter og private revisjonskvitteringer er generert som del av de godkjente kontrollene. Denne rapporten er det nye leveransedokumentet.

## 1. Executive summary og beslutning

**NO-GO for offentlig lansering nå.** Applikasjonen har et godt, omfattende testet fundament. De kritiske påmeldings-, medlemskaps-, stemme- og autorisasjonsreglene består lokale PostgreSQL-tester, og tidligere ekte Supabase-resultater finnes. Google-innlogging og permanent sletting av ett tomt utkast er også prøvd av brukeren. Dette er vesentlig bedre enn statusen i den opprinnelige pre-launch-rapporten.

Offentlig lansering blokkeres likevel av konkrete forhold og manglende driftsavklaringer:

1. **Kontosletting vil avvises fra Pages med dagens utviklingsoppsett.** OPTIONS fra `https://jya2002.github.io` gir **403**, mens lokal origin gir 204. Dette er en bekreftet origin-konflikt, ikke bare manglende testing.
2. **Kontakt og personvernerklæring er uferdige.** Offentlig kontaktadresse er tom; nettsiden viser uttrykkelig et personvernutkast uten ferdig behandlingsansvarlig/grunnlag.
3. **Retensjon er implementert, men ikke dokumentert som driftssatt.** `cron.job` er ikke installert i utviklingsprosjektet, og ingen ekstern/manuell driftsrutine er verifisert. Kosthensyn er fortsatt tilgjengelig i påmeldingen.
4. **Releasegrunnlaget er uferdig.** Denne checkouten har 0 commits og 0 Git-remotes. Faktisk GitHub CI, Pages-variabler og deployment-beskyttelse kan derfor ikke bekreftes her. Den lokale UI-suiten har dessuten **to feil**.
5. **Endelig produksjonsmiljø og offentlig OAuth-flyt er ikke verifisert.** Lokal Google-innlogging og simulert Pages-retur erstatter ikke kontroll av faktisk tillatt redirect, Google Cloud-oppsett og offentlig inn-/utlogging.

**Begrenset studentpilot:** CONDITIONAL GO først etter at P0-kriteriene i denne rapporten er oppfylt. Det er ikke en pilotgodkjenning i dagens tilstand. En pilot kan være tekstbasert og bruke Google + in-app-varsler uten arrangementsmailer; bildeopplasting og e-post må da avgrenses tydelig som utilgjengelige/uverifiserte. Offentlig bred lansering krever også avklaring av relevante P1-funn.

**Anbefalt første tiltak:** Fastsett hvilket Supabase-prosjekt som skal betjene den offentlige siden. Klargjør deretter en separat godkjent endring av `account-delete` sin tillatte origin til den valgte offentlige origin, med kontroll av andre funksjoner og lesende preflight. Ikke bytt utviklingsorigin før miljøvalget er besluttet. Dette lukker den tydeligste bekreftede tekniske P0-feilen; øvrige P0-oppgaver må fortsatt løses.

## 2. Grunnlag og bevisnivå

Vurderingen bygger på kildekode, alle ti migrasjonsfiler, workflow-filer, eksisterende dokumentasjon, nye lokale testkjøringer og lesende Supabase-kontroller. Eldre dokumenter har historiske formuleringer som «ikke kjørt», selv om senere brukermeldinger/resultater bekrefter testing. De skal ikke brukes som en samlet, oppdatert lanseringsstatus. Denne rapporten skiller bevisene slik:

| Bevisnivå | Hva det kan underbygge | Hva det ikke underbygger |
| --- | --- | --- |
| Ny lokal komponent-/mocktest | React-flyt, validering, synlighet, cache og feilhåndtering | Ekte Google, Supabase RLS eller levering av e-post |
| Ny lokal PostgreSQL-test | Virkelige SQL-låser, transaksjoner, constraints, grants og RLS i isolert database | Full hosted Auth, PostgREST, Storage API eller Edge-runtime; Auth/Storage er shims |
| Ny lesende utviklingskontroll | Faktiske funksjonskropper, grants/policies, offentlig provider-status, CORS og nåværende metadata | Nye autentiserte skriveflyter, Google Cloud-konsoll eller produksjonsmiljø |
| Tidligere dokumentert ekte test | Det konkrete testomfanget og tidspunktet som er oppgitt | Automatisk verifikasjon av senere miljøer/konfigurasjoner |
| Brukerbekreftet UI + lesende etterkontroll | En faktisk manuell flyt og dens verifiserte sluttilstand | Agentobservert eller automatisert nettleserhandling |

Ingen ny live-integrasjonstest med skriving er kjørt. Ingen sikkerhetskontroll beskrives som en full sikkerhetssertifisering.

## 3. Funksjonsoversikt

«Ferdig» nedenfor gjelder funksjonell implementasjon og oppgitt testgrunnlag, ikke automatisk offentlig produksjonsgodkjenning.

| Område | Status | Konkret bevis / restarbeid |
| --- | --- | --- |
| Forside, navigasjon og tomtilstander | Ferdig implementert | Mock-/demo- og designprøver består, inkludert manglende arrangementer/forslag. Ingen hardkodet demohendelse presenteres som ekte når backend er koblet til |
| Arrangementsliste, søk, kalender, detaljer | Ferdig implementert | Desktop/mobil og Oslo-månedsskifte testet lokalt. Faktisk innhold og datoer må godkjennes før åpning |
| Medlemsinformasjon og søknad/status | Ferdig implementert | Søk på Min side, pending/approved/rejected, styrebehandling og RLS testes. Medlemskap tildeler ikke privilegert rolle |
| Om oss og kontakt | Delvis ferdig | Om-tekst og kontaktskjema finnes; student→styre→behandlet er mocktestet. Offisiell kontaktadresse mangler i utviklingsdatabasen |
| Styre/team | Mangler egen presentasjon | Ingen egen styre-/teamoversikt eller teamrute funnet. Kontakt styret finnes; dette er et innholds-/scopepunkt, ikke en ødelagt administrasjonsrolle |
| Google OAuth | Ferdig lokalt / delvis produksjonsverifisert | Primær knapp, PKCE, studentrolle og retursti. Brukeren har bekreftet ekte inn-/utlogging. Google-provider er aktiv ved ny GET-kontroll. Endelig offentlig flyt gjenstår |
| Sesjon, rolleoppslag og utlogging | Ferdig implementert | Query-cache tømmes ved kontobytte/utlogging; rolle leses fra `user_roles`, feil gir trygg fallback. Mocktester dekker feil og isolasjon mellom kontoer |
| Min side, profil, medlemskap, historikk | Ferdig implementert | Sammenhengende mocktest av medlemskap, arrangement, forslag og stemmer. Ingen ny ekte profilskriving utført nå |
| Brukerens dataeksport | Implementert / delvis integrasjonstestet | SQL-eksport av bare egne data er lokalt testet. Faktisk eksportnedlasting med ekte konto/offentlig miljø er ikke verifisert i denne revisjonen |
| Kontosletting | Ferdig i utvikling; offentlig blokkert | Tidligere 5/5 ekte Edge-kontroller med Auth/database/Storage/opprykk. Brukeren har også rapportert manuell Google-/Min side-sletting; ny lesende kontroll finner tidligere Auth-konto/profil borte, 0 kontrollerte personrader og 0 egne Storage-objekter. Pages-origin avvises fortsatt |
| Opprette/redigere arrangementer | Ferdig implementert | Admin-UI, lagring og ny innlasting testet med mocks. Sted-feltets skriving/innliming og dialogfokus består. Historisk ekte nettleserprøve er rapportert av brukeren |
| Publisering, avpublisering, avlysning | Ferdig implementert | Eksisterende status- og varseltriggere, servervalidering og UI. Ekte mottak av avlysningsmail er ikke testet; worker er av |
| Påmelding, avmelding, kapasitet, venteliste | Ferdig implementert | 19 målrettede lokale PostgreSQL-kontroller, også 20 samtidige kall og frist etter låseventing. Tidligere 8 ekte API-tester og full nettleserprøve er brukerbekreftet |
| Lag og grupper | Ferdig SQL/UI; delvis live-dekning | Ekte lokal lagstørrelse/FK/målgruppe- og medlemskontroll. Ingen ny hosted nettlesertest av kaptein, lagbytte eller gruppetildeling nå |
| Permanent sletting av tomt utkast | Ferdig og manuelt integrasjonstestet i utvikling | Migrasjon 010 er aktiv. Brukeren slettet det ene testutkastet i dialogen. Fase 2 bekreftet nøyaktig én DELETE, riktig admin og uendret baseline. 20 SQL-/6 komponent-/18 mocknettleserkontroller finnes |
| Historiske arrangementer/deltakere | Delvis driftsklart | Event-rader og audit beholdes ved utkast-sletting; tilknytninger sperrer. Personlige deltakerdata har egne 7/180-dagersfrister, men faktisk drift av retensjon er ikke verifisert. Eget arkivfelt finnes ikke |
| Styreportal og revisjonslogg | Ferdig implementert | Student avvises; styret kan administrere ordinært innhold, bare admin endrer roller/sletter tomme utkast. Aktør/ID/tidspunkt for ekte utkast-sletting er verifisert |
| Forslag | Ferdig implementert | Innsending, én stemme/tilbaketrekking, fem statuser, moderering, skjuling og anonym feed. Ny lokal RLS-test består; tidligere 6 ekte community-tester er brukerbekreftet |
| Avstemninger | Ferdig implementert | Opprett/publiser/endret periode, én stemme, målgruppe, skjulte resultater og frist etter lås. Lokal PostgreSQL + mockflyt og tidligere brukerbekreftet community-API-test |
| In-app-varsler | Ferdig implementert | Registrering, avmelding, opprykk, endring og «lest». Tidligere ekte opprykkskontroll. Automatisk sanntidsoppdatering uten refetch/omlasting er ikke dokumentert |
| Påminnelser og automatisk vedlikehold | Ikke aktivert/verifisert i drift | Funksjon og oppskrift finnes; ingen installert `cron.job` i gjennomgått prosjekt, og notifications-endepunktet svarer 404 |
| Arrangementsbilder | Delvis ferdig; ikke aktivert hosted | Frontend kaller autorisert `image-upload`; kildekoden har rolle-, origin-, størrelse-, signatur- og kvotekontroll. Endepunktet svarer 404, så ekte opplasting er utilgjengelig med dagens prosjekt |
| Profil-/forslagsbilder | Implementert / delvis live-verifisert | Direkte Storage med eierskap og kvoter. Personlige testbilder ble verifisert i tidligere account-delete-test; full UI-opplastings-/kvoteflyt er ikke hosted-testet nå |
| Auth-e-post / arrangementsmailer | Delvis implementert / ikke leveransetestet | E-postalternativet vises fortsatt bak «Andre innloggingsmåter». Aktiv e-postprovider betyr ikke fungerende SMTP. Resend-worker er ikke deployet; Google aktiverer ingen e-postsending |

## 4. Sikkerhets- og personvernvurdering

### 4.1 Kontroller med konkret bevis

- **RLS er aktiv på alle 23 gjennomgåtte public/private-tabeller.** Metadata viser ingen anonyme INSERT/UPDATE/DELETE-tabellrettigheter. Klientene har ikke generell DELETE på events. Vanlige brukere kan ikke skrive medlemsstatus, rolle, påmelding eller stemmer direkte; relevante RPC-er kontrollerer callerens ekte UID. Kolonnebegrensede profil-/preferanseoppdateringer er fortsatt tillatt under eierpolicy.
- **Ti anonyme GET-kontroller** mot profiler, roller, medlemskap, registreringer, rå forslag, begge stemmetabeller, varsler, kontakter og audit ga **401**, uten private rader i resultatet. Dette er en anonym tilgangskontroll, ikke en ny full matrise med autentiserte hosted roller.
- **42 migrasjonsdefinerte funksjonskropper** matcher siste lokale definisjon etter normalisering av linjeskift/whitespace. Execute-grants, `SECURITY DEFINER`/`search_path` og policyuttrykk er lest. Følsomme service-RPC-er for vedlikehold/e-post har ikke klient-execute. Offentlige aggregat-/feedfunksjoner er bevisst tilgjengelige.
- **Rollegrensene testes reelt i lokal PostgreSQL.** Student kan ikke selvpromotere, godkjenne medlemskap, endre andres påmeldinger eller manipulere stemmer. Styret har ordinær administrasjon, men ikke adminfunksjonene. Google-lignende brukerredigerbar metadata gir studentrolle, ikke administrator.
- **Kapasitet og venteliste bruker låsing og constraints.** En unik `(event_id,user_id)` beskytter duplikater. Fristene kontrolleres med veggklokke etter låsen i oppdatert påmeldings-/pollfunksjon. Det er ikke funnet en ny kapasitets-/autorisasjonsfeil i denne revisjonen.
- **Kontosletting:** eksplisitt Auth-validering, egen bruker-ID, bekreftelse, siste-administrator-vern og maks 15 minutters faktisk sesjonsautentisering, også OAuth-AMR. Oppfrisket token alene er ikke nok. Fire gjennomgåtte deploykildehashverdier er fortsatt uendret. Storage/Auth er ikke én atomisk transaksjon; allerede fjernede bilder gjenopprettes ikke automatisk ved senere feil.
- **Utkast-sletting:** én ekte manuell prøve er ferdigverifisert, med bevart audit. Guardene dekker alle fire nåværende event-FK-tabeller; bilder slettes ikke, og klienten bruker ingen tabell-DELETE som reserve.
- **Hemmelighetsskann:** 153 ikke-ignorerte kildekandidater (inkludert denne rapporten) og 19 bygde filer ble skannet ved sluttkontrollen, uten funn av gjenkjennelige eller lokalt konfigurerte serverhemmeligheter. Miljøfiler, runtime, eksport og testresultater er ignorert. Buildvalideringen avviser servernøkler i `VITE_`; 4 offline konfigurasjonstester inngår i de 67 Node-testene. Dette er ikke en garanti for fremtidig staging eller vilkårlige ukjente hemmeligheter.
- **Avhengigheter:** `npm audit --json` rapporterte **0 kjente sårbarheter** i det aktuelle låsetreet, også utviklingsavhengigheter. Det er ingen garanti mot ukjente feil eller en full forsyningskjederevisjon.

To private hjelpefunksjoner av trigger-type har fortsatt standard execute for anon/authenticated. De kan ikke kalles som vanlige SQL-funksjoner og ligger utenfor lokalt eksponerte API-skjemaer; dette er **ikke påvist som en omgåelse**. Unødvendige grants kan vurderes ved en separat, godkjent minsteprivilegium-gjennomgang. Ingen grants er endret nå.

### 4.2 Personvern og driftsgrenser

**Bekreftet uferdig:** `src/pages/Info.tsx` viser et uttrykkelig personvernutkast, og databaseinnstillingen for kontakt er tom. `docs/PRIVACY.md` er et implementasjonsgrunnlag, ikke et vedtatt behandlingsgrunnlag. Behandlingsansvarlig, support-/rettighetskontakt, formål/grunnlag, leverandører/regioner, sletting, backup og klagerutine må fastsettes av ansvarlig før studentdata samles inn offentlig. Ingen juridisk godkjenning gis her.

Kosthensyn er valgfritt og samtykkebeskyttet både i skjema og database, men kan røpe helse/religion. Funksjonen fjerner kosthensyn ved avbestilling og via vedlikehold etter 7 dager; registreringer etter 180 dager, kontakter etter 90, varsler etter 180 og audit etter 365 dager. **SQL-funksjonens eksistens er ikke bevis for at fristene håndheves i drift.** Ingen oversittende kosthensyn ble funnet nå, men databasen har ingen registreringer, så dette er ikke en reell retensjonstest på gammel brukerdata.

`notifications`-worker kaller vedlikehold og kan senere sende e-post. Retensjon må kunne driftes uten at et godkjent nei til e-post blir et nei til sletting. En separat vedlikeholdsplan eller en ansvarlig, testet manuell prosess er mulige tiltak etter godkjenning. Scheduler, worker og e-post er ikke aktivert i denne revisjonen.

### 4.3 Viktige avgrensninger og risikoer

| Forhold | Klassifisering og vurdering |
| --- | --- |
| Alle Google-kontoer er ikke UiO-studenter | Bekreftet produktgrense. Medlemskap/grupper må brukes når adgang skal avgrenses; ingen Feide-/studentverifisering finnes |
| `audience=members/groups` | Begrenses i påmeldings-RPC, mens publiserte arrangementsmetadata er offentlig lesbare etter dagens policy. Ikke legg hemmelige steder, deltakerdata eller intern informasjon i slike beskrivelser. Dette er ikke påvist som en feil i den dokumenterte modellen |
| Anonyme forslag | Offentlig feed skjuler navn og personlig bildesti. Styret kan se forfatter internt; selvidentifiserende fritekst er fortsatt mulig. «Anonymt» betyr ikke anonymt overfor styret |
| Pollresultater | `hide_results` beskytter frem til stenging, med styreunntak. Medlemsmålgruppe begrenser stemmegivning; synlige aggregater er ikke private medlemsdata. Individuelle stemmer er isolert |
| Offentlige bilde-buckets | Alle tre er public, med 4 MB-grense og JPEG/PNG/WebP. Forslagslisting er eier/styrebegrenset, men en kjent offentlig fil-URL er fortsatt offentlig. Dette samsvarer med [Supabase sin bucket-modell](https://supabase.com/docs/guides/storage/buckets/fundamentals). Ingen sensitive bilder skal brukes |
| Misbruk/spam | RPC-kvoter finnes per konto/time, eksempelvis 8 forslag, 5 kontakter og 5 medlemskapshandlinger. Dette begrenser ikke alle mislykkede/tilbakerullede forsøk eller distribuerte Google-kontoer. Globale Auth-/IP-grenser, CAPTCHA-behov og varsling er ikke kontrollert i Dashboard; ingen belastnings-/angrepstest er utført |
| Sesjoner og nettleserlagring | Supabase-sesjonen lagres i localStorage. Cache-isolasjon er testet. XSS/delte enheter og stjålne JWT-er krever ordinær driftssikkerhet; Auth-kontosletting lover ikke umiddelbar kryptografisk ugyldiggjøring av enhver tidligere JWT ved alle stateless endepunkter |
| Permanent sletting etter tidligere publisering | Funksjonen krever nåværende `draft` og ingen tilknytninger, ikke «aldri tidligere publisert». Dette er uttrykkelig dokumentert. Hvis et historisk arrangement senere avpubliseres og personrader er retensjonsslettet, må styret bevare historikken gjennom rutiner eller godkjenne et sterkere fremtidig vern |
| Identifikatorer i arbeidsdokumenter | Enkelte eksisterende dokumenter inneholder en ekte administrators UUID. Det er ikke en hemmelig nøkkel, men er en unødvendig kobling til en person i et mulig offentlig repo. Gjennomgå/rediger offentlig dokumentasjon før første staging; behold detaljerte kvitteringer privat |
| MFA, backup og drift | Ikke verifisert: prosjektadministratorenes MFA, overlevering, gjenopprettingsøvelse, kvote-/kostnadsvarsler, leverandørloggretensjon og personvernansvar. Det finnes ikke grunnlag for å merke disse bestått |

## 5. GitHub Pages og produksjonsmiljø

### 5.1 Bekreftet lokalt

- `vite.config.ts` bruker `scripts/frontend-config.mjs`. Produksjonsbase er `/pluss-minus-null-stress/`; usikre URL-understier og manglende offentlig backendkonfigurasjon avvises. Utvikling bruker `/`.
- `src/main.tsx` bruker `HashRouter`. Lokal produksjonspreview består direkte åpning, refresh og navigasjon under repo-stien. JS/CSS-assetlenker får riktig base. Logo/favicon og lokal Fraunces-font inngår i builden; ingen ekstern fonttjeneste brukes.
- OAuth-knappen setter `redirectTo=origin+pathname`, uten hash. Callback fanges før SDK/Router, renser kode/token/feil fra URL og utveksler PKCE én gang. Retursti valideres og har tidsgrense. Avbrutt/ugyldig/utløpt callback og manglende verifier er lokalt testet.
- `DEV` + eget flagg begrenser passordinnlogging til utvikling. Pages-produksjonsprøven bekrefter at passordskjemaet ikke er tilgjengelig, mens Google er primærvalg.
- Den manuelle Pages-workflowen har `workflow_dispatch`, `configure-pages`, Pages-artifact og `deploy-pages`, samt `pages:write`, `id-token:write` og `github-pages`-environment. Den har ikke automatisk deploy på push. Strukturen følger [GitHub sin dokumenterte arbeidsflyt](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

### 5.2 Bekreftede miljøavvik og ukjente innstillinger

| Kontroll | Resultat / betydning |
| --- | --- |
| Faktisk planlagt Pages-adresse | GET ga **404**. Det bekrefter at en fungerende offentlig side ikke er verifisert; det er forventelig før godkjent deploy, ikke bevis for en feil i HashRouter |
| Kontosletting fra lokal origin | OPTIONS **204**, eksakt `Access-Control-Allow-Origin: http://127.0.0.1:5173`; GET 405 |
| Kontosletting fra Pages-origin | OPTIONS **403**, allow-origin `null`. Dagens funksjon godtar ikke offentlig klient. Ingen autentisert POST ble sendt |
| Produksjonsprosjekt | Ikke valgt/verifisert her. `.env` peker til utviklingsprosjektet. Det må være et eksplisitt valg om separat produksjonsprosjekt eller en avgrenset pilot mot det eksisterende prosjektet |
| Offentlig Supabase redirect | Ikke lest fra privat Auth-konfigurasjon. Må kontrolleres som eksakt `https://jya2002.github.io/pluss-minus-null-stress/`, med avsluttende skråstrek. En aktiv Google-provider bekrefter ikke denne allowlisten |
| Google Cloud | App audience, publiseringsstatus, produksjonsklient, branding/support-/personvernlenker og faktiske origin-/callbackverdier er ikke kontrollert i Cloud-konsollen |
| GitHub-tilstand | 0 lokale commits og 0 Git-remotes. Ingen remote CI, repo-variabler, Pages-source, branch-regler eller required reviewers er verifisert |
| Release-gates | Pages-workflowen kjører typer/lint/Vitest, men avhenger ikke teknisk av Verify-workflowens PostgreSQL/Playwright-resultat. `workflow_dispatch` og et environment-navn alene beviser ikke reviewer-/branch-beskyttelse |

Supabase-redirecten må matche den valgte frontend-adressen; produksjonsverdier bør være eksakte, jf. [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls). Google sin callback er til **Supabase** (`https://<valgt-prosjekt>.supabase.co/auth/v1/callback`), ikke direkte til HashRouter. Se [Supabase Google-oppsett](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

Google Cloud-status må ikke gjettes ut fra én fungerende konto. Samtidig skal det **ikke** automatisk påstås at Testing blokkerer alle utenfor testlisten: Googles oppdaterte veiledning beskriver et unntak for bare grunnleggende `openid/email/profile`, som appen ber om. Kontroller faktisk klient og eventuelle ekstra scopes før en konklusjon om målgruppen trekkes. Se [Google OAuth app state](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview). Google-produksjonspolicy og eventuelt skille mellom test-/produksjonsklient må vurderes av prosjektansvarlig; ingen nytt domene- eller tjenestekjøp er besluttet her.

Den gjeldende `dist` er produsert med **fiktiv** backend `https://pmns-ui.supabase.co` og offentlig testnøkkel. **Den skal ikke publiseres som en fungerende produksjonsbuild.** En senere release må bygges fra godkjent commit med valgt prosjekt og riktig offentlig nøkkel. Service-/secret-nøkler skal aldri i GitHub Pages-variabler med `VITE_` eller i frontend.

## 6. Database og migrasjonshåndtering

Ny lesende gjennomgang viser:

- Alle **42 forventede funksjonskropper** fra repositoryets migrasjoner samsvarer med faktisk utviklingsdatabase etter whitespace-normalisering. Det gjelder også rettingene av vedlikehold, påmeldingsfrist, forslagsanonymitet, pollfrist og utkast-sletting.
- Alle **23 public/private-tabeller** i katalogkontrollen har RLS aktivert. Faktiske tabellgrants, policies, standardrettigheter og applikasjonstriggere er lest. De tre bilde-bucketene har forventet public-status, filtyper og størrelse. Event-FK-tabellene er fortsatt `event_access_groups`, `event_registrations`, `event_teams` og `notifications`.
- `supabase_migrations.schema_migrations` **finnes ikke**. Dermed er ingen anvendt versjonsrekkefølge attestert gjennom CLI-historikk, selv om funksjonsfingeravtrykk og sentrale objektkontroller samsvarer.
- Migrasjon **010 er allerede manuelt installert**. Kilde-SHA-256 er uendret: `13c2b0ce19f57f4f5b8f85f5a9a5fafbd0d4a9e08c18a4b0932a79a2dc0ba1b2`. Den skal ikke kjøres igjen i dette prosjektet.
- Baseline er fortsatt **3 arrangementer, 0 påmeldinger og 27 revisjonsrader**, med samme arrangementsfingeravtrykk som før den godkjente utkasttesten. Nåværende hendelsesstatuser er 2 published / 1 cancelled. Ingen innholdsrader er endret i revisjonen.

Dette er en omfattende, men **ikke fullstendig kanonisk schema-diff** av alle kolonner, indekser, Supabase-systemobjekter og leverandørinnstillinger. Funksjonslikhet alene beviser ikke likhet for enhver constraint eller standardprivilegium. Ingen nytt funksjonskroppsavvik ble funnet; det bekreftede migrasjonsavviket er historikken.

**Trygg fremgangsmåte senere, uten utførelse nå:**

1. Lag en godkjent backup-/gjenopprettingsplan og et metadatauttrekk for valgt miljø.
2. Sammenlign faktiske objekter, policies, grants, indekser og triggere med en ren lokal anvendelse av 001–010. Kartlegg hvilke versjoner som faktisk er installert; ikke utled alt fra filnavn eller historikkfravær.
3. Gjennomgå en konkret plan for å registrere allerede anvendte versjoner som anvendt **uten å kjøre SQL på nytt**, etter separat godkjenning.
4. Kontroller plan/dry-run for neste migrasjon. Den skal inneholde bare den nye, godkjente endringen. Stopp hvis 001–010 foreslås kjørt igjen.
5. Ved nytt, tomt produksjonsprosjekt brukes en egen kontrollert førstegangsprosess. Ikke reset/seed eller gjenkjør hovedoppsettet mot det eksisterende utviklingsprosjektet.

Ingen `db push`, `migration up`, `migration repair`, schema-reset eller migrasjons-DDL er kjørt mot Supabase som del av denne revisjonen.

## 7. Design, tilgjengelighet og ytelse

### Gjennomført kontroll

Det eksisterende Null-fjeset-designet er konsistent i kildekoden: solgul bakgrunn, mørkelilla tekst/konturer, krem/mint-kort, rosa detaljer, SVG-merke/favicon, lokal Fraunces og sans-serif til løpende tekst. Datatunge adminflater er rette og mer nøkterne enn forsideplakatene. Fokusmarkeringer, skiplink, dialogfokus, Escape/tilbakeføring av fokus og reduced-motion-regler finnes.

De lokale nettleserprøvene dekker offentlige sider, Google-/passordskjema, Min side, forslag/polls, alle adminfaner og skjemadialoger på desktop og emulert mobil. Dedikerte responsive tester dekker 320 px; designprøver dekker 320/390/768/1024/1440 px. Axe med WCAG A/AA-tags til og med 2.2 inngår i responsive/offentlige/Auth-/dialogprøver og ga ingen oppdagede regelbrudd i de beståtte kjøringene.

**Visuell kontroll er avgrenset:** Agenten har i denne runden sett genererte PNG-er av desktopforsiden, mobilforsiden/feilbildet og det fremhevede kortet ved 320 px. Dette er mockdata, ikke en manuell gjennomgang av brukerens Chrome-fane eller alle autentiserte sider. Skjermleser, reell Safari/iOS, Android, 200–400 % zoom og faktisk nettverkshastighet er ikke manuelt verifisert. Ingen full WCAG-erklæring kan gis.

### Bekreftet test-/layoutavvik

`tests/ui/launch-regressions.spec.ts:133` feiler i begge prosjekter ved 320 px:

- forventet tekstboksbredde minst **274 px**;
- målt `.featured` clientWidth **276 px**, `.featured-copy` **236 px**;
- isolert produksjonspreview bekrefter at `.container` sine mobile **20 px padding på hver side** også gjelder `.featured`; tekstboksen har i tillegg **26 px padding** på hver side;
- faktisk tittelinnhold får **184 px** bredde ved 320 px. Den prøvde tittelen bruker omtrent **3 linjer**, og siden har ingen vannrett overflow. Ved 390 px er tittelinnholdet 254 px, fortsatt omtrent 3 linjer.

Dette er et **bekreftet avvik mot den eksisterende layoutkontrakten og en rød CI-test**. Det er ikke dokumentert som tap av funksjonalitet eller uleselig tekst. Designansvarlig må velge om dobbel padding skal fjernes/justeres, eller om den nåværende avstanden er tilsiktet og regresjonskravet er foreldet. Ikke slett eller slakk testen uten den vurderingen. Ingen retting er utført.

På 320 px er dekorativ plakattekst også beskåret inne i kortet; det er visuelt observert, men gjelder ikke en handlingsknapp eller arrangementsinformasjon. Langt arrangementsnavn kan deles midt i et ord i listekortet. Dette er P2-polering dersom designet godkjennes.

### Ressurser og lastetid

Produksjonsbuilden lykkes uten chunk-størrelsesadvarsel. Viktige størrelser fra faktisk build:

| Ressurs | Rå / gzip |
| --- | --- |
| Hoved-JS | 239,45 / 75,01 kB |
| Delt UI-chunk | 308,00 / 86,96 kB |
| Schema-chunk | 83,48 / 24,31 kB |
| Admin-chunk, lazy | 35,96 / 9,76 kB |
| CSS | 41,22 / 9,66 kB |
| Lokal Fraunces | 67,30 kB |
| Google G-asset | 33,66 kB, vist i 20×20 px |

Ruter er lazy-lastet, og arrangementsbilder bruker lazy loading. G-assetet kan optimaliseres senere uten å forvrenge Googles merkevare. Tallene over er filstørrelser, **ikke målt LCP/INP/CLS eller lastetid**. Ingen Lighthouse-/Core Web Vitals- eller produksjonsytelsesbenchmark er kjørt; dette er særlig relevant før store mengder arrangementer/forslag. Offentlige lister paginerer teknisk, men samler hele resultatet i klientminnet. Overvåk volum før en bred lansering.

## 8. Tester og faktisk dokumentasjon

### 8.1 Kjøringer i denne revisjonen

Node **24.22.1**, lokal PostgreSQL **18**, installert Chrome. CI beskriver PostgreSQL 17; faktisk GitHub-kjøring er ikke gjort. Windows-kommandoene brukte Node fra `.runtime/node-v24.22.1-win-x64` og `npm.cmd`.

| Kommando / kontroll | Bestått | Feilet | Hoppet over | Hva resultatet betyr |
| --- | ---: | ---: | ---: | --- |
| `npm.cmd run typecheck` | OK | 0 | 0 | TypeScript strict/buildprosjekt |
| `npm.cmd run lint` | OK | 0 | 0 | ESLint på eksisterende prosjekt |
| `npm.cmd test` | **62** | 0 | 0 | 10 Vitest-filer; komponenter, Auth/callback, skjemaer, utils; ingen ekte backend |
| `node --test tests/scripts/*.test.mjs tests/edge/*.test.mjs` | **67** | 0 | 0 | Faktisk account-delete-handler med simulerte tjenester, fixture-/cleanup-/prosjektgrenser og frontendkonfigurasjon |
| `node scripts/test-db.mjs` | **39** | 0 | 0 | Ekte lokal PostgreSQL med Auth/Storage-shims |
| `node scripts/test-db.mjs --registration` | **19** | 0 | 0 | Kapasitet, samtidighet, frist, FIFO, roller/RLS |
| `node scripts/test-db.mjs --community` | **35** | 0 | 0 | Medlemskap, anonyme forslag, stemmer, polls, frister og RLS |
| `node scripts/test-db.mjs --google-auth` | **6** | 0 | 0 | Studentrolle og ingen metadata-eskalering i lokal database; ikke ekte OAuth |
| `node scripts/test-db.mjs --account-delete` | **6** | 0 | 0 | Cascades, siste admin, rolleendringsrace, anonymisering og opprykk |
| `node scripts/test-db.mjs --event-delete` | **20** | 0 | 0 | Sikker, transaksjonell utkast-sletting, audit, rollback og samtidige FK-er |
| `npm.cmd run test:e2e -- --config playwright.ui.config.ts --workers=2` | **78** | **2** | 0 | 80 desktop-/mobilinstanser med simulerte API-er; begge feil gjelder samme kortbreddekrav |
| `npm.cmd run build` med Pages-base/fiktiv backend | OK | 0 | 0 | Lokal produksjonskompilering, ikke offentlig deploy |
| `npm.cmd run test:pages -- --workers=2` | **10** | 0 | 0 | Lokal produksjonspreview, hash-ruting, refresh, assets og Google/PKCE success/cancel/invalid med mocks |
| `npm.cmd run test:e2e -- --workers=2` med E2E_PORT=5183 og ekte backend tom | **8** | 0 | **2** | Offentlig demo/kalender/navigation/axe. Full lokal Supabase-stack mangler; to autentiserte backend-instansprøver hoppes eksplisitt over |
| Isolert PNG-/breddediagnose | OK, 3 bredder | 0 | 0 | 320/390/1440 px, fake backend, ingen uventede eksterne kall; ikke en ekstra full brukerflyttest |
| `node scripts/prelaunch-audit.mjs` | Ingen funn | 0 | 0 | 153 kildekandidater + 19 buildfiler ved sluttkontrollen, Git-status og ignorering |
| `npm.cmd audit --json` | 0 kjente sårbarheter | 0 | 0 | Registerbasert advisory-kontroll; ingen `audit fix`/installasjon |

Databasekjøringene bruker eksplisitt `TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/postgres`. Hver suite opprettet og fjernet sin egen `pmns_test_<uuid>`-database. Serveren ble startet kun for revisjonen og stoppet etterpå. **125 databasekontroller bestod totalt.** Disse migrasjonsanvendelsene var utelukkende i nye lokale testdatabaser, aldri i ekte Supabase.

Playwright brukte `PLAYWRIGHT_CHANNEL=chrome`. UI-serveren brukte fiktiv `https://pmns-ui.supabase.co` og offentlig testnøkkel. Pages-build og Pages-testprosess brukte samme fiktive URL/nøkkel, `VITE_DEMO_MODE=false` og `/pluss-minus-null-stress/`. Demo-kjøringen hadde E2E_BASE_URL/E2E_SUPABASE_URL/E2E_SUPABASE_SERVICE_ROLE_KEY tomme for å unngå en arvet live-konfigurasjon.

Første Vitest-/Node-oppstart i sandkassen feilet med **spawn EPERM**, og Vite viste også feil ved lasting av native Tailwind-avhengighet under denne oppstarten. De uendrede kommandoene bestod med nødvendig lokal prosessadgang; ingen avhengighet eller konfigurasjon ble installert/reparert. Dette er oppstartsbegrensninger, ikke ekstra funksjonsfeil. De **to faktiske Playwright-assertionfeilene står fortsatt åpne**. Ingen tester er omskrevet eller ignorert for å få grønt resultat.

Ingen ny Deno-runtime/typekontroll er kjørt; Deno er ikke tilgjengelig på gjeldende PATH. Tidligere Deno-check er dokumentert i [ACCOUNT_DELETE.md](ACCOUNT_DELETE.md). Hele hosted Edge-runtime er ikke emulert av Node-handler-testene.

### 8.2 Nye kun lesende Supabase-/nettverkskontroller

- `supabase db query --linked --project-ref gawhbppuhnixqvhnnpnn --file .runtime/launch-review-read.sql --output json`: READ ONLY-katalog-/aggregatkontroll; 42/42 funksjonskropper samsvarer, 23 RLS-tabeller, ingen historikktabell, cron ikke installert, kontakt ikke konfigurert.
- GET `/auth/v1/settings`: **200**, Google/email/signup aktivert. Bare booleans er lagret, ingen klienthemmeligheter.
- Ti private tabeller med anonym offentlig nøkkel: **401**, ingen eksponerte rader.
- GET Edge: `account-delete` **405**, `image-upload` **404**, `notifications` **404**.
- OPTIONS account-delete: lokal origin **204** med riktig CORS; Pages-origin **403** med `null`.
- GET planlagt Pages-adresse: **404**.
- Separat READ ONLY-kontroll av den tidligere manuelt slettede Google-studentprofilen: Auth/profil fraværende, 0 kontrollerte personrader og 0 filer under dens personlige stier. Ingen konto ble slettet i kontrollen.

Private kvitteringer finnes i `.runtime/launch-review-database-result.json`, `launch-review-expected-functions.json`, `launch-review-network.json`, `launch-review-former-account-result.json`, `launch-review-dependency-audit.json`, `launch-review-visual.json` og `prelaunch-audit.json`. De er Git-ignorert. Terminalutdata i denne økten dokumenterer de lokale testantallene; de er ikke GitHub Actions-resultater. Testene er testinstanser på ulike lag, ikke like mange uavhengige produktfunksjoner.

### 8.3 Tidligere ekte tester — ikke kjørt på nytt

| Tidligere resultat | Kilde / bevisgrense |
| --- | --- |
| 8 ekte påmeldings-/venteliste-API-tester og opprydding | Brukerbekreftet; [REGISTRATION_TESTS.md](REGISTRATION_TESTS.md). Ikke en ny kjøring i revisjonen |
| Full ekte Playwright-arrangementsflyt | Brukeren opplyste denne bestått før community-arbeidet. Eldre [BROWSER_TESTS.md](BROWSER_TESTS.md) beskriver fortsatt klargjøringen og må ikke tolkes som en ny testrapport. Ny rå nettleserkvittering er ikke produsert her |
| 6 ekte community-API-tester og opprydding | Brukerbekreftet, registrert i [COMMUNITY_TESTS.md](COMMUNITY_TESTS.md) |
| Google inn, Min side, studentrolle, ut/inn | Brukerbekreftet; [GOOGLE_OAUTH.md](GOOGLE_OAUTH.md). Offentlig Pages/Safari er ikke dermed testet |
| 5/5 ekte account-delete-kontroller, full cleanup | Dokumentert i [ACCOUNT_DELETE.md](ACCOUNT_DELETE.md), med disponibel A/B, bilder, anonymisering og opprykk |
| Manuell Google-/Min side-sletting | Brukeren rapporterte fullført UI-handling og retur til innlogging. Revisjonens nye lesende kontroll bekrefter nå fravær i Auth/profil/personrader/Storage. Ny offentlig nettleserhandling er ikke observert |
| Ett tomt utkast slettet manuelt i admin-UI | [EVENT_DELETION.md](EVENT_DELETION.md) og privat fase 2-kvittering: rad 27 er én korrekt DELETE, opprinnelige data bevart, sluttstatus 3/27 |

### 8.4 Kritisk verifikasjon som gjenstår

- Ekte innlogging, kontobytte, return path, utlogging og nylig Google-innlogging/sletting fra **endelig offentlig origin**, etter separat godkjent konfigurasjon/deploy.
- Lesende + avgrenset autorisert rolle-/API-prøve i det faktisk valgte produksjonsmiljøet; dagens nye kontroller er ikke en hosted JWT-matrise for alle roller.
- Faktisk retensjonskjøring og overvåkning, backup/gjenoppretting og ansvar for eksport/CSV/filer. Slike kontroller krever en konkret, godkjent testplan.
- Hvis funksjonene skal tilbys: hosted `image-upload`, UI-opplasting/eierskap/kvoter og faktisk e-postlevering. SMTP-/Resend-status kan ikke godkjennes ut fra kildekoden.
- Manuell mobil-/skjermleser-/zoomprøve. Emulert mobil i Chrome er ikke Safari eller en faktisk iPhone.

## 9. Prioritert feilliste og anbefalte tiltak

Kompleksitet: **S** = avgrenset endring/kontroll, **M** = flere sammenhengende innstillinger/filer og tester, **L** = drifts-/miljøetablering med flere godkjenninger. Ingen tiltak nedenfor er implementert nå.

### P0 — blokkerer offentlig lansering

| ID | Funn og bevisstatus | Anbefalt tiltak / berørte steder | Kompleksitet og ferdigkriterium |
| --- | --- | --- | --- |
| P0-1 | **Bekreftet:** Pages-origin får 403 fra account-delete | Velg lanseringsbackend. Godkjenn eksakt Edge-origin etter gjennomgang av andre aktive funksjoner; `supabase/functions/account-delete/handler.ts`, Edge-secret `ALLOWED_ORIGIN`, [ACCOUNT_DELETE.md](ACCOUNT_DELETE.md). Ingen wildcard | S–M. OPTIONS 204 med `https://jya2002.github.io`, lokal/endelig origin håndtert som vedtatt; senere disponibel UI-slettetest består |
| P0-2 | **Bekreftet:** personvernutkast og manglende offentlig kontakt | Styret fastsetter kontakt, ansvar, formål/grunnlag, leverandør-/regionvalg og rettighetsrutine. Oppdater `src/pages/Info.tsx`, godkjent `site_settings`-innhold og `docs/PRIVACY.md` | M. Ingen utkast-/«før lansering»-tekst; fungerende kontakt uten krav om innlogging; ansvarlig har vedtatt teksten |
| P0-3 | **Bekreftet manglende prosjekt-cron; ekstern drift uverifisert:** slettefrister kan ikke garanteres | Avtal vedlikehold uten e-postavhengighet, ansvar, overvåkning og backup. `public.run_maintenance`, `supabase/schedule.sql`, notifications-worker, `docs/PRIVACY.md`. Avklar bruk av kosthensyn før oppstart | M–L. Godkjent test viser 7/90/180/365-dagersrutiner; feil varsles til ansvarlig; kosthensyn brukes ikke før dette er sikret |
| P0-4 | **Ikke verifisert:** endelig miljø, offentlig OAuth/redirect og Google Cloud-produksjonsoppsett | Lag konkret miljø-/releaseplan. Kontroller Supabase URL Configuration, Google Cloud, offentlige variabler, `GoogleSignIn.tsx`, `auth-callback.ts`, `docs/GOOGLE_OAUTH.md`/`DEPLOYMENT.md` | M. Ekte vanlig Google-bruker kommer tilbake til riktig repo-sti, får studentrolle, kan logge ut/inn; avbrudd/feil og mobil prøves, uten automatisk e-postfallback |
| P0-5 | **Bekreftet:** ingen commits/remotes og ingen attestert release/CI; UI-suite er rød | Gjennomgå staging (inkludert persondata), etabler godkjent `develop`/remote og grønn Verify. Beskytt release-ref/environment; `.github/workflows/ci.yml`, `pages.yml`, `.gitignore`. Avklar P1-1 før release | M. Godkjent commit, ingen private filer, grønn CI, dokumenterte vars/prosjekt og reviewer/branch-regler. Kun eksplisitt godkjent deploy; offentlig smoke før invitasjoner |

### P1 — viktig før bred åpning / før berørt funksjon tilbys

| ID | Funn og bevisstatus | Anbefalt tiltak / berørte steder | Kompleksitet |
| --- | --- | --- | --- |
| P1-1 | **Bekreftet:** to feilende tester på `.featured-copy`-bredde ved 320 px; ingen overflow i isolert diagnose | Avklar designkontrakten og dobbel padding, rett CSS eller en dokumentert foreldet forventning. `src/styles.css:618`, mobile `.container`/`.featured`, `tests/ui/launch-regressions.spec.ts:133`. Behold meningsfull lesbarhet-/bredde-/overflow-regresjon | S. Begge prosjektinstanser og øvrige responsive tester grønne; visuelt godkjent 320/390 px |
| P1-2 | **Bekreftet:** image-upload 404 mens opplastingskontroll finnes | Godkjenn bare relevant deploy/oppsett og disponibel Storage-test, eller vedta en tekstbasert pilot med tydelig utilgjengelig opplasting. `src/lib/api.ts`, `src/pages/Admin.tsx`, `supabase/functions/image-upload/index.ts` | M. Ekte autorisert opplasting og avslag for student/feil origin/format/kvote verifisert før funksjonen tilbys |
| P1-3 | **Bekreftet historikkavvik:** ingen migrasjonstabell; 010 allerede installert | Godkjenn separat objekt-/historikkbaseline etter prosedyren i kapittel 6. `supabase/migrations/001–010`, `docs/EVENT_DELETION.md`, `SUPABASE.md` | M. Neste dry-run forsøker aldri å kjøre gamle migrasjoner igjen; backup- og gjenopprettingsplan foreligger |
| P1-4 | **Uverifisert brukerflate:** e-postalternativet vises, SMTP/levering er uavklart | Vedta Google-only pilot eller leveransetest e-postalternativ etter separat sendegodkjenning. `src/pages/Auth.tsx`, `docs/GOOGLE_OAUTH.md`, `AUTH_AND_DELETION_P0.md` | S–M. Ingen synlig innloggingsmetode lover noe som ikke er verifisert |
| P1-5 | **Uverifisert drift/angrepsvern:** MFA, Auth/IP-kvoter, gjenoppretting og misbruksoppfølging | Gjennomgå Supabase/Google/GitHub-tilganger, rategrenser, driftsansvar og kostnadsvarsler. `docs/SECURITY.md`, SQL-rategrenser, prosjektinnstillinger | M. Ansvarlige og støttevei ved konto-/kvoteproblem dokumentert; ingen automatisk aktivering av CAPTCHA eller endrede kvoter |
| P1-6 | **Uverifisert:** manuell tilgjengelighet og reelle mobilnettlesere | Målrettet Safari/iOS-/Android-, skjermleser- og zoomtest av innlogging, påmelding, avmelding og dialoger. `Layout.tsx`, `ui.tsx`, `Events.tsx`, `Account.tsx`, `styles.css` | M. Kritiske handlinger kan utføres uten mus og med relevante hjelpemidler; ingen skjulte kontroller ved zoom |
| P1-7 | **Bekreftet dokumentasjonsrisiko:** eldre statuskrav er motstridende og arbeidsrapporter inneholder person-UUID-er | Gjennomgå dokumentene før offentlig commit. `docs/TESTING.md`, `DEPLOYMENT.md`, `BROWSER_TESTS.md`, `AUTH_AND_DELETION_P0.md`, `ACCOUNT_DELETE.md`, `EVENT_DELETION.md` | S–M. Google er korrekt primærvalg; gamle SMTP-/«ikke kjørt»-krav merkes historiske; unødvendige personidentifikatorer holdes privat |

### P2 — kan vente etter avklart pilot

| ID | Forhold | Tiltak / berørte steder | Kompleksitet |
| --- | --- | --- | --- |
| P2-1 | Ingen egen styre/team-presentasjon; sosiale lenker tomme | Avklar offentlig innhold med styret; `Info.tsx`, `Layout.tsx`, site_settings | S |
| P2-2 | Statusoppdateringer krever refetch/omlasting; ingen verifisert realtime | Vurder forsiktig polling/realtime og tydelig «oppdater»-handling; `Account.tsx`, queryoppsett | M |
| P2-3 | Mobil dekorasjon beskjæres og lange ord deles | Designpolering, ikke endring av dataflyt; `Home.tsx`, `styles.css`, `EventCard.tsx` | S |
| P2-4 | Ingen målt Core Web Vitals; unødvendig stort G-asset og voksende klientlister | Mål før optimalisering, vurder assetstørrelse, serverfiltrering og lastestrategi; assets, `api.ts`, offentlige lister | S–M |
| P2-5 | Opprydding av foreldreløse/delte bilder og avatar-kvote har begrenset brukerflate | Lag eierskaps-/referansebevarende vedlikeholdsplan, ikke automatisk eventslette-opprydding. `api.ts`, Storage-rutiner, adminbilder | M |
| P2-6 | Ekstra sikkerhetsherding | Vurder minsteprivilegium på triggerfunksjoner, action-pinning og HTTP-headerstrategi. GitHub Pages gir ikke appstyrte respons-headere gjennom en `_headers`-fil. `SECURITY.md`, workflow-filer, hostingvalg | M; ingen nye tjenester er påkrevd uten en konkret risikovurdering |

Ikke gjør valgfri e-post/Resend eller kjøp av domene til et P0-krav når Google + in-app-varsler er vedtatt som pilotomfang. Derimot må funksjoner som faktisk tilbys være ærlig merket og testet.

## 10. Lanseringssjekkliste med akseptansekriterier

### Allerede verifisert i oppgitt omfang

- [x] `develop` brukt; ingen kilde-/backendendringer eller eksterne dataskrivinger under revisjonen.
- [x] TypeScript/lint, 62 Vitest, 67 offline Node-kontroller og 125 lokale PostgreSQL-kontroller består.
- [x] 78/80 isolerte UI-testinstanser består; de to åpne feilene er identifisert, ikke skjult.
- [x] Lokal Pages-produksjonsbuild og 10/10 Pages-testinstanser består med fiktiv backend.
- [x] 8 offentlige demo-testinstanser består; to komplette-stack-instansprøver er ærlig hoppet over.
- [x] 42 forventede funksjonskropper samsvarer; sentrale faktiske grants, RLS, policies, triggere og Storage-metadata er lest.
- [x] Migrasjon 010 er aktiv og skal ikke kjøres på nytt i utviklingsprosjektet.
- [x] Tidligere ekte påmelding/community-resultater, Google-grunnflyt og de to slettescenarioene er dokumentert med deres bevisgrenser.
- [x] Ingen kjente npm-advisories eller gjenkjennelige serverhemmeligheter funnet i gjennomgåtte kildekandidater/build.

### Må lukkes før offentlig åpning

- [ ] Styret har valgt backendmiljø og godkjent konkret konfigurasjons-/releaseomfang. Ingen utilsiktet sammenblanding med utviklingsfixturer eller produksjonsnøkler.
- [ ] Eksakt Pages redirect og Google-oppsett er kontrollert; reell offentlig Google-innlogging/utlogging/retur og studentrolle består etter godkjent deploy.
- [ ] Kontosletting aksepterer valgt offentlig origin, krever nylig innlogging og består en separat godkjent disponibel ende-til-ende-prøve fra den offentlige siden.
- [ ] Offentlig kontakt/personvern er vedtatt og oppdatert; support kan nås uten en fungerende innlogging.
- [ ] Faktisk vedlikeholds-/retensjonsrutine er testet og har ansvarlig/feiloppfølging; kosthensyn brukes bare innen det godkjente personvernoppsettet.
- [ ] Backup/gjenoppretting, administrator-MFA/overlevering og kvotevarsler er dokumentert kontrollert av ansvarlig.
- [ ] De to UI-testfeilene er avklart og rettet etter godkjenning; hele relevante CI-resultatet er grønt på en bestemt gjennomgått commit.
- [ ] Staging inneholder ingen miljøfiler, runtime-kvitteringer, persondata, CSV-er, tokens eller servernøkler; offentlig dokumentasjon er gjennomgått.
- [ ] Pages repository variables, release-ref, reviewer-/environment-regler og riktig offentlig build er bekreftet. Fake-backend-builden publiseres ikke.
- [ ] Den godkjente offentlige builden består asset-/font-/favicon-, deep-link-/refresh-, mobil-/zoom- og tastaturprøve på faktisk Pages-adresse.
- [ ] Opplasting og e-post er enten leveransetestet med egen godkjenning eller tydelig avgrenset som utilgjengelig i det vedtatte pilotomfanget.
- [ ] Fremtidig migrasjonsprosess har en gjennomgått baseline; ingen kommando forsøker å gjenanvende 001–010 i det manuelt oppsatte prosjektet.

**Endelig beslutning:** NO-GO for offentlig lansering nå. Funksjonsfundamentet er godt nok til å arbeide videre mot en avgrenset pilot uten en generell ombygging. Neste runde bør lukke de konkrete P0-portene og den røde layouttesten, etter separat godkjenning; ikke bygge flere funksjoner eller gjøre uautoriserte produksjonsendringer.
