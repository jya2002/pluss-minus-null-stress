# Lanseringsgjennomgang — 24. oktober 2026

**Oppdatert verifikasjon:** Ekte Google/Supabase-innlogging, Min side, studentrolle (uten admin), utlogging og ny innlogging er rapportert bestått av brukeren. Agenten har deretter kjørt én separat godkjent ekte backend-test av [account-delete](ACCOUNT_DELETE.md): 5/5 bestått, inkludert Auth/database/Storage, anonymisering, ventelisteopprykk og fullført testopprydding. Ingen fixture-rester; audit beholdt. Dette oppdaterer de historiske 404-/innloggingsfunnene. Offentlig Pages-origin, mobil og faktisk Google-basert sletting gjennom Min side er fortsatt ikke særskilt bekreftet.

**Senere Auth-beslutning:** [Google OAuth](GOOGLE_OAUTH.md) er nå primærmetoden i frontend og lokalt testet. SMTP er ikke lenger forutsetning for innlogging. Innloggings-P0 i denne gjennomgangen lukkes først med godkjent provideroppsett og faktisk Google/Supabase-prøve; lokal simulering er ikke lanseringsgodkjenning. Kontosletting og øvrige P0-punkter gjelder fortsatt.

**Anbefaling: vent med studentpiloten til punktene P0 nedenfor er avklart.** Kjernefunksjonene har god testdekning og frontend kan bygges for GitHub Pages. Faktisk pilotinnlogging, sletting, kontakt/personvern og driftsrutiner er ennå ikke ferdig verifisert. En intern gjennomgang med eksisterende utviklingskontoer kan fortsette.

Arbeidet er på `develop`. Ingen migrasjoner, live-testdata, Supabase-innstillinger, e-postutsendinger, merge, push eller deploy er utført i denne runden. De eksterne kontrollene var lesende. Node-avhengigheter ble ikke endret.

Oppfølging av innlogging og kontosletting: [AUTH_AND_DELETION_P0.md](AUTH_AND_DELETION_P0.md) beskriver senere lokale rettinger, gratis SMTP-alternativer og nødvendige godkjenninger. De eksterne P0-prøvene er fortsatt ikke utført.

## Verifikasjon og begrensninger

| Kontroll                                         | Resultat                  | Hva resultatet betyr                                                                                                                                          |
| ------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict og ESLint                      | Bestått                   | Også kontrollert etter frontendrettingene                                                                                                                     |
| Vitest                                           | 34/34 bestått             | Full lokal suite; berørte arrangements- og forsidekomponenter kontrollert igjen etter endring                                                                 |
| Node-sikkerhets-/konfigurasjonstester            | 26/26 bestått             | Lokal kjøring; ingen live-fixtures                                                                                                                            |
| Eksisterende UI-suite                            | 32/32 bestått             | Desktop og mobil; simulerte Supabase-svar                                                                                                                     |
| Nye lanseringsregresjoner                        | 8/8 bestått               | Desktop/mobil: kontaktbehandling, frist/status, fremhevet arrangement og tom forslagsliste                                                                    |
| Offentlige demo-/kalender-/tastaturtester        | 8/8 bestått               | Isolert lokal demoservert nettside                                                                                                                            |
| GitHub Pages-produksjonsbuild og ruting          | Build og 2/2 bestått      | Repo-base, asset-responser, direkte lenke, omlasting og navigasjon på desktop/mobil; ingen publisering                                                        |
| Responsive/axe-kontroller                        | 8/8 bestått               | Inngår i de 32 UI-testene; kjørt igjen etter CSS-retting. Desktop, 390 px og 320 px, skjema/dialoger og alle ti adminfaner                                    |
| npm audit, produksjonsavhengigheter              | 0 registrerte sårbarheter | Øyeblikksbilde fra npm; ingen garanti mot ukjente feil. Ingen automatisk oppgradering utført                                                                  |
| Lokal kilde-/buildskann                          | Ingen funn                | Gjenkjennelige servernøkler, service-role JWT-er, komplette private nøkler og kjente lokale serverhemmeligheter ble ikke funnet i kandidatfilene/sluttbuilden |
| Ekte arrangements-API/nettleser og community-API | Brukerrapportert bestått  | Tidligere 8 arrangements-API-tester, ekte nettleserflyt og nå 6 community-API-tester; ikke kjørt om igjen av agenten                                          |

Totalt **50 ulike Playwright-tester bestod på avgrensede kjøringer**: 40 UI, 8 offentlige demo og 2 Pages. Omkjøringer teller ikke som nye tester. Simuleringen verifiserer appens reaksjoner og samspill, ikke reell SMTP, RLS, filopplasting eller PostgreSQL-låsing.

