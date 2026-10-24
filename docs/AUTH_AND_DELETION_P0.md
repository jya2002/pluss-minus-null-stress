# Innlogging og kontosletting — 24. oktober 2026

**Oppdatert 24. oktober 2026:** [Google OAuth er primær innlogging](GOOGLE_OAUTH.md), og brukeren har bekreftet ekte innlogging, Min side, studentrolle og utlogging/ny innlogging. SMTP-vurderingen og Gmail-godkjenningspunktene nedenfor er historiske alternativer. [ACCOUNT_DELETE.md](ACCOUNT_DELETE.md) erstatter den eldre slettetestplanen nedenfor med en implementert, lokalt testet harness og konkret deployomfang. Alle boolske database-readiness-felt er bekreftet true av brukeren. Deploy og live-sletting er fortsatt ikke godkjent eller utført.

Arbeidet er lokalt på `develop`. Ingen e-post, migrasjoner, live-fixtures, kontoer, serverinnstillinger, push eller deploy er utført. Begge P0-punktene har lokale rettinger og tester; de er **ikke leveransetestet i Supabase**. E-postoppsettet og deployment av slettefunksjonen gjenstår.

## Gratis e-post uten eget domene

Anbefaling: prøv en **egen gratis Gmail-konto for foreningen**, med totrinnsbekreftelse og et eget app-passord, som custom SMTP for en liten, avgrenset pilot. Ikke bruk et styremedlems private hovedpostkasse. Dette er en slutning fra støtten for vanlig SMTP i Supabase og Googles dokumenterte SMTP-/app-passordstøtte; kombinasjonen er **ikke testet mot dette prosjektet**. Den gir ingen garanti for studentlevering eller varig kapasitet.

| Alternativ | Flere studentadresser uten eget domene? | Begrensning og vurdering |
| --- | --- | --- |
| Supabase innebygd | Nei | Bare adresser i Supabase-organisasjonens prosjektteam; for tiden 2 meldinger/time, uten leveringsgaranti. En vanlig bekreftet Auth-bruker er ikke et teammedlem. Ikke gi studenter prosjekt-/databasetilgang for å omgå dette. |
| Gmail SMTP | Aktuell for liten pilot | Egen `@gmail.com` som både avsender og SMTP-bruker. Krever kvalifisert Google-konto, totrinnsbekreftelse og app-passord. Google beskriver blokkering ved mer enn 500 sendte meldinger/dag; spam-/misbruksvern kan stoppe sending tidligere. Dette er ikke en reservert kvote eller en tjenesteavtale for appen. |
| Brevo Free | Betinget alternativ | SMTP og 300 sendinger/dag er inkludert. For gratis Gmail-avsendere beskriver Brevo **midlertidig** omskriving til sitt `brevosend.com`-domene. Kontogodkjenning og faktisk avsender må avklares; ikke baser varig innlogging på at denne midlertidige ordningen fortsetter. |
| Resends testdomene | Nei | `resend.dev` sender bare til adressen på Resend-kontoen. Andre mottakere krever eget verifisert domene. |

