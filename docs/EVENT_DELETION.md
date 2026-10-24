# Permanent sletting av tomme arrangementsutkast

Status 24. oktober 2026, `develop`: implementert og testet lokalt. **Migrasjon 010 er manuelt installert i utviklingsprosjektet `gawhbppuhnixqvhnnpnn`, uten migrasjonshistorikkregistrering. Den godkjente manuelle integrasjonstesten er bestått: brukeren slettet det ene testutkastet i UI, og agentens kun lesende fase 2 bekreftet sletting, korrekt revisjon og uendret baseline. Sluttstatus: 3 arrangementer og 27 revisjonsrader. Ingen sletting er utført av agenten. Ingen push, merge eller deploy.**

## Manuell integrasjonstest — fase 2 bestått

Brukeren rapporterte å ha slettet **TEST – Sletting av utkast** gjennom **Styreportal → Arrangementer → Slett permanent**, med tittelbekreftelsen. Agenten observerte ikke Chrome-fanen og utførte ikke slettekallet. Den etterfølgende databasekontrollen ble utført via Management API med eksplisitt prosjekt-ID `gawhbppuhnixqvhnnpnn`, i én `REPEATABLE READ READ ONLY`-transaksjon. Ingen RPC, dataskriving, reparasjon eller migrasjon ble kjørt.

| Fase 2-kontroll | Faktisk resultat |
| --- | --- |
| Testarrangement `108c859e-a72e-4011-a7c0-073ada178fb6` | Borte fra `public.events`; ingen tilknyttede rader |
| DELETE-hendelse | Nøyaktig én: revisjons-ID **27**, `action='DELETE'`, `entity='events'`, riktig testarrangements-ID |
| Administrator | `actor_id='64bc6698-8f44-4867-9f01-d4867ede553f'`; kontoen har fortsatt `admin` |
| Slettetidspunkt | `2026-10-24T12:10:39.564545+00:00` (UTC) |
| Opprinnelige arrangementer | Alle 3 beholdt med identisk innholdshash sammenlignet med baseline; tilknyttede tabeller uendret |
| Opprinnelige revisjonsrader | Alle 25 ID-er beholdt, med identisk samlet innholdshash |
| Opprettelsesrevisjon | INSERT-rad 26 beholdt uendret. Når bare testens DELETE-rad holdes utenfor, er hele revisjonstabellens hash lik fase 1-resultatet |
| Øvrige data og kontoer | Samtlige øvrige public/private-tabeller, Auth-bruker-ID-er og identity-ID-er har uendrede antall/hasher. Fortsatt 1 Auth-konto og 2 identities. Ingen andre slettinger påvist |
| Storage | Objekter og buckets har uendrede antall/metadatahasher; 0 objekter både før og etter. Ingen testfiler ble opprettet, og ingen filsletting er påvist |
| Sluttstatus | **3 arrangementer, 27 revisjonsrader**: 25 opprinnelige + én INSERT + én DELETE |
| Avvik og reparasjon | Ingen avvik; ingen reparasjon eller ekstra opprydding utført |

Kontrollen ble fullført `2026-10-24T12:13:16.50557+00:00`. Baseline, opprettelsesresultat og fase 2-resultat er bevart i Git-ignorerte `.runtime/manual-event-*.json`; manifestet er satt til `completed-user-deletion-verified`. Sammenligningen omfatter 27 tabell-/ID-grupper. Den eneste forventede forskjellen fra før testen er de to nye revisjonsradene; ingen andre grupper avviker.

**Hele den manuelle frontend→Supabase-flyten er dermed verifisert for dette ene tomme utkastet i utviklingsmiljøet**, med brukerbekreftet faktisk UI-handling og uavhengig lesende kontroll av sluttresultat og administrator i revisjonsloggen. Dette er ikke en agentobservert eller automatisert live-nettlesertest. Den utvider ikke godkjenningen til nye testutkast, flere slettinger, publiserte/tilknyttede arrangementer eller offentlig Pages-deploy.

## Manuell integrasjonstest — historikk fra fase 1

Den første planlagte nettleserkjøringen stoppet før skriving fordi agenten ikke hadde tilgang til brukerens Chrome-fane. Brukeren godkjente deretter at agenten oppretter ett utkast og tar baseline, mens brukeren selv utfører slettingen gjennom den faktiske bekreftelsesdialogen. Ingen alternativ SQL-/API-sletting er utført.