Den samlede UI-flyten lagrer profil, søker medlemskap, viser godkjenning, melder på arrangement, sender anonymt forslag, stemmer på forslag og medlemsavstemning, viser historikken på Min side, endrer varslingsvalg og laster ned egen eksport. Ved utlogging og innlogging som en annen konto vises ikke forrige kontos private historikk. Godkjenningen i denne ene sammenhengende testen er simulert fixture-tilstand; egne tester dekker styrets godkjenning og brukerrettigheter separat.

Automatisk axe-kontroll fant ingen regelavvik på sidene og dialogene som er testet. Tastatur, fokusretur, dialogfokus og 320 px reflow er kontrollert. Visuell gjennomgang av lokale skjermbilder omfattet forside på desktop/mobil, fremhevet arrangement, Min side, forslag/poll, medlemstabell og lange skjemaer. Skjermbildene bruker bare simulerte kontoer.

Interaktiv manuell testing kunne ikke fullføres: nettleserkoblingen hadde ingen tilgjengelig nettleser, og Computer Use-helperen svarte `native pipe is unavailable` også etter gjenoppretting. Visuell skjermbildekontroll er derfor ikke rapportert som manuelle klikk gjennom hele nettsiden. Ekte Safari/iOS, Android, skjermleser og 200/400 % zoom gjenstår. Chromium-mobiltestene er ikke Safari-tester.

## Trygge rettinger i denne runden

1. **Lagret påmelding skjult etter fristen:** Arrangementssiden viste bare «Påmeldingen er stengt» når fristen var passert, selv for en påmeldt student. Bekreftet/ventelistestatus vises nå fortsatt for publiserte arrangementer. Ny påmelding er fortsatt stengt; ingen serverregel er endret. Avlyste og upubliserte arrangementer beholder stengt flyt.
2. **For smalt fremhevet arrangement på mobil:** Teksten brukte bare 85 % av kortet og hadde for stor overskrift. Den bruker nå hele tekstflaten med skalerende overskrift. Regresjonen kontrollerer bredde, linjer og overflow ved 320/390 px.
3. **Tom forslagskolonne på forsiden:** En forening uten forslag fikk en stor tom flate. Den viser nå en invitasjon med fungerende lenke til forslags-/innloggingsdialogen, samt lastetilstand mens innhold hentes.
4. **Utvidet kontaktdekning:** Den eksisterende kontaktfunksjonen er nå testet fra studentens innsending til styrets «Marker behandlet», på begge skjermstørrelser. Ingen ekte melding er sendt.

Tidligere rettinger av feltetiketter, modalfeil, Auth-feilmeldinger og Oslo-kalender fantes allerede ved starten av denne runden. De er gjennomgått og de eksisterende testene bestod; de rapporteres ikke som nye rettinger her.

## Lesende kontroller mot utviklingsprosjektet

Prosjekt: `gawhbppuhnixqvhnnpnn`. Ingen service-role-nøkkel ble sendt til nettleseren eller brukt til å skrive fixtures.

- Events API og Auth-innstillinger: HTTP 200. E-postleverandør og signup er aktivert. Dette beviser ikke e-postlevering eller riktige produksjonsredirects.
- Anonyme GET-forsøk på profiler, roller, medlemskap, påmeldinger, rå forslag, begge stemmetabeller, varsler og endringslogg: HTTP 401. Ingen private rader ble skrevet ut.
- Anonym lesende listing av `suggestion-images`: HTTP 200, null synlige oppføringer. En tom liste alene beviser ikke hele Storage-policyen eller eier-/styretilgangen.
- Offentlig kontaktadresse: ikke konfigurert. Instagram/Facebook er heller ikke konfigurert; de manglende lenkene skjules korrekt. Ingen faktiske kontaktverdier ble skrevet ut i kontrollen.
- Historisk svarte `image-upload` og `account-delete` HTTP 404. Senere ble bare `account-delete` deployet og verifisert med 5/5 ekte backend-kontroller og fullført testopprydding, se [ACCOUNT_DELETE.md](ACCOUNT_DELETE.md). `image-upload` er fortsatt ikke deployet eller reelt verifisert. Personlig Storage i slettetesten er ikke en test av arrangementsbildeopplasting.

De tidligere lokale databasekontrollene og brukerens ekte API-resultater er eksisterende bevis. Ingen database-runner eller ny migrasjon ble kjørt i denne runden. Full inspeksjon av faktisk SQL-definisjon, grants og scheduler er ikke mulig med offentlig nøkkel; bruk de eksisterende lesende readiness-filene dersom den bekreftelsen mangler. Produksjonsprosjektets innstillinger er ikke kontrollert.