Kilder kontrollert denne datoen: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Gmail SMTP](https://support.google.com/mail/answer/7104828?hl=en), [Google app-passord](https://support.google.com/accounts/answer/185833?hl=en), [Gmail-grenser for privatkontoer](https://support.google.com/mail/answer/22839?hl=en), [Brevo gratisplan](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), [Brevo avsenderomskriving](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication), [Resends mottakerbegrensning](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). Google Workspace-grensen på 2000/dag gjelder ikke en gratis privat Gmail-konto.

Hvis Gmail-kontoen ikke tilbyr app-passord, skal ikke totrinnsbekreftelse eller annen beskyttelse svekkes. Google anbefaler OAuth der det støttes. Google-innlogging via Supabase er et mulig annet produktvalg uten eget e-postdomene, men er ikke implementert eller aktivert her. Ingen gratis leverandør er valgt eller kontaktet av agenten.

### Konkret konfigurasjon etter godkjenning

1. Avtal en foreningseid Gmail-adresse, ansvarlige og kontogjenoppretting. Aktiver totrinnsbekreftelse. Opprett et app-passord merket for Supabase Auth. Google kan skjule denne muligheten blant annet ved Advanced Protection eller enkelte kontotyper; passordendring tilbakekaller app-passordet. Bruk aldri det vanlige Google-passordet.
2. I **utviklingsprosjektet `gawhbppuhnixqvhnnpnn`**, åpne Authentication > Email/SMTP og konfigurer custom SMTP først etter godkjenning:

   | Felt | Verdi |
   | --- | --- |
   | Host | `smtp.gmail.com` |
   | Port | `587`, TLS/STARTTLS |
   | Username | Hele den avtalte Gmail-adressen |
   | Password | App-passordet, bare i Supabase Dashboard |
   | Sender email | Samme Gmail-adresse |
   | Sender name | `Pluss Minus Null Stress` |

3. Behold **Confirm Email** og e-postleverandøren på. Behold konservative Auth-rategrenser under prøven; custom SMTP har normalt en egen innledende Supabase-grense på 30/time. Ikke øk den automatisk. App-passord/SMTP-passord skal aldri i `VITE_`, Git, chat eller frontendens `.env`.
4. Legg vedlagte [e-postmal](../supabase/templates/auth-email.html) inn i både **Confirm signup** og **Magic link**, etter godkjenning. Den inneholder standard `ConfirmationURL` og OTP `Token`; ingen egen token-URL-konstruksjon. Slå av eventuell lenkesporing. UiO-/andre e-postsikkerhetsskannere kan bruke opp en engangslenke; koden er reserveflyten. Se [Supabase e-postmaler](https://supabase.com/docs/guides/auth/auth-email-templates).
5. Dette gjelder **Auth-e-post**. Arrangementenes `notifications`-worker, Resend-secrets og cron skal fortsatt være av. SMTP alene aktiverer ikke den separate varslingsworkeren.

GitHub Pages gir nettsidehosting, ikke en e-postavsender. Ingen kjøp, eget domene eller DNS-endring er nødvendig for den foreslåtte Gmail-prøven. Foreningen må vurdere leverandørvilkår, personvern og ansvar for postkassen før studentadresser behandles gjennom den.

## Redirect og gyldige/ugyldige lenker

Offentlig adresse er **`https://jya2002.github.io/pluss-minus-null-stress/`**. I prosjektet som senere godkjennes for produksjon, skal både **Site URL** og den eksakte tillatte redirecten være denne adressen, med avsluttende skråstrek. Ikke legg `#/logg-inn`, `/auth/callback` eller wildcard til redirecten. Ikke bytt utviklingsprosjektets Site URL til produksjon nå.

For lokal utvikling brukes `http://127.0.0.1:5173/`. For den avgrensede produksjonsbuild-testen nedenfor må akkurat `http://127.0.0.1:4173/pluss-minus-null-stress/` godkjennes og legges til i **utviklingsprosjektets** redirectliste. `localhost` er en annen origin og brukes ikke om hverandre. Se [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls).

Frontend sender rotstien til gjeldende frontend som `emailRedirectTo`. Den fanger nå Auth-callback **før** Supabase-klienten og HashRouter starter, fjerner kode/feil/token fra adresselinjen, og bytter en PKCE-kode én gang også under React StrictMode. Retur lagres bare som en begrenset intern sti i sessionStorage, med én times levetid. Eksterne returadresser avvises. `no-referrer` i HTML hindrer at callbackens query videresendes i Referer-header til assets/lenker etter at policyen er lest.

Utløpte/ugyldige lenker, uventede implicit-token-fragmenter og manglende PKCE-verifikator gir en norsk forklaring og ny innloggingsmulighet. Rå provider-feil, verifier, koder og tokens vises/logges ikke av callback-håndteringen. En eksisterende gyldig sesjon slettes ikke fordi en annen lenke feiler. Standard SDK-automatikk for URL-utveksling er slått av fordi appen nå gjør utvekslingen eksplisitt. Se [PKCE og kravet til samme nettleser](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

### Avgrenset ende-til-ende-test med ekte innboks — ikke kjørt

Dette er en konkret, operatørstyrt testplan, ikke en automatisk kjøring som henter e-post eller en påstand om faktisk levering. Begge mottakeradresser må kontrolleres av testansvarlig. Ikke send lenker, koder eller passord i chat. Ikke bruk Playwright-trace, video, skjermbilder av innboksen eller lagrede nettverkslogger.

**Foreslått første godkjenning:** SMTP/maler og den lokale redirecten i utviklingsprosjektet, deretter maks **to Auth-meldinger til én eksisterende, bekreftet testkonto**. Ingen konto opprettes eller slettes i denne første prøven. Kontroller adressen i Dashboard først. Supabase sin innebygde tjeneste kan bare brukes her hvis adressen også er en av prosjektets egne teamadresser; den testen kvalifiserer ikke løsningen for studenter.

Bygg fra `.env` med utviklingsprosjektets offentlige URL/publishable key; servernøkler skal ikke tilføyes. Den eksisterende `dist` fra den automatiske testen bruker en fiktiv backend og må bygges om for denne prøven:

```powershell
$env:VITE_BASE_PATH='/pluss-minus-null-stress/'
try { npm run build } finally { Remove-Item Env:VITE_BASE_PATH -ErrorAction SilentlyContinue }
npm run preview -- --port 4173 --strictPort
```

| Trinn | Handling | Bestått-kriterium |
| --- | --- | --- |
| 1, desktop | Åpne previewets repo-sti, gå til et arrangement og Logg inn. Be om én lenke for den eksisterende testkontoen. | Sendt-visning; Auth/SMTP godtar forespørselen. Dette alene beviser ikke levering. |
| 2 | Kontroller faktisk innboks og spam. Åpne lenken i samme nettleserprofil som startet innloggingen. | Riktig foreningsavsender; faktisk mottatt melding; root redirect med repo-sti; kode forsvinner fra URL; student returneres til riktig side og Min side viser riktig konto. Ingen styretilgang. |
| 3 | Logg ut. Åpne den allerede brukte lenken på nytt. | Synlig trygg feilmelding; ingen fantomside, krasj eller ny sesjon. Ingen ny e-post nødvendig. |
| 4, mobil | Be om melding nummer to fra mobilnettleseren. Kontroller faktisk mobil levering og bruk OTP fra malen i samme skjema. | Innlogging og Min side fungerer uten å bruke e-postappens isolerte nettleser. |
| 5 | La en ubrukt lenke/kode gå ut etter prosjektets faktiske frist før et senere, separat godkjent forsøk. | Trygg utløpsfeil, ingen innlogging. Gjenbrukstesten erstatter ikke denne reelle tidsutløpstesten. |

Ny studentregistrering via **Confirm signup**, levering til en kontrollert UiO-adresse uten teamtilknytning og den faktiske offentlige Pages-origin må prøves separat før studentpilot. Det krever godkjenning til eventuell ny testkonto, flere meldinger og senere offentlig deploy. Lokal Pages-simulering beviser ikke offentlig SMTP/redirect-oppsett. Begrensninger som spamfilter, app-passordavslag eller rategrense skal dokumenteres som feil; ikke gjenta sending automatisk.

## Kontosletting

Lesende kontroll 24. oktober: riktig utviklingsprosjekt svarer **`404 / NOT_FOUND`** på `/functions/v1/account-delete`. Lokal kildekode og `supabase/config.toml` oppretter ingen deployet funksjon. Riktig prosjekt og funksjonsnavn er bekreftet; Supabase gjenkjenner ikke funksjonen på dette endepunktet. Deployment-historikken kan ikke leses med offentlig nøkkel. Kontroller Edge Functions-listen/deployment-status i Dashboard. Se [Supabase sin forklaring på NOT_FOUND](https://supabase.com/kb/troubleshooting/edge-function-404-error-response).

`handler.ts` er skilt fra Deno-adapteren for å teste den faktiske request-håndteringen lokalt. Den krever nå:

- Nøyaktig konfigurert origin, POST, JSON og `{ "confirmation": "SLETT" }`; ingen bruker-ID kan angis. CORS er bare tillegg; sikkerheten avhenger av Auth-verifisering.
- `auth.getUser(token)` før bruk av JWT-claims, gyldig UUID og nylig faktisk innlogging (15 minutter). Både JWT-utstedelse, brukerens siste innlogging og **den aktuelle sesjonens signerte AMR-tidspunkt** kontrolleres. Token-fornyelse og en annen enhets nylige innlogging teller ikke alene.
- `prepare_account_deletion()` med callerens JWT før Storage-skriving; eksisterende SQL-guard gjentas under administratorlåsen når profilen faktisk slettes. Siste administrator må overføre rollen. Ingen rolle kommer fra brukerredigerbar metadata.
- Bare egne UUID-stier i `avatars` og `suggestion-images` fjernes gjennom Storage API, i begrensede batcher. Uventede mapper, legacy-navn, feil og fremdriftsløse lister stopper sletting av Auth-kontoen. Ingen SQL-sletting av `storage.objects` og ingen sletting av foreningens `event-images`.
- Auth-sletting av **bare callerens ID** til slutt. Frontend krever eksplisitt `{deleted:true}` før lokal sesjon/cache ryddes. En tom HTTP 200-respons er ikke suksess.

Eksisterende FK-er/trigger i migrasjonene fjerner profil, rolle, medlemskap, grupper, påmeldinger, stemmer, preferanser, varsler/outbox og kontaktmeldinger. Forfatter, lagkaptein, arrangementsoppretter og audit-aktør settes til null der data beholdes. Forslag anonymiseres og revisjonslogger beholdes. Slettetriggeren låser berørte arrangementer og kan flytte kvalifiserte ventelistedeltakere opp før fristen. Eksisterende lokale PostgreSQL-tester i `scripts/test-db.mjs` dekker sletting/opprykk og siste administrator; de er ikke kjørt på nytt uten databaseendringer.

**Begrensning:** Storage og Auth/PostgreSQL er ikke én atomisk transaksjon. Hvis personlige filer er fjernet og et senere steg feiler, beholdes kontoen, men filene gjenopprettes ikke automatisk. Gjentatt forsøk kan fullføre oppryddingen. En samtidig rolleendring kan la den siste SQL-guarden avvise kontosletting etter filopprydding. Ukjente objekter utenfor forventede stier krever manuell gjennomgang. Dokumenter og test denne feilsituasjonen; ikke lov full tilbakeføring. Supabase-API-et krever serverlegitimasjon: [deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).

### Deployment som må godkjennes separat

Bare **`account-delete` i utviklingsprosjektet** foreslås deployet nå. Ikke `notifications`, cron, andre funksjoner eller frontend. Ingen migrasjon trengs. `ALLOWED_ORIGIN` er en felles Edge-secret: kontroller eksisterende verdi før endring slik at en annen funksjon ikke mister sin tillatte origin.

Etter godkjenning og innlogging i Supabase CLI:

```powershell
supabase functions deploy account-delete --project-ref gawhbppuhnixqvhnnpnn
```

Behold eksisterende eksplisitt token-validering i handleren; `verify_jwt=false` i lokal config betyr ikke at publikum kan slette kontoer. Kontroller funksjonens faktiske deployinnstilling. Supabase stiller serverens `SUPABASE_URL`, `SUPABASE_ANON_KEY` og `SUPABASE_SERVICE_ROLE_KEY` til disposisjon. Ingen av disse serverhemmelighetene skal i frontend. For utviklingsprøven må **`ALLOWED_ORIGIN=http://127.0.0.1:5173`** avtales i Dashboard > Edge Functions > Secrets. Ved senere godkjent Pages-bruk er origin **`https://jya2002.github.io`**, uten repo-sti. Én origin om gangen støttes nå; ikke bruk `*`.

Før testdata opprettes, kontroller lesende GET (forventet handler-405, ikke 404) og OPTIONS med avtalt origin (204 + eksakt CORS). En ukjent/manglende JWT ved POST skal gi 401 uten sideeffekter.

### Avgrenset ekte slettetest — testplan klargjort, ikke kjørt

Foreslått godkjenningsomfang er **to nye midlertidige, bekreftede studentkontoer A/B**, tilfeldige passord, kontrollerte Gmail-plussaliaser, ett tydelig merket demoarrangement med kapasitet 1, medlemskap/stemmer/forslag for testkontoene og to små personlige testbilder for A. Ingen ekte student-/styrekonto brukes som offer. E-postpreferanser settes av før påmelding. Ingen OTP, invitasjon, mailworker eller cron brukes.

1. Gjenbruk prosjektbindingen, `fixtureEmail`, `pinnedFetch`, eierskapsmarkøren og atomisk manifest fra `registration-live-safety.mjs`. Lagre intensjon/UUID før hver skriving; bare Node får servernøkkel. Ikke ta med passord/tokens i manifest eller rapporter. Eksisterende bruker- og arrangementsopprydding kan gjenbrukes, men **nye Storage-/forslags-fixtures krever egen eksakt eierskapskontroll**; ikke kjør den gamle API-testen som om den tester Edge-sletting.
2. La arrangementet eies av B, slik at oppryddingen fortsatt kan verifisere eier etter at A er borte. A får confirmed, B waitlisted. A laster kun opp to registrerte UUID-bilder i egne personlige stier; ingen foreningsbilder endres. Forslaget skal ha kjøringens fulle markør.
3. Logg inn som A med et ferskt passord. Et kall som forsøker å angi B som slettemål må avvises, og B må være uendret. Bekreft deretter sletting gjennom Min side som A. Kontroller også frontendens utlogging.
4. Verifiser med eksakte fixture-ID-er: A finnes ikke i Auth/profiles; personlige rader og bilder er borte; forslagsforfatter er null; B er fortsatt til stede og confirmed; arrangementet er beholdt. Ingen rå tokens/persondata skrives ut. Manglende eller tvetydige svar teller som feil.
5. Fjern bare kjøringens verifiserte rester: egen forslag-ID + full markør, egne filstier med kontrollert innhold, event-ID med full markør/is_demo/eier og gjenværende fixture-kontoer med app-metadata. Behold audit. Ved usikkert eierskap stoppes opprydding og ID-er beholdes for gjennomgang. Aldri massesletting eller sletting etter bare e-postprefiks.

Denne ekstra live-fixturen/automatiseringen er ikke implementert eller kjørt i denne runden; planen skal brukes til en avgrenset, gjennomgått test etter godkjenning. Den eksisterende live-påmeldingssuiten tester ikke `account-delete`. Siste-administrator-vernet skal ikke testes ved å demotere eksisterende administratorer. Feil-/race-tilfellene er foreløpig lokale tester med simulerte tjenestesvar, ikke bevis for ekte Storage/Auth-sletting.

## Verifikasjon i denne runden

| Kontroll | Resultat | Avgrensning |
| --- | --- | --- |
| TypeScript strict, ESLint | Bestått | Lokal kode |
| Produksjonsbuild for Pages | Bestått | Fiktiv offentlig Supabase-konfigurasjon, ingen servernøkler |
| Auth Vitest | 27 ulike tester bestått | 26 samlet i tre filer + ny enkeltregresjon for utløpt serverkode; berørt skjema kontrollert igjen etter formretting |
| Account-delete sikkerhetstester | 12/12 bestått | Faktisk handler; simulerte Auth/RPC/Storage-klienter |
| Deno check | Bestått | `account-delete/index.ts` og dets imports; ingen deploy |
| Auth Playwright | 6/6 bestått | Desktop + mobil; simulert gyldig PKCE, utløpt fragment og manglende verifier |
| Sletting Playwright | 4/4 bestått | Desktop + mobil; simulert suksess og feilaktig tom suksessrespons |
| Pages Playwright | 4/4 bestått | Produksjonsbuild, desktop + mobil; assets/ruting og PKCE-retur |
| Eksisterende student-/adminflyt | 4/4 bestått | Simulert påmelding, venteliste, avmelding, opprykk og opprettelse/redigering etter Auth-endringen |
| Hemmelighetsskann | Ingen funn | Ikke-ignorerte kildekandidater og bygde assets; ingen garanti mot fremtidig feilaktig staging |
| Lesende Supabase-kontroll | Auth 200, e-post/signup aktivt; account-delete 404/NOT_FOUND | Ingen SMTP-/redirect-innsyn, brukerdata eller skriving |
| Ekte e-post / ekte Edge-sletting | Ikke kjørt | Krever konfigurasjon, deploy og avgrenset testgodkjenning |

En første testkjøring avslørte en for snever OTP-URL-matcher i nettlesertesten; testharnessen er rettet. Etter AMR-utvidelsen måtte også forventet testtoken oppdateres. Nettlesertesten avdekket også at React gjenbrukte e-postfeltet som kontrollert kodefelt ved overgang til kodevisning. Skjemaene har nå separate identiteter; regresjonen kontrollerer at denne React-advarselen ikke oppstår. De endelige kjøringene ovenfor bestod. Ingen databaseendring var nødvendig, og tidligere beståtte påmeldings-/community-suiter er ikke gjentatt.

## Beslutninger som gjenstår

1. Godkjenn Gmail som pilotforsøk og avtal avsenderkonto; konfigurer app-passord/SMTP, maler og eksakt lokal redirect i utviklingsprosjektet. Ingen hemmeligheter i chat.
2. Godkjenn maks to ekte Auth-meldinger til én eksisterende kontrollert testkonto etter oppsettet. Ny signup-test, UiO-mottaker og offentlig origin kommer som eksplisitt tillegg.
3. Godkjenn deploy av bare `account-delete` til utviklingsprosjektet og eventuell avtalt origin-secret-endring.
4. Godkjenn det avgrensede nye A/B-fixtureomfanget og sletting av bare disse testkontoene når live-testen er gjennomgått. Ingen eksisterende konto skal slettes.

Offentlig lansering forblir uavklart til faktisk innlogging, sletting og de øvrige P0-punktene i [PRELAUNCH_REVIEW.md](PRELAUNCH_REVIEW.md) er verifisert.