| Kontroll | Fase 1-resultat |
| --- | --- |
| Prosjekt og frontend | Eksplisitt utviklingsprosjekt `gawhbppuhnixqvhnnpnn`; lokal Vite-konfigurasjon peker til samme rot-URL og bruker ikke demomodus |
| Testtittel | **TEST – Sletting av utkast** |
| Testarrangements-ID | `108c859e-a72e-4011-a7c0-073ada178fb6` |
| Status og merking | `draft`, `is_demo=true`, påmelding stengt, ingen bilde-/kartlenke |
| Eksisterende administrator / created_by | `64bc6698-8f44-4867-9f01-d4867ede553f`; eneste admin ved førkontrollen. Ingen konto eller rolle er opprettet/endret |
| Tilknytninger | 0 påmeldinger, lag, varsler og gruppetilknytninger |
| Storage | Ingen testfiler opprettet; `image_path=null`; objekter og buckets har uendrede antall/innholdshasher |
| Originale data | 3 opprinnelige arrangementer og 25 opprinnelige revisjonsrader uendret. Øvrige public/private-tabeller og Auth-/identity-ID-er har uendrede antall/hasher |
| Forventet effekt av opprettelsen | Totalt 4 arrangementer og 26 revisjonsrader. Nøyaktig én ny INSERT-hendelse, revisjons-ID 26, knyttet til testarrangementet |
| Tilgjengelighet for adminlisten | Lesende database-RLS-kontroll med eksisterende admins ID finner akkurat ett synlig testutkast. Admin-komponenten viser alle hentede arrangementer og filtrerer ikke bort demo-/utkastrader. **Faktisk visning i Chrome er ikke observert av agenten** |

Baseline ble lagret før opprettelsen, med opprinnelige arrangements-/revisjons-ID-er og aggregerte innholdshasher for public/private-tabeller, Storage og Auth-/identity-ID-er. Opprettelsen var én avgrenset INSERT via Management API i én transaksjon, med låser og før-/etterkontroll som ville avbrutt ved andre dataendringer. Skriptet endret ikke backendkode, skjema, rettigheter eller secrets. Opprettelsens automatiske INSERT-revisjon har `actor_id=null`, fordi den ble utført administrativt uten et bruker-JWT; administratoren står som `created_by`. Fase 2 skal kontrollere at **DELETE**-hendelsen fra den faktiske UI-/RPC-flyten har den ekte administratorens ID ovenfor. Ingen brukeridentitet ble simulert for skriving.

Privat/Git-ignorert dokumentasjon for denne kjøringen ligger i `.runtime/manual-event-deletion-test.json`, `.runtime/manual-event-baseline-result.json` og `.runtime/manual-event-create-result.json`. Ved slutten av fase 1 stod manifestet i `waiting-for-user-deletion`; ingen automatisk opprydding eller opprettelse av flere utkast var klargjort som fortsettelse.

**Instruksjonen som ble gitt etter fase 1:** Åpne `http://127.0.0.1:5173/#/admin`, velg **Arrangementer**, og last siden på nytt om nødvendig. Finn bare **TEST – Sletting av utkast** (Demo/Utkast). Velg **Slett permanent**, skriv nøyaktig `TEST – Sletting av utkast` med tankestrek og mellomrom som vist, og bekreft. Brukeren har nå rapportert handlingen fullført. Testutkastet er borte; denne instruksjonen skal ikke brukes til å opprette eller slette flere arrangementer.

Den avtalte fase 2-kontrollen skulle først utføres etter brukerens bekreftelse. Den er nå gjennomført med bestått resultat som dokumentert øverst.

## Første kjøring stoppet ved kontroll av migrasjonshistorikk

Brukeren godkjente bare migrasjon 010, med instruks om å stoppe og rapportere avvik. Lesende kontroll via Supabase CLI mot det eksplisitte utviklingsprosjektet `gawhbppuhnixqvhnnpnn` fant at **`supabase_migrations.schema_migrations` ikke finnes**. Tidligere manuelt SQL-oppsett kan forklare dette, men anvendte migrasjonsversjoner 001–009 kan ikke bekreftes fra en historikktabell. Ingen `db push`, `migration up`, historikkreparasjon eller annen migrasjon ble forsøkt.

Førkontrollen bekreftet:

- Gren `develop`; SQL-filens SHA-256 er uendret: `13c2b0ce19f57f4f5b8f85f5a9a5fafbd0d4a9e08c18a4b0932a79a2dc0ba1b2`.
- Filen definerer bare funksjonen og execute-rettigheter; INSERT/DELETE ligger inne i funksjonskroppen og kjøres ikke ved opprettelsen. Ingen funksjonskall eller Storage-operasjoner står på toppnivå.
- `auth.uid()` og `private.require_user()` finnes. Arrangements-/rollekolonner, statusbegrensningen og de fire FK-tabellene samsvarer med funksjonens avhengigheter. RLS er aktivert på de berørte tabellene.
- `public.delete_draft_event(uuid,text)` finnes ikke ennå. `anon` og `authenticated` har ingen generell DELETE-rettighet på `public.events`.
- Baseline er bare lest som antall og hash: **3 arrangementer, 0 påmeldinger og 25 revisjonsrader**. Ingen personrader eller arrangementstitler ble skrevet ut. Ingen applikasjonsdata ble endret av kontrollen.

Arbeidet stoppet da før installasjon. Brukeren godkjente deretter uttrykkelig direkte kjøring av bare denne filen i én transaksjon, uten historikkreparasjon. Denne avgrensede fortsettelsen er nå gjennomført som beskrevet nedenfor. En eventuell etablering av historikk er fortsatt et eget, ikke godkjent arbeid.

## Manuell installasjon av bare 010 — gjennomført

Supabase CLI 2.122.0 brukte Management API med eksplisitt `--project-ref gawhbppuhnixqvhnnpnn`; prosjektlisten bekreftet samme ID og `ACTIVE_HEALTHY`. Grenen var `develop`. SQL-filens SHA-256 samsvarte fortsatt med verdien ovenfor. Funksjonen manglet før installasjonen. Funksjonssignaturer, nødvendige kolonnetyper, status-/rollebegrensninger, de fire event-FK-tabellene, RLS og klientrettigheter ble kontrollert på nytt.

Den uendrede SQL-filen ble utført i én eksplisitt `BEGIN`/`COMMIT`-transaksjon. Kontrollblokken kjørte filens nøyaktige innhold, uten å kalle `delete_draft_event`. Korte SHARE-låser på eksisterende public/private-tabeller stabiliserte sammenligningen av data; låse- og tidsgrenser var bare transaksjonslokale. Et avvik ville gitt exception og avbrutt transaksjonen før COMMIT. Ingen andre migrasjoner eller oppsettsfiler ble kjørt.

Før COMMIT ble følgende kontrollert og godkjent:

- `public.delete_draft_event(uuid,text)` returnerer UUID, har argumentnavn `p_event`/`p_title`, eies av `postgres`, bruker PL/pgSQL, `SECURITY DEFINER` og tom `search_path`. Funksjonskroppens MD5 er `add45dbd036f43845643914739c9a348`, lik kroppen i den godkjente kildefilen.
- `authenticated` har execute; `anon` og `PUBLIC` har ikke execute. Administratorrollen kontrolleres fortsatt inne i den uendrede funksjonen. Execute betyr ikke at studenter eller styremedlemmer kan slette.
- `anon` og `authenticated` har fortsatt ingen generell DELETE-rettighet på events. Eksisterende policies, RLS, tabellrettigheter, kolonner, constraints, triggere, øvrige funksjoner, skjemaer og standardrettigheter hadde uendrede metadatafingeravtrykk. Ingen DELETE-policy ble lagt til.
- Antall og aggregerte innholdshasher for alle eksisterende public/private-tabeller var uendret. Ingen personrader eller arrangementstitler ble skrevet ut.
- `supabase_migrations.schema_migrations` var fortsatt fraværende. Ingen historikktabell ble opprettet eller reparert.

COMMIT lyktes, og en separat lesende etterkontroll bekreftet funksjonen, rettighetene og følgende uendrede baseline:

| Data | Før og etter | Innholdshash (MD5) |
| --- | --- | --- |
| Arrangementer | 3 | `44ba95329ebe0781cc5d345a000b3787` |
| Påmeldinger | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| Revisjonslogger | 25 | `17343b57a769d4b8a8b29241bd625496` |