## Sikkerhetsgjennomgang

Migrasjonene har RLS på relevante tabeller. Medlemsstatus, registreringer, stemmer og roller skrives gjennom kontrollerte RPC-er; studentenes rå skriverettigheter er begrenset. Rollen hentes fra `user_roles`, ikke brukerredigerbare metadata. Security-definer-funksjonene har fast `search_path` og avgrensede execute-grants. Migrasjon 006/008 kontrollerer frister etter radlås; unique/FK-constraints beskytter registreringer og stemmer. Ingen ny kritisk autorisasjonsfeil ble funnet i kodegjennomgangen. Dette er ingen uavhengig sikkerhetssertifisering.

`verify_jwt=false` for Edge Functions er tilsiktet: bilde-/slettefunksjonene verifiserer token med Auth, origin og nødvendige roller/nylig innlogging selv. Notification-worker krever en separat serverhemmelighet. Ingen av disse tillitsgrensene ble svekket eller omgått.

Serverhemmeligheter ligger bare i lokal, ignorert konfigurasjon/Supabase-secrets. `.env`, `.env.registration-tests.local`, `.runtime`, testresultater og `dist` er Git-ignorert. Vite-konfigurasjonen avviser gjenkjennelige hemmeligheter i alle `VITE_`-verdier og avviser manglende produksjonskonfigurasjon uten eksplisitt demo. Sluttbuilden bruker bare offentlig testkonfigurasjon. Ingen nøkler eller responser med personopplysninger er tatt inn i rapporten.

Git har **ingen commits eller sporede kildefiler** i denne lokale checkouten. Det finnes derfor ingen committed historikk å godkjenne eller GitHub CI-kjøring å vise til. Skannen omfattet de ikke-ignorerte kildekandidatene og buildartefakter; den kan ikke love at en fremtidig `git add -f` ikke legger til en hemmelighet. Før første push må en konkret staging-diff gjennomgås. Opprett ingen commits på `main` som del av denne gjennomgangen.

Storage har offentlige bildeassets, tillatte rasterformater, størrelse-/stibegrensninger og kvoter. Forslagsfeed skjuler anonyme bildestier; migrasjon 009 begrenser listing av forslagsbilder. Offentlige filadresser forblir offentlige, også etter at en adresse er delt, slik [Supabase beskriver bucket-modellen](https://supabase.com/docs/guides/storage/buckets/fundamentals). Ingen deltakerlister eller sensitive opplysninger skal legges i bildeassets. Reell filopplasting, kvoter og sletting via Storage API gjenstår før funksjonene tas i bruk.

## Prioritert lanseringsliste

| Prioritet                          | Oppgave og funn                                                                                                                                                               | Ferdigkriterium / ansvar                                                                                                                                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 — før studentpilot**          | Faktisk produksjonsinnlogging er ikke leveransetestet. Passordskjemaet er kun utvikling og mangler korrekt i produksjonsbuilden.                                              | Prosjektansvarlig godkjenner løsning/oppsett. Test ny og eksisterende student via produsert frontend, faktisk e-post/OTP, redirect, utløpt lenke og mobil. Ikke slå av global e-postbekreftelse eller slå på produksjonspassord som snarvei.                                 |
| **P0 — før studentpilot, backend verifisert i utvikling** | `account-delete` er nå deployet; 5/5 ekte backend-kontroller bestod med Auth/database/Storage, anonymisering, opprykk og fullført fixture-opprydding. Siste-admin-vern er lokalt testet. | Avklar og godkjenn faktisk Google-/Min side-sletting og endelig frontend-origin før pilot. Bekreft drifts-/sletterutine. Den lokale origin-innstillingen dekker ikke offentlig Pages. |
| **P0 — før studentpilot**          | Offisiell kontakt mangler og personvernerklæringen er uttrykkelig et utkast.                                                                                                  | Styret leverer/vedtar behandlingsansvarlig, kontakt, formål/grunnlag, leverandører/regioner og rettighetsrutiner. Oppdater reelt innhold med godkjenning. Ikke publiser oppdiktede kontaktopplysninger.                                                                      |
| **P0 — før persondata samles inn** | Ingen ny verifikasjon av automatisk retensjon, backup/gjenoppretting eller driftsansvar. Cron ble ikke aktivert. Kosthensyn kan være sensitive.                               | Avtal en ansvarlig og en dokumentert, testet manuell eller planlagt slettingsrutine. Ikke ta kosthensyn i bruk før rutinen er sikret. Aktivering av scheduler krever separat godkjenning. Kontroller faktisk region, backup og gjenopprettingsmulighet.                      |
| **P0 — før publisering**           | Kildekode er ennå ikke committet; GitHub CI, Pages-variabler, rettigheter, reviewer og endelig origin/redirect er ikke kontrollert remote.                                    | Gjennomgå første commit på `develop`, push etter avtale, få grønn CI og avtal release/godkjenning. Kontroller endelig Supabase-prosjekt og faktisk Pages-URL. Ingen merge/deploy er forhåndsgodkjent.                                                                        |
| **P1 — før bredere åpning**        | `image-upload` svarer 404. Profil-/forslagsbilder er ikke live-testet i denne runden.                                                                                         | Godkjenn deployment og en avgrenset Storage-test. En tekstbasert pilot kan bruke arrangementer uten bilder; ikke presenter opplasting som verifisert.                                                                                                                        |
| **P1 — før bredere åpning**        | Ingen faktisk innboksverifikasjon av arrangementsoppdateringer, påminnelser eller opprykk.                                                                                    | En pilot kan avtales med kun status på Min side og tydelig kommunikasjon. E-postarbeider skal fortsatt ikke aktiveres før separat godkjenning og leveringstest.                                                                                                              |
| **P1 — før bredere åpning**        | Interaktiv manuell kontroll, Safari/iOS, Android, skjermleser og zoom gjenstår.                                                                                               | Kjør kort manuell matrise med faktiske enheter/hjelpemidler. Automatiske axe-/mobiltester er bestått, men dekker ikke alle disse miljøene.                                                                                                                                   |
| **P1**                             | Produksjonstilgang for alle roller og endelige Auth-/Storage-/Edge-innstillinger er ikke bekreftet.                                                                           | Kjør lesende readiness og godkjent brukerflyt på valgt miljø før åpning. Hold `private` utenfor eksponerte API-skjemaer. Kontroller roller, Auth-rategrenser og prosjektadministrasjon.                                                                                      |
| **P2 — kan vente**                 | Automatisk oppdatering av ventelistestatus uten omlasting, rikere statistikk, mer innhold, sosiale lenker, bedre 404-presentasjon og ytterligere ytelses-/sikkerhetspolering. | Prioriter etter pilottilbakemeldinger. Ingen av disse rettferdiggjør å utsette P0-punktene.                                                                                                                                                                                  |

Supabase sin standard SMTP er beregnet på begrenset testing og har mottaker-/ratebegrensninger; at `external.email=true` er ikke en leveringsgaranti. Gjennomgå [Supabase sin SMTP-dokumentasjon](https://supabase.com/docs/guides/auth/auth-smtp) før innloggingsløsningen godkjennes. Velg en støttet sendetjeneste og verifisert avsender; eget domene/DNS avhenger av leverandørvalget. Ingen kjøp eller oppsettendring er gjort her.

## GitHub Pages

Produksjonsbuilden har base `/pluss-minus-null-stress/`; lokal utvikling bruker `/`. `HashRouter` gir dypkoblinger uten SPA-serverfallback. Sluttbuildens JavaScript/CSS returnerte HTTP 200 under repo-stien, direkte åpning og omlasting av arrangementssiden virket på begge størrelser, og produksjonsinnlogging viste bare e-postflyten. Dette er lokal preview, ikke bevis på at GitHub er konfigurert.

CI kjører tester uten live-nøkler. Pages-workflowen er manuelt startet med `workflow_dispatch`; push utløser ikke deploy. Den bruker bare Supabase URL/offentlig nøkkel til frontend. Required reviewers/tilgang og godkjent release-branch må bekreftes i GitHub før den brukes. Se [DEPLOYMENT.md](DEPLOYMENT.md).

## Pilotbeslutning

**Teknisk grunnlag: egnet for en begrenset pilot etter at P0 er lukket. Nåværende vurdering: ikke klar for studentpilot.** Det er ikke nødvendig å aktivere arrangementsmailer, kjøpe tjenester eller endre databasen for å avslutte denne kodegjennomgangen. Det er nødvendig å verifisere en faktisk brukbar innloggingsflyt og sikre persondata-/sletterutiner før studenter inviteres.

Etter P0 bør piloten ha få avtalte deltakere, kjente styrekontakter, tydelig testmerking og et enkelt publisert arrangement. Ikke gjenbruk utviklingsfixture-passord eller service-nøkler. Ikke inviter deltakere eller opprett pilotdata før det er godkjent.

Alle nye tester ligger i [launch-regressions.spec.ts](../tests/ui/launch-regressions.spec.ts) og bruker eksisterende, nettverksavskåret mock-backend. Lesende probe-/skannhjelpere for denne runden ligger lokalt i `.runtime/prelaunch-probes.mjs` og `.runtime/prelaunch-security.mjs`; de inneholder ikke nøkler og er ikke del av distribusjonen.