Installasjonsplan, kontrollert transaksjonsfil og resultatkvittering er lagret privat/Git-ignorert under `.runtime/event-delete-install-*`. Bare den nye funksjonen og dens execute-rettigheter er installert. Ingen Storage-operasjoner, secrets, Auth-innstillinger eller applikasjonsdata er endret. Dette er verifikasjon av installasjonen, ikke en ekte funksjonell slettetest.

### Unngå dobbeltkjøring ved senere migrasjonshåndtering

010 er **manuelt installert, men ikke registrert** i `supabase_migrations.schema_migrations`. Ikke bruk manglende historikk som bevis for at SQL-en ikke er anvendt, og ikke kjør 010, hovedoppsettet, `db push` eller `migration up` blindt mot dette prosjektet. Filen bruker `CREATE FUNCTION` og skal beholdes uendret; en ny kjøring vil møte den eksisterende funksjonen.

Før senere migrasjonsarbeid må prosjekt-ID, funksjonssignatur, funksjonskropp og rettigheter sammenlignes med denne kvitteringen. Ved samsvar behandles 010 som allerede installert og SQL-en kjøres ikke igjen. Ved avvik stoppes arbeidet for gjennomgang; funksjonen skal ikke droppes eller overskrives for å omgå dette. Et eventuelt overgangsarbeid til CLI-historikk krever separat godkjenning og gjennomgang av hva som faktisk er installert fra 001–010, før allerede anvendte versjoner registreres uten å kjøre SQL-en på nytt. Ingen slik historikkendring er utført nå.

## Bruk etter godkjent migrasjon

1. Logg inn som administrator og åpne **Styreportal → Arrangementer → Slett permanent** på riktig arrangement. Styremedlemmer og studenter får ikke denne kontrollen.
2. For publiserte eller avlyste arrangementer vises veiledning og **Rediger publiseringsstatus**, uten en destruktiv bekreftelsesknapp. Bruk avlysning når et publisert arrangement ikke skal gjennomføres.
3. For et utkast forklarer dialogen at slettingen ikke kan angres, hvilke tilknytninger som sperrer og at bilder/revisjonslogger beholdes.
4. Skriv arrangementets **eksakte tittel**, inkludert store/små bokstaver og mellomrom. Knappen aktiveres først ved nøyaktig samsvar. **Behold utkastet**, lukkeknappen eller Escape avbryter før innsending.
5. Bekreft **Slett permanent**. Etter bekreftet serverrespons fjernes raden fra lokal liste, og arrangementer/oversikt/revisjonslogg oppdateres. Ved feil beholdes dialog, tittel og liste. Ingen automatisk retry. Mens kallet behandles sperres duplikatinnsending og lukking av dialogen.

Tilknyttede data sperrer selv om påmeldingen er avbestilt eller laget er tomt. Ikke slett deltakerhistorikk for å omgå sperren. Utkaststatus betyr gjeldende `draft`; det er ikke innført en ny «aldri tidligere publisert»-status eller et arkivfelt.

Før migrasjonen er aktiv viser API-hjelperen en norsk beskjed om manglende slettefunksjon. Klienten forsøker aldri en generell tabell-DELETE som reserve.

## Serversikkerhet og transaksjon

[202610230010_delete_draft_event.sql](../supabase/migrations/202610230010_delete_draft_event.sql) definerer bare `public.delete_draft_event(p_event uuid, p_title text)` og dens execute-rettigheter. Funksjonen:

- Krever ekte `auth.uid()` og `admin` fra `public.user_roles`; rollen låses med `FOR SHARE` til transaksjonen avsluttes. Brukermetadata brukes ikke. Anonyme har ikke execute-rettighet; student/styre blir avvist inne i funksjonen.
- Låser arrangementet med `FOR UPDATE`, og kontrollerer deretter gjeldende status og eksakt tittel.
- Avviser alle rader i `event_registrations`, `event_teams`, `notifications` og `event_access_groups`. Dermed beholdes også ventelister, kosthensyn, oppmøte og privat e-postkø knyttet til varsler.
- Bruker samme arrangementsrad som påmeldingsflyten låser. FK-innsettinger må også ta en konfliktende nøkkellås. Samtidige koblinger, publisering, navneendring og sletting serialiseres; kontroll og DELETE er i samme database-transaksjon.
- Logger `actor_id`, `action='DELETE'`, `entity='events'`, arrangements-ID og `created_at` i `audit_logs`. Tidligere revisjonslogger beholdes. Event-sletting og ny audit-rad rulles tilbake sammen ved feil. Ingen suksess returneres dersom DELETE ikke faktisk fjernet raden.
- Beholder alle Storage-filer. Dupliserte arrangementer kan dele `image_path`; det finnes ingen automatisk filopprydding i denne funksjonen, heller ikke for en fil uten andre referanser.
- Har `SECURITY DEFINER` og låst tom `search_path`. Det innføres **ingen generell DELETE-grant eller DELETE-policy på events**. Eksisterende RLS, kontoer, roller og øvrige arbeidsflyter endres ikke.

Alle fire nåværende FK-tabeller er dekket. Databasetesten sammenligner dette mot PostgreSQL-katalogen. Nye event-FK-er krever vurdering og utvidelse av sperrene før testen kan bestå.

## Faktisk kjørte tester

| Kontroll | Resultat | Miljø/avgrensning |
| --- | --- | --- |
| Databasesikkerhet og samtidighet | **20/20 bestått** | Ekte lokal PostgreSQL, separat tilfeldig testdatabase; Supabase Auth/Storage-tabeller er lokale shims |
| Bekreftelsesdialog | **6/6 bestått** | Vitest/RTL, simulert API-hjelper |
| Ny slettingsflyt i nettleseren | **18/18 bestått** | Playwright desktop + mobil, simulerte Supabase-svar; inkluderer eksakt tittel, avbryt, liste/omlasting, roller, koblede data, foreldet publiseringsstatus, manglende migrasjon, nettverksfeil og tom suksessrespons |
| Eksisterende arrangementsflyter og responsivitet | **14/14 bestått** | Påmelding/venteliste/opprykk, adminoppretting/redigering, Sted-skriving/innliming/dialoger, adminfaner og 320px-visning; simulerte API-er |
| TypeScript strict, ESLint og produksjonsbuild | **Bestått** | Lokal build med fiktiv offentlig Supabase-konfigurasjon og `/pluss-minus-null-stress/`; ingen deploy |
| Installasjon av migrasjon 010 i ekte Supabase | **Bestått** | Bare utviklingsprosjektet; manuell transaksjon, kontroller før COMMIT og separat lesende etterkontroll; ingen historikkregistrering |
| Godkjent manuell slettetest, fase 1 | **Bestått** | Ett disponibelt utkast opprettet; baseline, tomme tilknytninger, uendret Storage/øvrige data og lesende admin-RLS-kontroll |
| Faktisk UI-sletting og lesende fase 2 | **Bestått** | Brukerutført UI-sletting; agentens kun lesende kontroll bekrefter fravær, én korrekt DELETE, bevart baseline og sluttstatus 3 arrangementer / 27 revisjonsrader |

Databasekontrollene dekker også publisert/avlyst, alle tre registreringsstatuser, tomt lag, varsler/outbox, gruppetilknytninger, delt bildesti, audit, rollback, en DELETE som undertrykkes av trigger, samtidige FK-skrivinger før/etter slette-låsen, publisering/navneendring under venting og to samtidige slettekall. Låseventing bekreftes med `pg_blocking_pids`, ikke bare tidsbaserte antakelser.

De 32 Playwright-testene er kjørt i to målrettede grupper (26 + 6), uten å gjenta allerede beståtte suiter. Eksisterende lokale testdatabase og midlertidig oppstartet PostgreSQL-server ble ryddet/stoppet av testoppsettet. CI er utvidet med bare lokal `--event-delete`-kontroll; GitHub Actions er ikke kjørt remote av agenten.

## Godkjenninger som gjenstår

1. Godkjent manuell installasjon av **bare migrasjon `202610230010_delete_draft_event.sql`** er gjennomført. Historikken er ikke opprettet/reparert. Hovedoppsettet, tidligere migrasjoner og 010 skal ikke kjøres om igjen mot prosjektet. Senere historikketablering krever eget godkjent arbeid.
2. Den ene godkjente manuelle integrasjonstesten er fullført: ett utkast opprettet, slettet av brukeren og verifisert med kun lesende fase 2. Godkjenningen er brukt. Nye testutkast, slettinger eller annen live-opprydding krever ny godkjenning.
3. Frontend-push, merge og offentlig deploy er fortsatt egne, ikke godkjente steg. Ingen ny Edge Function eller secret er nødvendig for funksjonen.
