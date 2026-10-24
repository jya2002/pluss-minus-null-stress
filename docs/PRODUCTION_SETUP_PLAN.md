# Produksjonsmiljø — plan for førstegangsoppsett

Dato: **24. oktober 2026**. Arbeidsgren: **`develop`**. Status: **G1 BESTÅTT. G2A fullført. G2B B0–B7 er godkjent; lokale kontroller består og operatørrutine er klargjort. Live-preflight, link og dry-run avventer operatørens skjulte passordinnskriving. Stopp før G3.**

**Beslutning:** Produksjon skal bruke et eget, nytt Supabase-prosjekt. Ingen kontoer, data, filer, roller, sessions, nøkler eller migrasjonshistorikk skal kopieres fra DEV.

| Miljø / adresse | Verdi og status |
| --- | --- |
| DEV | `gawhbppuhnixqvhnnpnn` — skal forbli uendret |
| PROD | `unrdvalfkusnqhbfhber` — finnes og er lesende kontrollert; ulik DEV |
| Bekreftet prosjektnavn | `pluss-minus-null-stress-prod` |
| PROD rot-URL | `https://unrdvalfkusnqhbfhber.supabase.co` |
| PROD-organisasjon | `Pluss Minus Null Stress`, bekreftet via prosjekt-/organisasjonsmetadata |
| PROD-region | **West EU (Ireland), `eu-west-1`** — bekreftet; ikke Stockholm |
| Abonnementsplan | **Free** — manuelt bekreftet av prosjektansvarlig **24.10.2026**; agenten har ikke lest Billing |
| Offentlig frontend / Supabase redirect | `https://jya2002.github.io/pluss-minus-null-stress/` |
| Offentlig origin for Edge Functions | `https://jya2002.github.io` — uten repo-sti eller avsluttende skråstrek |
| Lokal utvikling | `http://127.0.0.1:5173/`, fortsatt mot DEV |

Agenten har ikke opprettet prosjektet. Under G1 ble metadata og databasekatalog/antall lest. G2A har bare brukt lokale filer, CLI-versjon/hjelp og offisiell dokumentasjon/kildekode; **ingen Supabase-prosjektkommandoer eller SQL-kjøringer** er utført i G2A. Ingen migrasjon, brukeropprettelse, rolleendring, Auth-/secret-/GitHub-endring, push, merge eller deploy er utført. Produksjonsplanen og Git-ignorerte kontrollfiler under `.runtime` er oppdatert. Kildekode, migrasjonsfiler, eksisterende miljøfiler og vanlig arbeidskopis Supabase-konfigurasjon/link er uendret. Gjeldende leveranse er fortsatt **NO-GO for offentlig åpning**; G1/G2A er ikke en lanseringsgodkjenning.

## G1-verifikasjon — 24. oktober 2026

**Resultat: BESTÅTT, avsluttet 24.10.2026 etter prosjektansvarligs bekreftelse.** Agentens tidligere lesende kontroller bekreftet prosjektidentitet, Ireland-region, status og fravær av appinstallasjon/data. Prosjektansvarlig har separat, manuelt bekreftet organisasjon `Pluss Minus Null Stress`, abonnement **Free**, PROD-ref `unrdvalfkusnqhbfhber` og region `eu-west-1`. Dette er brukerbekreftet Dashboard-grunnlag, ikke en ny Billing-/Supabase-kontroll utført av agenten. Eier-/reservepersoner og MFA er fortsatt egne driftsavklaringer.

| Lesende kontroll | Faktisk resultat |
| --- | --- |
| Mål og navn | `unrdvalfkusnqhbfhber`, `pluss-minus-null-stress-prod`; ulik DEV `gawhbppuhnixqvhnnpnn` |
| Status / opprettet | `ACTIVE_HEALTHY`; `2026-10-24T12:06:43.401143Z` |
| Organisasjon | Prosjektet tilhører organisasjonen med visningsnavn `Pluss Minus Null Stress`. Eier-/reservepersoner og MFA er ikke kontrollert |
| Region | `eu-west-1`, West EU (Ireland); samsvarer med brukerens opplysning |
| Plan | **Free, manuelt bekreftet av prosjektansvarlig 24.10.2026.** Agentens CLI-lister viste ikke planen, og ingen separat Billing-kontroll er utført av agenten. Ingen token er generert/eksportert eller tilgang endret |
| PostgreSQL | `17.11`; samsvarer med repositoryets lokale major 17 |
| Migrasjonshistorikk | Verken `supabase_migrations`-skjema eller `supabase_migrations.schema_migrations` finnes. Ingenting er opprettet eller reparert; dette er forventelig før førstegangsinstallasjon |
| Auth | **0 brukere, 0 identities**; bare antall lest, ingen personopplysninger hentet |
| Apprelasjoner | **0 tabeller, partisjonerte tabeller, views, materialiserte views, sekvenser eller foreign tables i `public`/`private`**. `private` finnes ikke |
| Appfunksjoner/policies/triggere | Ingen PMNS-funksjoner, public/private-policies, apptriggere eller `asset_read`/`asset_insert`/`asset_delete`. Én eksisterende RLS-hjelper er beskrevet nedenfor |
| Storage | **0 buckets, 0 objekter**; dermed ingen av de tre app-bucketene eller appfiler |
| Edge Functions | **0 deployede funksjoner** |
| Plattformforutsetninger | `auth.uid`, Storage-stihjelpere, `gen_random_uuid`, `hashtextextended` og `anon`/`authenticated`/`service_role` finnes |
| Utførelse | Supabase CLI **2.122.0**, eksplisitt `--project-ref unrdvalfkusnqhbfhber`; SQL i `REPEATABLE READ READ ONLY`, bekreftet `transaction_read_only=on` |

**Eksisterende plattformoppsett:** `public.rls_auto_enable()` eies av `postgres`, returnerer `event_trigger` og brukes av den aktiverte DDL-eventtriggeren `ensure_rls`. Den forsøker å aktivere RLS når nye public-tabeller opprettes; den er ikke en PMNS-funksjon fra 001–010. Supabase dokumenterer [denne typen RLS-eventtrigger](https://supabase.com/docs/guides/database/postgres/event-triggers). Funksjonskroppen og koblingen er lest, ikke kjørt eller endret. Øvrige katalogfunn er plattformens GraphQL-/Cron-/Net-/PostgREST-eventtriggere. Et tomt app-prosjekt betyr derfor ikke at `public` må ha null funksjoner. Ved senere installasjonskontroll telles **42 appfunksjoner separat fra denne eksisterende hjelperen**. Hjelperen erstatter ikke eksplisitte RLS-kontroller etter migrasjonene; dens feilgren logger feil uten å avbryte DDL.

**Manuell kontroll fullført:** Prosjektansvarlig bekreftet **Free** 24.10.2026. Ingen betalingsdetaljer, passord eller nøkler er mottatt. Den tidligere manuelle Billing-oppgaven er dermed lukket. Plan gjelder [per organisasjon](https://supabase.com/docs/guides/platform/billing-on-supabase), og skal ikke senere utledes fra prosjektnavn eller prosjektstatus.

Prosjekt-/databasekontrollen ble utført omkring **`2026-10-24T13:46:52Z`**; den supplerende eventtrigger-/Edge-kontrollen fulgte i samme økt. Private kvitteringer: `.runtime/prod-g1-metadata.json`, `.runtime/prod-g1-database.json`, `.runtime/prod-g1-platform.json` og `.runtime/prod-g1-functions.json`. SQL-kontrollene ligger i `.runtime/prod-g1-read.sql` og `.runtime/prod-g1-platform-read.sql`. De inneholder ingen dataskriving, DDL eller app-RPC-kall. Organisasjonsnavnet ble i tillegg kontrollert med `orgs list`.

CLI-oppstart i sandkassen stoppet først på lokal telemetry-fil (`EPERM`); de lesende kommandoene lyktes med nødvendig lokal prosessadgang. Et organisasjonsoppslag brukte først et ugyldig kommandonavn og ble korrigert til `orgs list`; det forsøket endret ingen eksterne data. Ingen faktisk `supabase link`, `db push --dry-run`, migrasjonsoperasjon eller ekstern konfigurasjonsendring er kjørt. G1/G2A er avsluttet. G2B er senere godkjent, men avventer operatørkjøringen nedenfor; ingen ny live-kontroll er utført etter G1 ennå.

## G2A — lokal forberedelse fullført

G2A ble startet som **under forberedelse** og er nå fullført lokalt 24.10.2026. Tillatelsen omfatter dokumentet og Git-ignorerte lokale kontrollfiler. **Ingen CLI-handler for link/push/list/query/init er kjørt**; kun `--version` og `--help` er brukt. Ingen SQL, heller ikke lokale migrasjonsprøver, er kjørt i denne fasen. Tidligere G1-kvitteringer er lest som historiske bevis, ikke erstattet av nye PROD-kontroller.

### Lokal kontroll og resultat

| Kontroll | Resultat / bevisgrense |
| --- | --- |
| Filsett og rekkefølge | Nøyaktig **10 SQL-filer**, én unik versjon hver fra `202610230001` til `202610230010`, i samme numeriske og alfabetiske rekkefølge |
| Kildehash mot manifest | **10/10 samsvarer** med SHA-256-tabellen i 3.4; ingen migrasjon endret |
| Releasekopier | **10/10** er byteidentiske med gjennomgått kilde; kopiert uten linjeskift-/encoding-endring |
| Objektinventar | Statisk kontroll finner **23 tabeller og 42 siste appfunksjoner**; alle **27 public-appfunksjoner** har eksplisitte execute-grants i kjeden |
| Installasjonsavhengigheter | 001 → 002 → 003 → 004, deretter korreksjoner 005–009 og ny RPC 010. Ingen manglende intern referanse/navnekollisjon funnet ved kildegjennomgangen; managed forutsetninger gjenstår å kontrollere på nytt i G2B |
| Transaksjonsform | Ingen toppnivå-BEGIN/COMMIT, `transaction=false`, concurrent index, VACUUM, CLUSTER eller ALTER SYSTEM funnet. BEGIN/END inne i funksjoner/DO er funksjons-/blokkstruktur. Dette er statisk kontroll, ikke en ny installasjonstest |
| RLS / automatisk eksponering | Eksplisitt RLS og tabell-/RPC-grants er gjennomgått, se nedenfor. Automatisk RLS er ikke det samme som automatisk API-eksponering |
| CLI | **2.122.0**, bekreftet lokalt. Faktisk hjelpetekst støtter `--workdir`, `--project-ref`, `--linked`, `--dry-run` og **`--skip-vault`** |
| Isolert katalog | **Klar for separat godkjent G2B**, `.runtime/prod-g2a/release`, med **11 filer**: minimal config + 10 migrasjoner |
| Renhet | Ingen seeds, `roles.sql`, `.env*`, Vault/remotes-blokker, Edge Functions, declarative schema-filer, ekstra migrasjoner, DEV-ref, localhost-/127.0.0.1-adresser eller link-/cachefiler i release-katalogen |
| Beskyttet arbeidskopi | Lokale fingeravtrykk for opprinnelig config, miljøfiler og eksisterende link-/cachefiler er uendret ved sluttkontroll. Ikke noe innhold fra miljøfilene er skrevet ut eller kopiert |
| Nettverk / tester | Bare offentlig dokumentasjon og offisiell CLI-kilde lest; ingen Supabase-prosjektoppslag eller -operasjoner kjørt. Manifest-, kopi-, innholds-, statisk SQL- og TOML-kontroller består. Ingen nye backend-/Auth-integrasjonstester er utført |

**Isolert config:** `project_id="pluss-minus-null-stress-prod-release"` er et lokalt CLI-navn, ikke en fjernbinding. Filen angir bare `api.auto_expose_new_tables=false`, PostgreSQL major 17, migrasjoner på med tom `schema_paths`, og seed av med tom `sql_paths`. Den inneholder ingen Auth-adresser, passord eller nøkler. Den skal aldri pushes med `config push`. Vanlig arbeidskopis config er ikke kopiert. Generisk TOML-syntaks og feltene er kontrollert; full CLI-/hosted validering er ikke kjørt gjennom en muterende kommando.

CLI-banen som er brukt er den eksisterende npm-cache-binæren `C:/Users/julia/AppData/Local/npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe`, med SHA-256 **`f51f287379f72f8d3cdf8469836fd1474141e57f9935a6fb8edd0f60bdb4995e`**. Release-configens SHA-256 er **`acf5cbd94cb1942598780400edf6a779747b36c040a2ac37067f47bfa326a016`**. En endret CLI/binær/config krever ny gjennomgang, også om versjonsstrengen ser lik ut. Det er ikke lastet ned/installert en ny CLI.

Private kontrollfiler ligger utenfor selve release-katalogen: `release-manifest.json`, `verification.json`, `protected-before.json`, `static-review.json`, `cli-receipt.json`, CLI-hjelpetekster og offisiell kildekode under `.runtime/prod-g2a`. Kontrollprogrammene `.runtime/prod-g2a-prepare.mjs` og `.runtime/prod-g2a-static-review.mjs` utfører bare lokale operasjoner. `preflight-read.sql` er klargjort, **ikke kjørt**. Hele området er bekreftet Git-ignorert. Dette er et lokalt SQL-filsett, ikke en ferdig godkjent frontend-release eller en Git-commit.

### Eksplisitte grants når automatisk eksponering er av

Analysen forutsetter den oppgitte PROD-innstillingen **Automatically expose new tables deaktivert**. Selve Dashboard-valget og faktiske `pg_default_acl` er ikke lest i G2A. Supabase skiller [default grants og RLS](https://supabase.com/docs/guides/api/securing-your-api): førstnevnte bestemmer adgang til objektet, sistnevnte hvilke rader som tillates. Å aktivere automatisk eksponering er ikke et foreslått tiltak.

| Nødvendig tilgang | Eksplisitt kildegrunnlag / vurdering |
| --- | --- |
| Offentlig lesing | 001: SELECT til anon/authenticated på **6** tabeller: events, event_categories, polls, poll_options, announcements, site_settings |
| Innlogget lesing | 001: SELECT på de resterende **15** public-tabellene til authenticated; RLS gjelder fortsatt. Til sammen 21 public-tabeller |
| Direkte admin-/egenoppdateringer | 001: events/polls INSERT+UPDATE; announcements INSERT+UPDATE+DELETE; site_settings UPDATE. Profilens 4 kolonner, preferansenes 2 kolonner og contacts.resolved gis kolonnebegrenset UPDATE. Ingen event-DELETE eller direkte stemme-/påmeldings-/rolleendring gis |
| App-RPC-er | 002 rydder execute på eksisterende public/private-funksjoner og gir eksplisitt de 3 offentlige lesefunksjonene og autentiserte handlinger. 003 avgrenser de 4 serverfunksjonene til service_role. 004/010 gir eksplisitt prepare_account_deletion/delete_draft_event til authenticated. 005 gjentar service-grant; CREATE OR REPLACE i 006–008 beholder eksisterende ACL |
| Policyhjelpere / private | 001/002 gir private-schema USAGE og execute på is_staff/is_admin til nødvendige klientroller. 004 gir upload_quota til authenticated. Øvrige interne kall skjer som gjennomgått funksjonseier; private-tabeller har ikke direkte klienttilgang |
| Service og sekvenser | 003 gir service_role ALL på app-tabellene, private USAGE og USAGE+SELECT på public-sekvenser. Ingen klient trenger direkte audit-sekvensadgang: audit skrives av definer-/triggerfunksjon. Direkte tillatte klient-INSERT-er bruker UUID, ikke audit-identiteten |
| Managed schema-/Storage-grants | `public` USAGE, Auth-/Storage-schema og Storage-API-privilegier kommer fra plattformen, ikke et default table-grant. 001–010 gir **ikke** egne erstatninger for manglende public USAGE eller Storage-objektgrants. Disse er nødvendige G2B-forutsetninger og skal verifiseres lesende, ikke gis bredere automatisk |

**Konklusjon om nødvendige app-grants:** Ingen manglende eksplisitt tabell- eller public-RPC-grant er funnet ved statisk gjennomgang av 001–010 for innstillingen av. Dette er ikke en attestasjon av faktiske, ennå ikke installerte PROD-ACL-er. Installer som tiltenkt `postgres`-eier; avvik i creator/owner/schema-grants må stoppes og rapporteres. Service_role BYPASSRLS alene erstatter ikke grants.

**Bekreftet herdeavvik i 003:** Linjene `ALTER DEFAULT PRIVILEGES IN SCHEMA ... REVOKE EXECUTE ... FROM PUBLIC` fjerner ikke et globalt PUBLIC EXECUTE-default. Dermed er kommentaren «new functions default to private» ikke en generell garanti. [PostgreSQL 17](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html) beskriver at schema-lokale defaults bare kan legge til globale rettigheter. Dagens kallbare public-RPC-er beskyttes av eksplisitte revokes/grants i filsettet. Triggerfunksjoner opprettet senere i 003 kan fortsatt ha PUBLIC EXECUTE under standardoppsettet; de returnerer trigger og kan ikke brukes som vanlig RPC. Dette er en bekreftet begrensning ved framtidige standardrettigheter, **ikke et funn av manglende app-grant eller en påvist autorisasjonsomgåelse**. Ingen SQL er rettet. En eventuell global default-herding er en separat godkjent migrasjon/oppgave, ikke en endring i hash-låste 001–010. Neste nye funksjon må alltid ha eksplisitt, kontrollert ACL.

### Plattformavhengigheter og automatisk RLS

- G1 viste PostgreSQL 17.11, managed Auth/Storage-hjelpere og klientroller. G2B må kontrollere dette på nytt, i tillegg til public-schema USAGE, Auth/Storage-privilegier, `postgres`-rettigheter til Auth-trigger/buckets og faktisk eier/creator. De lokale test-shimsene skal aldri følge release-katalogen.
- 001 definerer alle 23 tabeller og aktiverer RLS eksplisitt. Den eksisterende `ensure_rls` gjelder nye **public**-tabeller; den oppretter ikke egne app-policyer/grants og dekker ikke private-tabellene. Den supplerer 001 uten funnet navnekollisjon. Eieren er postgres ifølge G1. Ingen trigger deaktiveres for installasjon.
- 002 tilbakekaller klient-execute på alle daværende public-funksjoner, også den eksisterende `rls_auto_enable`. Det fjerner ikke funksjonen, triggerkoblingen eller postgres-eierens rettigheter. Eventtriggeren forblir et separat plattformobjekt. Etterinstallasjon må alle 23 RLS-flagg kontrolleres eksplisitt; hjelperens feilgren gir bare logg.
- 003 må ha tomme app-buckets og managed `storage.objects`; den oppretter bucketene selv. 004 DROP/CREATE av `asset_insert` krever 003; 009 ALTER av `asset_read` krever samme policy. Ingen mellomliggende API-åpning før hele kjeden er fullført.
- 005 må rette maintenance før noen jobb kaller den. 006–008 erstatter eksisterende funksjoner med uendret signatur. 010 krever alle fire event-FK-tabellene og audit. Ingen installasjonsfil starter cron, deployer funksjoner eller kaller kontosletting/utkast-sletting.

### CLI 2.122.0: avklart metadata- og tilkoblingsoppførsel

Offisiell kildekode for versjonstaggen ble lest ved commit **`5afad870388552d0198087d27037da7ac745ba2b`**; dette er kildeanalyse sammenholdt med lokal hjelpetekst, ikke en kjørt fjernprøve. Viktige rettelser til den tidligere konservative planen:

1. **Link skriver lokal CLI-tilstand.** Den leser prosjektmetadata og API-nøkler for tjenesteprober, og lagrer blant annet ref, versjoner og pooler-/prosjektcache under release-katalogens `supabase/.temp`. Stack-modus bruker `.link.json`/lockfiler i stedet. Ingen appinstallasjon eller migrasjonshistorikk opprettes av den gjennomgåtte link-handleren. Nøkkelverdiene skal aldri skrives ut, eksporteres eller tas med i kontrollrapporter. Se [link-handler ved fast commit](https://github.com/supabase/cli/blob/5afad870388552d0198087d27037da7ac745ba2b/apps/cli/src/commands/link/link.handler.ts).
2. **Dry-run oppretter ikke historikktabellen i denne versjonen.** Den leser remote-versjoner; manglende historikktabell behandles som tom liste. Dry-run-grenen lister de ti filene og går ikke inn i migrasjonsanvendelsen. `createMigrationTable` kalles først i apply-stien, ikke ved ren plan/listing. Se [push-kjerne](https://github.com/supabase/cli/blob/5afad870388552d0198087d27037da7ac745ba2b/apps/cli/src/command-internal/db-push-core.ts) og [historikklesing](https://github.com/supabase/cli/blob/5afad870388552d0198087d27037da7ac745ba2b/apps/cli/src/command-internal/migration-history.ts). **G2B skal derfor ikke godkjenne historikk-DDL som en forventet sideeffekt.** Hvis skjema/historikk oppstår, er det et avvik og arbeidet stoppes.
3. **Tilkobling kan likevel skrive før dry-run.** Uten et ikke-tomt databasepassord kan resolveren kalle Management API for å opprette en midlertidig SQL-loginrolle; feil/retry kan også forsøke å fjerne en nettverksblokkering. Dette gjelder også andre tilsynelatende lesekommandoer som bruker samme tilkoblingsresolver. Se [tilkoblingskode](https://github.com/supabase/cli/blob/5afad870388552d0198087d27037da7ac745ba2b/apps/cli/src/command-internal/db-config.layer.ts). Disse handlingene er **ikke** gitt tillatelse gjennom G2A og skal ikke være automatisk fallback i G2B.
4. **Foretrukket G2B-metode:** Etter separat godkjenning bruker operatøren eksisterende PROD-databasepassord i et kortlivet, dedikert prosessmiljø (`SUPABASE_DB_PASSWORD`), kontrollert som ikke-tomt før CLI startes. Ingen passord som kommandoflagg, argument, rapport, Git-fil, shell-historikk eller chat. Ingen ny passordsetting/reset. Når en slik privat innskrivingsmåte ikke er tilgjengelig, stopp før dry-run og avklar metoden; ikke la CLI opprette en rolle. Bruk av midlertidig SQL-loginrolle krever et eget, uttrykkelig utvidet scope dersom det senere ønskes.
5. **`--skip-vault` støttes og skal brukes.** Push-handleren kan ellers synkronisere Vault før faktisk migrasjon. Dry-run går ikke inn i den skrivingen, men flagget hindrer også Vault-resolusjon og gjør avgrensningen eksplisitt. Minimal config inneholder ingen Vault-blokk. Ingen `--include-*`, `--yes` eller `--debug` skal brukes.
6. **Per-fil transaksjon, ikke hele kjeden:** [Apply-koden](https://github.com/supabase/cli/blob/5afad870388552d0198087d27037da7ac745ba2b/apps/cli/src/command-internal/migration-apply.ts) grupperer ordinære utsagn og historikkinnsetting i en transaksjon per fil; den har særstier for eksplisitte grenser og ikke-transaksjonelle utsagn, som ikke er funnet i filsettet. Historikktabellen opprettes i egen oppsettstransaksjon ved ekte apply. Dette er dokumentert kodeadferd, ikke en G2A-kjøring. En ren lokal Supabase-/CLI-installasjons- og rollbackprøve gjenstår før G3 etter punkt 3.3; tidligere shims-tester erstatter ikke den.

### G2B — godkjent prosedyre; fjernoperasjonene er ikke kjørt

G2B skal begrenses til nye lesende PROD-før/etterkontroller, én lokal link i den isolerte katalogen og én dry-run med gjennomgått tilkoblingsmetode. Ingen SQL-installasjon, historikkendring, Auth-bruker, bucket, funksjonsdeploy eller rolleendring inngår. Hjelpetekst/implementasjon er nå avklart, men nettverkstilgang, DB-autentisering og faktisk pending-liste er **ikke testet**.

| Trinn / godkjenning | Operasjon | Forventet resultat og stoppkriterium |
| --- | --- | --- |
| B0 — G2B-scope godkjent 24.10.2026 | PROD-ref, release-katalog, lokal cache-skriving, linkens lesing av API-nøkler uten logging, eksisterende passords kortlivede prosessbruk, READ ONLY-kontrollene og én dry-run er godkjent; operatørrutine er valgt | Ingen generell tillatelse til G3, opprettelse av SQL-loginrolle, unban, Vault eller historikk-DDL. Skjult passordinnskriving må skje lokalt hos operatøren |
| B1 — lokal forhåndskontroll | Kjør den lokale prepare-kontrollen på nytt **før** link; sjekk CLI-binær/config/migrasjonshasher og Git-ignorering | 10/10 kildehash, 10/10 kopier, 11 release-filer, ingen link/seed/env/ekstra SQL. Avvik stopper før nettverk |
| B2 — lesende target/baseline | Med eksplisitt PROD-ref: prosjektmetadata og klargjort `preflight-read.sql` via Management API i READ ONLY | Riktig navn/ref/Ireland/major 17; fortsatt 0 brukere/identities/apprelasjoner/buckets/filer og fraværende historikk. Bare dokumentert plattformhjelper. Public/Auth/Storage-grants og defaulter kontrolleres. Nye objekter/brukere eller manglende forutsetning stopper; ingen reparasjon |
| B3 — isolert link | Kjør bare link-kommandoen nedenfor fra avgrenset prosess | Exit 0 og strukturert `project_ref=unrdvalfkusnqhbfhber`. Bare forventet lokal link-/versjons-/poolercache. Les kun ref/verifiserte metadata, ikke dump nøkler eller cacheinnhold. Ingen endring i vanlig arbeidskopi eller remote historikk |
| B4 — sjekk etter link | Verifiser riktig lokal ref og uendrede migrasjons-/config-/DEV-fingeravtrykk; gjenta lesende kontroll ved uventet output | Ved uventet fil, config-/API-endringsforslag, auth-feil eller annen ref: stopp. Ikke init/reset/relink et annet prosjekt, aksepter konfigurasjonssynk eller gå videre automatisk |
| B5 — avgrenset dry-run | Kontroller ikke-tomt riktig PROD-passord i privat prosessmiljø, og kjør bare kommandoen nedenfor | Strukturert `dryRun=true`, `upToDate=false`, **nøyaktig ti migrasjonsnavn** i 001–010-rekkefølge og tomme `seeds`/`roles`. Ingen «Applying migration», «Initialising login role», Vault-skriving, up-to-date, repair-/include-all-forslag eller seed. Uventet melding/feil stopper; ingen retry eller alternativ metode |
| B6 — lesende etterkontroll | Samme READ ONLY-snapshot; sammenlign med B2, inkludert funksjoner, defaulter, trigger-/rollemetadata og appantall | Historikkskjema/-tabell er fortsatt fraværende; 0 appbrukere/data/Storage. Ingen SQL-rolle-/grantendring. Kun forventet lokal CLI-cache kan avvike. Avvik rapporteres uten reparasjon |
| B7 — rapportér og stopp | Fjern prosessens passordvariabel i finally, behold private redigerte kvitteringer | G2B bestås bare med alle kriterier. Faktisk installasjon krever ny G3-godkjenning av akkurat pending-listen og hashene |

Fremtidige kommandoer, kjørt via **den hash-verifiserte CLI-binæren**, med eksplisitt workdir. De er **ikke kjørt i G2A**:

```powershell
# $prodReleaseDir settes til repoets absolutte .runtime/prod-g2a/release.
# $prodCliExe settes til den kontrollerte eksisterende CLI-binæren ovenfor.
& $prodCliExe --workdir $prodReleaseDir link --project-ref unrdvalfkusnqhbfhber --output-format json
# STOPP og kontroller B3/B4 før neste kommando.
& $prodCliExe --workdir $prodReleaseDir db push --linked --project-ref unrdvalfkusnqhbfhber --dry-run --skip-vault --output-format json
```

Variablene er verktøybaner, aldri credentials. Før oppstart skal en godkjent wrapper/prosess begrense arvede miljøverdier: ingen DEV-`SUPABASE_PROJECT_ID`, alternative API-/DB-hosts, libpq/`PG*`-overstyringer, `SUPABASE_YES`, config-/seed-/remotes-overstyringer eller frontend-/testnøkler. Behold bare nødvendige system-/CLI-autentiseringsverdier og det privat innskrevne PROD-passordet. Endre ikke globalt miljø eller `.env`. CLI-kilden leser prosjektmiljøfiler fra eksplisitt workdir og dens `supabase/`, ikke forelderens `.env`; fravær av filer og eksplisitt workdir hindrer slik innlesing, mens prosessmiljø må håndteres separat. Ingen eksperimentell stack-/state-overstyring skal arves; ved uventet stack-/lockmodus stoppes arbeidet.

READ ONLY-kontrollen kjøres etter egen G2B-godkjenning med `db query --linked --project-ref unrdvalfkusnqhbfhber --file <absolutt kontrollfil> --output json` via Management API, med samme eksplisitte release-workdir/CLI-bane. Dette er ikke `migration list` eller SQL som initialiserer historikk. `preflight-read.sql` er utenfor migrasjonsmappen og skal aldri blandes inn i G3. En gjennomgått wrapper må filtrere/redigere output **før** den sendes til terminal, chat eller rapport; ingen `--debug`/trace, passord, tokens, API-nøkler eller URL med credentials i logger. Manglende sikker innskriving/filtrering stopper oppstart. Feil er stoppgrunn, ikke grunn til å opprette nye nøkler, endre nettverks-/API-innstillinger eller aktivere default grants.

**G2A-resultat:** Den lokale release-katalogen er klar. Ingen hashavvik, manglende intern migrasjonsavhengighet eller manglende eksplisitt app-grant er funnet. De dokumenterte restpunktene er plattformprivilegier/default-ACL i nytt snapshot, privat DB-autentisering uten rolle-fallback, og separat lokal CLI-/Supabase-installasjonsprøve før G3. Standard-EXECUTE-herdingen i 003 er en konkret begrensning som ikke er rettet. G2B er nå separat godkjent; faktisk utførelsesstatus følger nedenfor.

## G2B — operatørrutine klargjort, ikke gjennomført ennå

**24.10.2026:** Prosjektansvarlig godkjente G2B avgrenset til B0–B7, for `unrdvalfkusnqhbfhber`, release-katalogen og CLI 2.122.0. Agentens prosess hadde **ingen ikke-tom `SUPABASE_DB_PASSWORD`**, og agentverktøyet tilbyr ikke skjult interaktiv passordinnskriving. Verdier ble ikke vist eller hentet fra filer. Agenten stoppet derfor før live-preflight/link/dry-run og ba om avklaring. Brukeren valgte deretter uttrykkelig **«Ja, klargjør operatørstyrt PowerShell-rutine»**.

**Status: AVVENTER OPERATØRKJØRING; G2B er ikke bestått.** Det er ikke funnet en feil i PROD, men ingen ny PROD-tilkobling eller pending-liste foreligger fra denne runden. Ingen link/cachebinding, dry-run, migrasjons-DDL eller fjern-etterkontroll er utført. G1-snapshotet er historisk og skal ikke presenteres som en ny etterkontroll.

Faktisk, redigert lokal output:

```json
{
  "sourceHashes": 10,
  "copyHashes": 10,
  "cliVersion": "2.122.0",
  "releaseFiles": 11,
  "protectedWorkingCopyUnchanged": true,
  "secureProcessPasswordAvailable": false,
  "offlineSafetyChecksPassed": 25,
  "livePreflightExecuted": false,
  "linkExecuted": false,
  "dryRunExecuted": false,
  "pendingMigrations": null,
  "remotePostflightExecuted": false
}
```

### Klargjort rutine og passordhåndtering

- `.runtime/prod-g2b/Invoke-ProdG2B.ps1`: operatøren skriver eksisterende PROD-databasepassord via **`Read-Host -AsSecureString`**. Det opprettes ingen `.env`-/passordfil, og passordet brukes aldri som kommandolinjeargument. Ingen passordreset eller ny token opprettes.
- `.runtime/prod-g2b/run-g2b.mjs`: passordet mottas kun i den kortlivede prosessens miljø. Arvede miljøverdier begrenses; ingen DEV-/PG-/config-/seed-/state-overstyringer eller `NODE_OPTIONS` følger med. Den vanlige arbeidskopiens `.env` og Supabase-link endres ikke. Miljøkopien ryddes ved avslutning; klartekst finnes nødvendigvis midlertidig i prosessminnet under DB-autentisering, så dette er ikke en påstand om full minnesikring.
- Rutinen verifiserer de låste kilde-/kopi-/config-/CLI-hashene, kontroll-SQL-en og selve rutine/runtime-filene før nettverk. Den utfører deretter prosjektmetadata + READ ONLY-førkontroll, én link, ny lokal kontroll, én dry-run med `--skip-vault` og READ ONLY-etterkontroll. Feil stopper uten retry eller reparasjon. Manglende/tomt passord stopper før første nettverkskall, slik at automatisk SQL-loginrolle/unban-fallback ikke brukes.
- Rå CLI-output og eventuelle nøkkel-/feilverdier holdes i minnet og skrives ikke til filer/terminal. Bare validerte, tillatte resultatfelt, statiske feilkoder og fingeravtrykk rapporteres. Pending-listen må være nøyaktig det lokale 001–010-manifestet; seeds/roles må være tomme. Ukjente data, grants, roller, filer, CLI-advarsler eller strukturer stopper kjøringen.
- `.runtime/prod-g2b/routine-manifest.json` inneholder bare filstier og SHA-256 for rutine/runtime/kontrollfil. PowerShell- og Node-delene kontrollerer dette. Hele mappen er Git-ignorert. SHA-256: PS-rutine **`2a5babd15c066ba6bdcf44260bedf129ac658241d1d67be5dc049c7ca1122b80`**, Node-runner **`6f9b6878964a4b33463ad364262431146f33be015ba43bb10fb89686ca6b72d6`**.

### Lokal operatørhandling — kjør én gang fra repository-roten

Se gjennom rutinen først. Følgende kommando inneholder **ingen credentials**; passordet oppgis først i den skjulte prompten:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File ".\.runtime\prod-g2b\Invoke-ProdG2B.ps1"
```

Den kontrollerte agentverten har effektiv PowerShell-policy `Restricted`. Kommandolinjevalget ovenfor gjelder **bare den nye operatørprosessen**, slik at den lokale, gjennomgåtte rutinen kan kjøres uten en permanent bruker-/maskinpolicyendring. Agenten har ikke startet kommandoen eller endret noen policy. En eventuell Group Policy har fortsatt forrang; ved blokkering stoppes arbeidet fremfor å omgå organisasjonskrav. Se [Microsofts forklaring av prosessavgrenset execution policy](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies?view=powershell-5.1). Ikke bruk `Set-ExecutionPolicy`, Unrestricted/Bypass, passord i kommandoen eller debug-/trace-utdata som en alternativ metode.

Rutinen skriver `operator-attempt.json` før første nettverksoperasjon og `dry-run-attempt.json` før den ene planforespørselen. En eksisterende forsøkskvittering sperrer ny kjøring. Ved feil/hard avbrytelse skal disse filene **ikke slettes eller nullstilles for å prøve igjen**; rapporter først. Ingen automatisk opprydding eller videre tillatelse utledes fra et mislykket forsøk.

Resultatet vil ligge i `.runtime/prod-g2b/operator-result.json` og vises redigert i terminalen. Fullt bestått krever `status="PASSED"`, `dryRunAttempts=1`, de ti riktige pending-filene, `remoteUnchangedVerified=true`, `historyUnchangedVerified=true` og `stoppedBeforeG3=true`. Ved `STOPPED` beholdes kvittering og eventuelle lokale linkfiler for gjennomgang; remote uendret må ikke påstås med mindre etterkontrollen faktisk er fullført. Gi beskjed når operatørkjøringen er ferdig, slik at kvitteringen kan leses; ikke send passord, tokens eller rå CLI-logger.

**Lokal verifikasjon:** Node-syntaks og PowerShell AST-parsing består. **25 offline sikkerhetskontroller** består, inkludert feil/rekkefølge/ekstra pending-filer, seed-/rolleplan, endret RLS-hjelper/trigger, ikke-tom database, manglende grants, feildetaljer som skal skjules, og separat barneprosess som med tomt passord stopper uten forsøksfil eller CLI-kall. Barneprosesstesten traff først sandkassens `spawn EPERM`; uendret test bestod med lokal prosessadgang. Dette er ikke en prøve av virkelig passordinnskriving, DB-autentisering eller Supabase. Ingen live-forsøks-/resultatfil finnes ennå. **G3 er fortsatt ikke godkjent.**

## 1. Forutsetninger og første sikre gjennomføringssteg

Prosjektet finnes nå. Følgende rammer må fortsatt dokumenteres før videre oppsett:

1. Hvilken foreningseid Supabase-organisasjon og hvilke navngitte personer som skal eie/drifte prosjektet. Sikre MFA, gjenoppretting og overlevering; ingen personlige engangsansvar uten reservekontakt.
2. Region er **West EU (Ireland), `eu-west-1`**, bekreftet med PostgreSQL 17.11. Databehandler-/regionvalg og tjenestens driftsforutsetninger må fortsatt være vedtatt av ansvarlig; ikke flytt til Stockholm.
3. Plan er **Free**, manuelt bekreftet av prosjektansvarlig 24.10.2026. Dokumenter fortsatt kostnadsramme og backupansvar. Ikke oppgrader, kjøp tillegg eller sett DEV på pause uten egen godkjenning.
4. Om første åpning skal være en begrenset pilot, og hvilke funksjoner som faktisk skal tilbys. Anbefalingen er Google + kjernefunksjoner + in-app-varsler; e-postsending holdes av.

**Neste sikre steg etter avsluttet G1/G2A:** Prosjektansvarlig kjører den klargjorte operatørrutinen for allerede godkjent G2B og skriver passordet skjult lokalt. Ingen ny prosjektopprettelse, migrasjon, OAuth, Edge Function eller bruker følger automatisk av dette. G3 krever fortsatt separat godkjenning.

Planen forutsetter ikke at dagens lokale kildekode allerede er en godkjent release. Forrige revisjon fant 0 commits/remotes og to røde layouttester. Før installasjon/deploy må en gjennomgått release-revisjon, grønne relevante tester og filfingeravtrykk foreligge, etter egne godkjenninger. Se [LAUNCH_READINESS_REVIEW.md](LAUNCH_READINESS_REVIEW.md).

## 2. Objektkart for et helt nytt prosjekt

### 2.1 Supabase-forutsetninger — ikke bygg egne erstatninger

Et nytt hosted Supabase-prosjekt har allerede plattformobjekter. «Tomt» betyr **ingen appdata eller appobjekter fra oss**, ikke en rå PostgreSQL-instans uten Supabase:

- `auth.users`, `auth.uid()`, Auth-identiteter og håndterte Auth-tjenester.
- `storage.buckets`, `storage.objects`, `storage.foldername()` og `storage.extension()`.
- Roller som `anon`, `authenticated`, `service_role` og nødvendig prosjektadministrativ SQL-tilgang.
- PostgreSQL-funksjoner som `gen_random_uuid()` og `hashtextextended()`.

Disse må verifiseres lesende før installasjon. **Ikke kjør `tests/db/bootstrap.sql` i PROD**; den inneholder lokale shims, ikke Supabase-oppsett. Stopp ved manglende objekter eller uventede rettigheter; ikke opprett egne Auth-/Storage-tabeller som en snarvei.

### 2.2 Applikasjonsskjema, tabeller og relasjoner

Migrasjonene oppretter **21 public-tabeller + 2 private-tabeller**, RLS, constraints, indekser, sekvenser og **42 siste funksjonsdefinisjoner**:

| Gruppe | Tabeller |
| --- | --- |
| Konto og medlemskap | `public.profiles`, `user_roles`, `memberships`, `notification_preferences` |
| Tilgangsgrupper | `public.access_groups`, `group_members`, `event_access_groups` |
| Arrangementer | `public.event_categories`, `events`, `event_teams`, `event_registrations` |
| Forslag | `public.suggestions`, `suggestion_votes` |
| Avstemninger | `public.polls`, `poll_options`, `poll_votes` |
| Innhold og kontakt | `public.announcements`, `site_settings`, `contact_submissions` |
| Varsler og sporbarhet | `public.notifications`, `audit_logs` |
| Serverintern tilstand | `private.email_outbox`, `private.rate_limits` |

Viktige relasjoner/constraints som skal beholdes:

- Profil refererer til `auth.users`; signup-trigger oppretter profil, **studentrolle** og varslingspreferanser. Medlemskap opprettes ikke automatisk.
- Én registreringsrad per `(event_id,user_id)`, riktig lag/arrangement via sammensatt FK, frist før start, slutt etter start og kapasitet/laggrenser.
- Én medlemskapsrad per bruker og én stemme per bruker/forslag eller avstemning; poll-option må tilhøre riktig poll.
- Kosthensyn krever samtykketidspunkt. Rolle- og statustekster er begrenset av constraints.
- Kontoens personrader fjernes via cascades. Bevarte forfatter-/kaptein-/oppretter-/audit-referanser anonymiseres der FK-modellen angir det.
- Event-FK-er fra registreringer, lag, varsler og event-grupper skal alle sperre permanent utkast-sletting.
- Kø-, bruker-, dato- og FK-indekser i 001/004 samt unik påminnelsesindeks skal finnes. Ikke erstatt disse med kun UI-validering.

**10 apptriggere:** `on_signup` på Auth, `touch_profile`, `touch_event`, `touch_membership`, `event_guard`, `event_changed`, `before_profile_delete`, `audit_poll`, `audit_announcement`, `announcement_published`. Aktivering og riktig triggerfunksjon skal verifiseres i katalogen.

### 2.3 RLS-policyer og klientprivilegier

Alle 23 app-tabeller skal ha RLS aktivert. Tabellen nedenfor viser policyene fra migrasjonene; grants begrenser i tillegg hva klientrollene faktisk får gjøre.

| Tabell(er) | Policyer / tilsiktet tilgang |
| --- | --- |
| `profiles` | `profile_read`, `profile_edit`: egen konto / staff-lesing; bare navngitte profilkolonner kan oppdateres |
| `user_roles` | `roles_read`: egen rolle/admin-lesing; ingen direkte klientendring av roller |
| `memberships` | `memberships_read`: egen/staff; statusendringer via sjekket RPC |
| `access_groups`, `group_members` | `groups_read`, `group_members_read`: staff / egne medlemskoblinger |
| `event_categories` | `categories_read`: offentlig |
| `events` | `events_read`, `events_create`, `events_edit`: publisert/avlyst offentlig, utkast staff; create/edit bare staff. Ingen generell klient-DELETE |
| `event_access_groups`, `event_teams` | `event_groups_read`, `teams_staff`: rå data staff; lagvisning via avgrenset `list_teams` |
| `event_registrations` | `registrations_read`: egen/staff; registrering/avmelding skjer gjennom RPC |
| `suggestions`, `suggestion_votes` | `suggestions_private`, `suggestion_votes_own`: egen/staff rå forslagslesing, egne stemmer; offentlig anonymisert feed via RPC |
| `polls`, `poll_options`, `poll_votes` | `polls_read`, `polls_create`, `polls_edit`, `options_read`, `own_poll_votes`: publiserte spørsmål/valg offentlige, staff-administrasjon, individuelle stemmer egne |
| `announcements` | `announcements_read`, `announcements_staff`: publisert offentlig, staff-skriving |
| `site_settings` | `settings_read`, `settings_edit`: offentlig lesing, staff-oppdatering |
| `notification_preferences`, `notifications` | `prefs_own`, `notifications_own`: egen bruker; navngitte preferansekolonner kan oppdateres, varsel-lest via RPC |
| `contact_submissions` | `contacts_read`, `contacts_resolve`: egen/staff-lesing, bare staff kan sette `resolved`; innsending via RPC |
| `audit_logs` | `audit_staff`: staff-lesing, ingen klientskriving/sletting |
| `private.email_outbox`, `private.rate_limits` | RLS på; ingen direkte anon/authenticated-tabelltilgang. Server/definer håndterer tilstanden |

Eksponerte API-skjemaer skal gjennomgås manuelt: appen trenger `public`, ikke `private` eller `auth`. Lokalt oppsett angir også plattformens `graphql_public`; det er ikke en grunn til å eksponere ekstra interne skjemaer i PROD. Schema-usage for sjekkfunksjoner er ikke det samme som å gjøre `private` til et PostgREST-skjema.

Publiserte event-metadata er offentlige selv når påmeldingsmålgruppen er medlemmer/grupper. Synlige pollaggregater er offentlige etter gjeldende regler; målgruppe begrenser stemmegivning. Anonyme forslag er anonyme i offentlig feed, ikke overfor modererende staff. Disse produktgrensene må forklares og ikke utvides tilfeldig i produksjonsoppsettet.

### 2.4 RPC-er og interne funksjoner

| Gruppe | Funksjoner som må finnes i siste versjon |
| --- | --- |
| Offentlig lesing | `event_summary`, `suggestion_feed`, `poll_results` |
| Arrangementer | `register_event`, `cancel_registration`, `list_teams`, `assign_team`, `mark_attendance`, `send_event_announcement`, `delete_draft_event` |
| Community | `apply_membership`, `manage_member`, `submit_suggestion`, `vote_suggestion`, `moderate_suggestion`, `create_poll`, `vote_poll` |
| Konto/administrasjon | `set_role`, `manage_group`, `submit_contact`, `read_notification`, `export_my_data`, `prepare_account_deletion` |
| Server-only | `run_maintenance`, `claim_emails`, `email_preference`, `finish_email` |
| Interne `private`-funksjoner | `is_staff`, `is_admin`, `require_user`, `rate_limit`, `eligible`, `notify`, `promote`, `on_signup`, `touch`, `event_guard`, `event_changed`, `before_profile_delete`, `audit_change`, `announcement_published`, `upload_quota` |

Kontroller signaturer, definereier, `SECURITY DEFINER` der relevant, tom `search_path`, execute-grants og funksjonskropp. Et grant til `authenticated` betyr ikke at alle autentiserte har lov til handlingen; admin-/staff-/eierkontrollen ligger i funksjonen. Ikke gi klienter generell DELETE eller service-grants for å løse en testfeil.

### 2.5 Storage og Edge Functions

Migrasjon 003 oppretter bucketene; **de skal ikke opprettes manuelt på forhånd**:

| Bucket | Sluttkonfigurasjon | Skriving / lesing |
| --- | --- | --- |
| `event-images` | Public, 4 194 304 byte, JPEG/PNG/WebP | Opplasting via staff-autorisert `image-upload`, ikke direkte nettleser-INSERT. Foreningseide filer beholdes ved kontosletting/event-sletting |
| `avatars` | Samme størrelse/formater, public | Egne UUID-stier, personlig kvote; egne filer slettes gjennom account-delete |
| `suggestion-images` | Samme størrelse/formater, public | Egne UUID-stier; metadata-listing bare eier/staff etter 009; anonyme forslag skal ikke vise personlig bildesti |

Storage-policyer: `asset_read` med siste 009-uttrykk, `asset_insert` med siste 004-uttrykk og kvote, `asset_delete` med eier/staff-kontroll. Ingen filkopiering fra DEV. «Public» gjør kjente fil-URL-er lesbare uten en privat nedlastingskontroll, selv om listing er begrenset; se [Supabase bucket-modellen](https://supabase.com/docs/guides/storage/buckets/fundamentals). Ikke lagre sensitiv informasjon eller deltakerlister her.

| Edge Function | Første PROD-plan | Avhengigheter |
| --- | --- | --- |
| `account-delete` | Påkrevd før åpning; deploy og test særskilt | `handler.ts`, `_shared/client.ts`, gyldige servernøkler, `prepare_account_deletion`, slettetrigger/FK-er, personlige buckets og eksakt PROD-origin |
| `image-upload` | Egen godkjenning; aktiv bare etter test | Samme delte klient, staff-rolle, `event-images`, origin, signatur-/størrelse-/kvotekontroll |
| `notifications` | **Ikke deploy/aktiver ved første Google/in-app-lansering** | Kjører både maintenance og valgfri e-post. Skal ikke brukes som nødvendig mellomledd for retensjon |

Dagens `verify_jwt=false` er tilsiktet: account-delete/image-upload validerer bruker med Auth og egne kontroller, notifications krever egen serverhemmelighet. Bevar dette gjennomgåtte skillet; ikke anta at anon-key er et brukertoken. Aktiver ikke anonyme slette-/opplastingsveier.

## 3. Førstegangsinstallasjon av 001–010

### 3.1 Anbefalt metode og skillet fra DEV

**Bruk Supabase CLI-migrasjoner fra starten i PROD**, fra en isolert release-katalog med en fast, gjennomgått kildeversjon. CLI-historikken skal etableres som del av den første godkjente installasjonen. Ikke bruk en dump fra DEV eller import av DEV-historikken som baseline.

DEV har ikke attestert CLI-historikk og har allerede 010 installert manuelt. Det er et separat fremtidig arbeid å eventuelt etablere historikk der. **Ingen del av denne planen reparerer DEV eller kjører 010 der igjen.** I et faktisk tomt PROD skal derimot alle ti filer anvendes én gang, inkludert 010.

CLI sammenligner versjoner i `supabase_migrations.schema_migrations`, registrerer vellykkede anvendelser og støtter en planvisning med `db push --dry-run`. Se [CLI db push](https://supabase.com/docs/reference/cli/supabase-db-push). Historikk er ikke i seg selv en innholdssjekksum; behold også kildehashene og release-revisjonen.

`scripts/bundle-sql.mjs` kan samle alle SQL-filene i en transaksjon, men dagens header sier utviklingsprosjekt og SQL Editor-metoden oppretter ikke CLI-historikk. **Den er ikke anbefalt PROD-metode her og skal ikke kjøres i tillegg til CLI.** Eldre `docs/SUPABASE.md` viser historisk femfilers reparasjon; den instruksjonen skal ikke brukes for nytt PROD.

### 3.2 Kontrollert rekkefølge og avhengigheter

| Rekkefølge / fil | Krever | Effekt og kontroll |
| --- | --- | --- |
| `202610230001_schema.sql` | Managed Auth/Storage/roller og PG-funksjoner | Skjema, 23 tabeller, constraints/indekser, signup/touch, RLS/grants, roller. Legger inn **9 kategorier og 1 standard site_settings-rad**, ingen brukere/events |
| `202610230002_workflows.sql` | 001 | Påmeldinger/venteliste, community, roller/grupper, varsler, dataeksport, kontoslettingsguard og execute-grants |
| `202610230003_operations.sql` | 001–002, Storage-hjelpere | 3 buckets/policies, audit-/kunngjøringstriggere, maintenance-/outbox-funksjoner og service-grants/default execute-herding. Starter ingen jobb |
| `202610230004_hardening.sql` | 003 og eksisterende `asset_insert`/outbox | Erstatter opplastingspolicy, kvote, `first_attempt_at`, avgrensede retries, `prepare_account_deletion`, supplerende indekser |
| `202610230005_maintenance_fix.sql` | Maintenance fra 003 | Erstatter vedlikeholdsfunksjonen med korrigert variabelnavn; kaller den ikke |
| `202610230006_registration_deadline.sql` | Påmeldingsfunksjoner fra 002 | Veggklokke etter lås i registrering/opprykk; ingen påmeldinger utføres |
| `202610230007_suggestion_anonymity.sql` | Forslagsfeed fra 002 | Skjuler personlig bildesti i anonyme forslag |
| `202610230008_poll_deadline.sql` | Poll-RPC fra 002 | Kontrollerer åpning/stenging etter lås |
| `202610230009_suggestion_storage_privacy.sql` | `asset_read` fra 003 | Begrenset listing av forslagsbilder |
| `202610230010_delete_draft_event.sql` | Roller, events, alle 4 event-FK-tabeller, audit og require_user | Oppretter admin-RPC for tomme utkast og execute-grants. **Utfører ingen sletting** |

003 definerer vedlikeholdet før 005 retter det; ingen må kalle funksjonen mellom disse trinnene. 004 må komme etter opprettelse av policyen den dropper. Full kjede skal være ferdig og kontrollert før nye appbrukere/OAuth-åpning. Ingen fil hoppes over fordi en senere fil erstatter en funksjon.

### 3.3 Før-, utførelses- og etterkontroll

**Før installasjon, eget stoppunkt:**

1. Bekreft på nytt at mål er nøyaktig `unrdvalfkusnqhbfhber`, med riktig organisasjon/navn og `eu-west-1`; avvis DEV `gawhbppuhnixqvhnnpnn`, plassholdere og alle andre refs.
2. Bekreft lesende at det ikke finnes app-tabeller/-funksjoner, appbrukere eller noen av de tre app-bucketene. Plattformens systemobjekter er forventet. Ved funn: stopp; ikke drop, reset eller «gjør tomt».
3. Bruk en separat release-katalog/CLI-binding, ikke endre den vanlige DEV-arbeidskopiens link eller `.env`. Verifiser mål før hver privilegert kommando; en CLI-innlogging er ikke bevis for riktig target.
4. Lås filsettet til nøyaktig de ti godkjente filene og kontroller hashene under. Stopp ved ekstra migrasjoner eller endret innhold.
5. Bekreft at seed er av og ikke bruk `--include-seed`, `--include-roles`, `--include-all`, `--yes`, `db reset`, `migration repair`, `db pull` eller `config push` som hjelpemiddel. Vanlig arbeidskopis `config.toml` inneholder DEV-Auth-adresser; release-katalogen bruker en minimal egen config. Ingen av dem skal pushes som fjernkonfigurasjon. Bruk støttet `--skip-vault` ved push/plan.
6. Verifiser installasjonsforløpet og feil-/transaksjonsadferden til den konkrete CLI-versjonen i en ren lokal Supabase-stack før fjernkjøring. Tidligere 125 PostgreSQL-kontroller er gode SQL-bevis, men lokale Auth/Storage-shims er ikke en hosted installasjonsprøve.

**Senere kommandoplan:** Eksakte link-/dry-run-kommandoer og B0–B7-stoppunkter står i G2A/G2B-delen ovenfor. De bruker den kontrollerte CLI-binæren, eksplisitt release-workdir, `--project-ref unrdvalfkusnqhbfhber` og `--skip-vault`. Ingen av dem er kjørt nå.

G2B skal bare skrive forventet **lokal** CLI-cache; den gjennomgåtte 2.122.0-dry-run-stien oppretter ikke migrasjonshistorikk. Tilkobling uten passord kan likevel opprette SQL-loginrolle, og er derfor ikke en tillatt automatisk fallback. G3 er en ny godkjenning etter mottatt G2B-resultat og lokal CLI-/Supabase-prøve. Først der kan samme kontrollerte `db push` kjøres **uten `--dry-run`**, med fortsatt `--skip-vault` og ingen include-flagg. Historikktabellen opprettes da av apply-stien, og etterkontroll skal vise nøyaktig 001–010. Ingen DB-passord/tilkoblingsstreng skal skrives i chat, kommandohistorikk eller rapport.

Ikke lov at **hele** 001–010 er én atomisk transaksjon med CLI. Kildeanalysen av 2.122.0 viser ordinære transaksjonsbatcher per fil, med separat historikkoppsett; en faktisk lokal CLI-/Supabase- og rollbackprøve gjenstår før G3. Tidligere filer kan være ferdig anvendt når en senere feiler. Ved feil: stopp utrullingen, hold frontend/innlogging lukket for lansering, les faktisk historikk/objekter og rapporter hva som er committed. Ikke reparer historikk, slett objekter eller prøv en ny installasjonsmetode uten ny godkjenning.

**Etter installasjon, før neste endring:**

- Nøyaktig ti historikkversjoner: `202610230001` til `202610230010`; ingen oppdiktede eller manuelt «applied»-merkede versjoner.
- 23 app-tabeller med RLS, 42 siste funksjonskropper og riktige signaturer/grants, 10 apptriggere, forventede constraints/indekser og de 4 event-FK-tabellene.
- Anon kan lese de planlagte offentlige dataflatene, men ikke personrader; klienter får ikke generell event-DELETE eller skriving av roller/medlemsstatus/stemmer/påmeldinger.
- 3 buckets med riktige sluttpolicyer, 0 Storage-objekter.
- **0 Auth-appbrukere, 0 profiler/roller/events/registreringer/forslag/polls/varsler/audit**. Bare 9 kategorier og 1 standard innstillingsrad i appdata er forventet før egne innholds-/kontoendringer.
- Ingen Edge Functions, cron-jobber eller e-postutsending startet av migrasjonene. De er egne oppsettstrinn.
- Lesende readiness-filer kan brukes som kontrollgrunnlag, men deres kommentarer/skript er DEV-spesifikke. Lag en godkjent PROD-bundet kontroll med samme forventninger, ikke kjør en DEV-bundet klient mot PROD ved å fjerne sperrene.

### 3.4 SHA-256-manifest for gjennomgått filsett

Dette er hashene lest lokalt i planleggingsfasen. Ved endringer må filsett og godkjenning gjennomgås på nytt; et senere godkjent release-manifest skal knyttes til en bestemt Git-revisjon.

| Filprefiks | SHA-256 |
| --- | --- |
| 001 | `4efc78b9665dd2f503065bcd5c793f7af1fbf6615d22d89e12a4de989a36800a` |
| 002 | `1b5ed1c2bc19585837935a0026c01e234f6fa3f3bdade9d1194afb500b615c26` |
| 003 | `6d8753b73dd0629531bcd8b836f76ff2b17c4c91f7aa61702f236a3e66300f5a` |
| 004 | `da58fff8b64dde1ddb57375c706b66c8d7d20166dbec8143b249a1d3048ebe70` |
| 005 | `31bfa6eb8825982e73bd1952bdfc95a59fc77d318ac6cdd73571b7b60eb511fc` |
| 006 | `3aed31933cd92e85d8ed8cdb7a88e94dc5b9e2b3a167ae7b623d6544bfe26c71` |
| 007 | `4e0a4dfba24539bf9255e8fe9ca2f85efbda74f3a6ba1c98b606bc9bdec1e811` |
| 008 | `82b5da8bed08d3ff7f64abe2472ff8a95fa195b0594af777b9a759a7127f12f1` |
| 009 | `fccf859fe46fa9795ec0860de4a2bf0df9f518175f902922eb06e47ff0308682` |
| 010 | `13c2b0ce19f57f4f5b8f85f5a9a5fafbd0d4a9e08c18a4b0932a79a2dc0ba1b2` |

## 4. Miljøvariabler, nøkler og secrets

Ingen hemmelige verdier er lest ut eller gjengitt i planen. Nye PROD-hemmeligheter skal genereres i PROD/Google, ikke gjenbrukes fra DEV.

### 4.1 Offentlig frontend og GitHub-build

| Variabel | PROD-verdi / kilde | Plassering |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://unrdvalfkusnqhbfhber.supabase.co`, prosjektets rot-URL | Injiseres i godkjent Pages-build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | PROD publishable key fra Dashboard API Keys; ingen service-/secret-key | Samme build, offentlig verdi |
| `VITE_BASE_PATH` | `/pluss-minus-null-stress/` | Eksplisitt buildverdi |
| `VITE_DEMO_MODE` | `false` | Eksplisitt releaseverdi; fake/test-backend er ikke en release |
| `VITE_ENABLE_DEV_PASSWORD_LOGIN` | `false` i release | Eksisterende `DEV`-sperre skal fortsatt testes; lokal DEV beholder eget valg |

Anbefalte nye GitHub **repository variables**, kun offentlige verdier: `PROD_SUPABASE_PROJECT_REF`, `PROD_SUPABASE_URL`, `PROD_SUPABASE_PUBLISHABLE_KEY`. De mappes senere eksplisitt til Vite-variablene i en godkjent workflowendring. Dette er et forslag, ikke allerede støttede variabelnavn i dagens workflow.

### 4.2 Server og operatør

| Navn / opplysning | Bruk og håndtering |
| --- | --- |
| `ALLOWED_ORIGIN` | Egen PROD Edge-secret med verdien `https://jya2002.github.io`. Felles for funksjonene i dette prosjektet; ingen DEV-endring |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Dagens Edge-adapter leser disse fra det håndterte miljøet. Bekreft tilgjengelighet og riktig prosjekt, aldri verdier i logger. Ikke sett `SUPABASE_*` manuelt som kopier av DEV |
| Google OAuth Client ID / Client Secret | Ny PROD-webklient; legges bare i PROD Auth-provider via Dashboard. Client ID er ikke en frontendavhengighet her; secret er aldri en `VITE_`-verdi |
| Supabase CLI-innlogging / eventuell access token og databasepassord | Bare godkjent operatør/provisioneringsmiljø. Ikke nødvendige i frontend eller den ordinære Pages-workflowen |
| Signing keys / JWT-materiale | Genereres og håndteres av Supabase separat for det nye prosjektet. Ingen eksport/import fra DEV |
| Backup-krypteringsnøkler | Separat tilgangsstyrt lagring fra backupfilene; gjenopprettingsansvarlig må ha dokumentert tilgang |

**Nøkkelkompatibilitet er et stoppunkt:** Gjeldende [Supabase Edge-dokumentasjon](https://supabase.com/docs/guides/functions/secrets) beskriver både nye JSON-ordbøker (`SUPABASE_PUBLISHABLE_KEYS`/`SUPABASE_SECRET_KEYS`) og legacy-miljønavn. Vår kode leser legacy-navnene. Hvis det nye prosjektets runtime ikke leverer de forventede variablene, stopp og foreslå en liten, separat testet adapterendring. Ikke aktiver svakere Auth-kontroller eller kopier DEV-nøkler for å få deployen til å virke. Frontend skal fortsatt bruke PROD publishable key.

### 4.3 Ikke nødvendige ved Google/in-app-lanseringen

`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `NOTIFICATION_WORKER_SECRET`, Vault-navnene `pmns_project_url`/`pmns_worker_secret` og SMTP-passord er **ikke** nødvendig for Google, account-delete eller direkte SQL-retensjon. Opprett dem ikke i første runde. De vurderes bare dersom e-postworker senere godkjennes; `APP_URL` vil da være full Pages-URL med repo-sti.

`PMNS_TEST_SERVICE_ROLE_KEY` og eksisterende testgodkjenningsflagg er DEV-testoppsett, ikke produksjonskonfigurasjon. Legg ikke PROD-legitimasjon i `.env.registration-tests.local`, og gi ikke PROD-servernøkler til GitHub Pages.

## 5. Google OAuth, redirects og CORS

### 5.1 Eksakte planlagte adresser for registrert PROD-ref

| System / felt | PROD-verdi |
| --- | --- |
| Google Cloud, ny Web OAuth-klient: Authorized redirect URI | `https://unrdvalfkusnqhbfhber.supabase.co/auth/v1/callback` |
| Google Cloud: Authorized JavaScript origin dersom feltet konfigureres | `https://jya2002.github.io`, uten sti. Standard Supabase redirect-flyt bruker ikke en egen Google JS-SDK i appen |
| Supabase Auth: Site URL | `https://jya2002.github.io/pluss-minus-null-stress/` |
| Supabase Auth: tillatt redirect | Nøyaktig samme fulladresse, med avsluttende `/` |
| Edge `ALLOWED_ORIGIN` | `https://jya2002.github.io` |
| Frontend OAuth-retur | Eksisterende `origin + pathname`, deretter `?code=...`, PKCE-utveksling og HashRouter-retur |

Google returnerer til Supabase, og Supabase returnerer til appen. Ikke sett Pages-adressen som Google-callback, og ikke legg `#/logg-inn`, `/auth/callback`, en wildcard eller repo-stien i Edge-origin. Supabase-allowlisten må matche den faktiske app-returen; se [redirect-veiledningen](https://supabase.com/docs/guides/auth/redirect-urls).

Ingen localhost-/DEV-redirecter i PROD-planen. Et eventuelt senere behov for en avgrenset produksjonspreview er en egen godkjent adresse og test, ikke en grunn til å endre vanlig lokal utvikling til PROD.

### 5.2 Manuelle Google Cloud-punkter

1. Opprett en separat PROD Cloud-prosjekt-/klientkonfigurasjon under avtalt eierskap; ikke endre eksisterende DEV-klient eller legg PROD-callbacken i den som snarvei.
2. Konfigurer appnavn, ansvarlig support-/utviklerkontakt, External-målgruppe for de tiltenkte studentene og relevante publiserings-/verifikasjonskrav.
3. Bruk bare `openid email profile`. Ingen Gmail, Drive, Calendar, offline-tilgang eller andre utvidede scopes er nødvendig.
4. Legg inn eksakt PROD-callback og eventuelt origin fra tabellen. Home page kan være Pages-rotadressen; personvernlenken skal peke på faktisk offentlig personvernside. Kontroller om konsollen godtar hash-ruten, og stopp dersom den krever en separat offentlig URL/verifisering som ikke er levert.
5. Opprett og lagre nytt client-secret privat. Legg det bare i PROD Supabase-provider, og avtal rotasjon/eierskap.

Google har egne produksjonskrav om miljøskille, kontaktinformasjon og tillatte URI-er; se [produksjonspolicyen](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance). **Ikke anta at Testing gir en privat pilot:** grunnleggende identity-scopes har et dokumentert unntak fra ordinær testbruker-allowlist. Kontroller faktisk konsollstatus og hva brukeren ser; se [app state](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview). Ikke påstå eierskap til `github.io` eller `supabase.co`, og ikke kjøp domene automatisk ved et verifikasjonskrav. Standard Supabase callback og gratis Pages-hosting krever ikke i seg selv et kjøpt custom domain.

### 5.3 Manuelle Supabase Dashboard-punkter

- Kontroller at Dashboard viser PROD, riktig organisasjon/region og prosjektstatus før hver endring.
- Auth → URL Configuration: sett Site URL og eksakt allowlist fra tabellen.
- Auth → Providers → Google: nye PROD-klientverdier, korrekte sikre provider-valg. Ingen «skip nonce checks», konto uten e-post eller rolleavledning fra metadata.
- Google signup må være mulig ved den senere godkjente første innloggingen. Åpning av provider/signup er en egen ekstern endring og skal først skje når personvern, backend og driftsrutiner er klare. Ikke kall en teknisk åpen signup «lukket pilot» fordi ingen invitasjoner er sendt.
- Anbefalt første produktomfang er Google-only. E-postprovider/alternativets UI må avklares sammen: eventuell deaktivering av e-postmetoden i PROD krever egen Auth-godkjenning og Google-test. Behold e-postbekreftelsesbeskyttelsen; ikke slå den av globalt. SMTP skal ikke konfigureres eller testes uten egen beslutning.
- Gjennomgå Auth-rategrenser, session-/JWT-standarder, signing keys og behov for misbruksvern. Ta vare på sikre standarder; ingen automatisk CAPTCHA-/kvoteendring i denne planen.
- API-innstillinger: bare nødvendige eksponerte skjemaer, RLS/grants/readiness og Security Advisor. Storage: verifiser de migrerte bucketene/policyene, ikke opprett dem på nytt.
- Edge Functions → Secrets: opprett bare den konkret godkjente PROD-origin-secreten. Deploy bare den navngitte funksjonen etter egen godkjenning.

### 5.4 CORS-verifikasjon og begrensninger

For `account-delete`: GET skal gi 405, OPTIONS fra Pages-origin 204 og eksakt allow-origin. Ukjent origin skal avvises. Manglende/ugyldig bruker-JWT ved POST skal gi avslag uten sideeffekt; dette er et senere godkjent API-testkall, ikke en sletteprøve av administratoren. Sletting med bruker-JWT testes bare på en disponibel konto etter egen fixture-/slettegodkjenning.

Origin er ikke autorisasjon. Flere Pages-repoer under `jya2002.github.io` deler origin og kan dele nettleserlagringsområde; CORS kan ikke skille repo-stier. Hold øvrig aktivt innhold under denne origin betrodd, og ikke legg ukontrollert HTML der. RLS og tokenvalidering må fortsatt håndheves selv om origin stemmer.

## 6. Første administrator uten DEV-kopiering

**Ingen automatisert «første bruker blir admin»-regel skal opprettes.** En ny konto får student fra eksisterende signup-trigger, også når personen allerede er administrator i DEV.

Foreslått, separat godkjent bootstrap:

1. Avtal én navngitt ansvarlig person og Google-konto via sikker kanal. Bruk en konto vedkommende faktisk kontrollerer, med egnet 2FA/gjenoppretting. Ikke legg e-post/UUID i offentlig Git-dokumentasjon.
2. Etter migrasjoner, drift, personvern, OAuth og kontrollert frontenddeploy: godkjenn **én første Google-innlogging i PROD**. Den oppretter en ny Auth-ID og profil/rolle/preferanser fra bunnen av. Samme menneske kan bruke sin Google-konto, men ingen DEV-rad, session eller privilegium importeres.
3. Kontroller lesende i PROD: riktig Auth-konto og Google-identitet, bekreftet e-post, nøyaktig én profil, `user_roles.role='student'`, og foreløpig 0 adminer. Bekreft personens identitet separat; bruk ikke `raw_user_meta_data.role`, et e-postdomene eller `display_name` som autorisasjon.
4. Stopp og innhent egen godkjenning til å oppgradere **akkurat denne PROD-UUID-en**. En godkjenning til kontoopprettelse er ikke en rollegodkjenning.
5. Prosjektansvarlig utfører en liten, gjennomgått SQL-transaksjon: ta samme administrasjonslås som eksisterende rolle-/sletteflyt (`pg_advisory_xact_lock(70667001)`), kontroller fortsatt 0 adminer, lås/kontroller målrollen og oppdater bare fra student til admin. Krev nøyaktig én endret rad; avvik gir rollback.
6. Registrer en eksplisitt bootstrap-hendelse i `audit_logs`, eksempelvis `action='BOOTSTRAP_ADMIN'`, `entity='user_roles'`, mål-UUID som `entity_id`. SQL Editor-operasjonen har ikke et reelt app-JWT: bruk `actor_id=null` og en privat operatør-/godkjenningskvittering; ikke sett en falsk JWT-UID for å få et tilsynelatende app-kall.
7. Før commit: bekreft én admin, riktig mål-ID og audit. Etterpå logger personen ut/inn, ser Styreportalen og kontrollerer ordinær rollelesing. Ingen sletting av denne kontoen inngår.

`set_role` kan ikke bootstrappes av en student uten admin; det er tilsiktet. Ikke åpne RPC-en, gi direkte klient-UPDATE eller opprett en ny bootstrap-API-rute. Senere andre administratorer gis rolle gjennom den eksisterende adminflyten, til en separat godkjent konto. Avtal en reserveadministrator før offentlig drift; test ikke siste-admin-vernet ved å demotere eksisterende personer.

## 7. Backup, retensjon og overvåkning før studentdata

### 7.1 Backup og restore

**Foreslåtte pilotmål, må vedtas:** RPO høyst 24 timer og RTO høyst 24 timer, daglig verifisert kopi og vedtatt begrenset backupretensjon, eksempelvis 30 dager. Dette er mål, ikke en garanti fra dagens gratisoppsett. Strengere behov må vurderes før åpning.

- Kontroller faktisk plan/backup-tilbud. Ikke anta at gratisprosjektet har administrerte daglige backups eller PITR. Supabase anbefaler egne regelmessige eksporter/off-site kopier for gratisplan; administrert backup og historikklengde avhenger av plan. **DB-backup inkluderer ikke Storage-filinnhold**, bare metadata. Se [Supabase backups](https://supabase.com/docs/guides/platform/backups).
- Velg en konkret, kryptert og tilgangsstyrt lagringsplass, ansvarlig og reserve. Ingen backup i Git, offentlig bucket, buildartefakt, chat eller vanlig testlogg. Ingen betalt tjeneste bestilles uten vedtak.
- Backupplanen må dekke `public`, `private`, nødvendige Auth-data/identiteter, migrasjonshistorikk og relevant Storage-metadata, samt egne binærkopier av eventuelle filer. En eksport av bare public-tabeller er ikke full gjenoppretting.
- Bruk en gjennomgått, støttet eksport-/restore-prosedyre. Ikke anta at en standarddump inkluderer håndterte Auth-/Storage-skjemaer eller at den kan importeres ukritisk i et hosted prosjekt; se [CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
- Dokumenter nye PROD-Auth-/Google-/Edge-/scheduler-innstillinger og nødvendige credentials i separat sikker konfigurasjonslagring. En DB-dump erstatter ikke disse. Ikke legg alle secrets i backupmanifestet.
- Utfør en separat godkjent restoreøvelse i et isolert mål med syntetiske data før studentåpning. Ikke restore i DEV eller aktiv PROD for å teste planen. Verifiser roller, påmelding, Auth-relasjoner og at faktisk filinnhold kan gjenopprettes.
- Gjenoppretting må ikke gjenåpne slettede kontoer/data ukontrollert: ha en begrenset, privat slettings-/hendelsesrutine for å gjenanvende relevante slettinger etter restore. Backupretensjon, kopier og leverandørlogger skal inngå i personvernerklæringen.

Hvis ingen eier kan dokumentere en faktisk kjørbar gratis backup-/restore-prosess, er dette en blokkering, ikke grunnlag for å anta en betalt tjeneste eller redusert sikring.

### 7.2 Retensjon uten e-postworker

Anbefaling: godkjenn senere en **egen PROD Cron-jobb som kaller eksisterende `public.run_maintenance()` direkte som godkjent databaseoperatør**, eksempelvis hvert kvarter. Dette krever egen godkjenning til `pg_cron`/jobben og til testkjøring. Kontroller at faktisk jobbeier/session kan passere den eksisterende service-/postgres-guarden; ikke svekk guarden ved avslag. [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart) støtter databasefunksjon/SQL-jobber og kjøringshistorikk.

Dette er en **ny operasjonsoppskrift som må utarbeides og gjennomgås senere**, ikke en allerede installert jobb. **Ikke kjør `supabase/schedule.sql` som erstatning**: den filen kaller notifications-workeren over HTTP og krever pg_net/Vault/worker-secret. Den er ikke en direkte maintenance-only-plan.

| Data | Eksisterende SQL-frist / annen rutine |
| --- | --- |
| Kosthensyn/samtykketidspunkt | Ved avbestilling eller vedlikehold når eventslutt er mer enn 7 dager gammel |
| Registreringer | 180 dager etter eventslutt |
| Kontaktmeldinger | 90 dager etter opprettelse |
| Varsler og tilhørende outbox | 180 dager; outbox følger varsel-FK |
| Audit | 365 dager |
| Rategrenser | Gamle buckets etter 2 dager |
| Konto/profil/medlemskap/individuelle stemmer | Kontosletting og avtalt årlig kontogjennomgang; ikke automatisk slettet av maintenance bare fordi de er gamle |
| Forslag og arrangementsinnhold | Beholdes/anonymiseres etter modellen; fritekst må gjennomgås ved personvernhenvendelser |
| Storage, eksport/CSV, backups og leverandørlogger | Egen godkjent rutine; ikke lov at vedlikeholdsfunksjonen rydder alt dette |

Avklar faktisk håndhevelsesfrist, jobbintervall og tillatt forsinkelse i informasjonen til brukeren. Test datoer på begge sider av grensene og ved retry. Ikke lov presis sletting på sekundet når jobben kjører periodisk. Maintenance kan også opprette in-app-påminnelser/outbox, men sender ikke e-post. Manglende e-postoppsett skal ikke hindre datarydding.

**Kosthensyn må ikke samles inn før rutinen er testet og behandlingsopplegget er vedtatt.** Dagens app har ikke en funksjonsbryter som håndhever «ingen kosthensyn»; en slik avgrensning trenger en separat godkjent løsning i både klient/server dersom den velges i stedet for fungerende retensjon.

### 7.3 Overvåkning og beredskap

| Kontroll | Foreslått minimum før åpning |
| --- | --- |
| Cron | To observerte vellykkede kjøringer, manuell test av avvik/feilrutine; varsel til ansvarlig ved to uteblitte kvarterskjøringer. Cron-jobbens navn må være unikt og eksisterende jobb sjekkes før registrering |
| Backup | Daglig kontroll av siste gode backup, lesbar/kryptert fil, størrelse og restore-kvittering; feil varsles straks |
| Auth/Edge | Følg innloggingsfeil, 401/403/5xx og account-delete-feil. Ikke logg JWT, passord, rå bodies eller Google-/brukerprofiler |
| Database/RLS | Security Advisor, uventede grants/skjemaendringer, låsefeil og kapasitetsavvik; ingen automatisk «fiks» som endrer RLS |
| Ressurser | DB-/Storage-/egress-/Auth-/Edge-kvoter, mulige gratisplan-pauser og kostnader; ikke lov høy tilgjengelighet ut fra gratis hosting alene |
| Menneskelig ansvar | Primær og reserve, støtteadresse, responstid, hendelses-/nøkkelrotasjons-/kontogjenopprettingsrutine og godkjent håndtering av personvernhenvendelser |

Observabilitet trenger også en faktisk varslingskanal. At driftsansvarlig kan åpne Dashboard er ikke automatisk overvåkning. Løsningen og eventuelle eksterne varsler/tjenester må avtales; ingen e-post eller ny tjeneste aktiveres av planen. Supabase har en egen [produksjonssjekkliste](https://supabase.com/docs/guides/deployment/going-into-prod) for plattformkontroller.

## 8. Funksjonsomfang ved første lansering

| Funksjon | Anbefaling / nødvendig kriterium |
| --- | --- |
| Offentlige sider, Google, Min side | Aktive først etter godkjent offentlig test, ferdig kontakt/personvern og fungerende drift |
| Medlemskap, events, på-/avmelding, venteliste, forslag, polls | Aktive etter PROD-readiness og avgrenset rolle-/funksjonsprøve. Alle starter med nye PROD-data, ikke DEV-import |
| Admin/styre og utkast-sletting | Kun eksplisitt tildelte PROD-roller; test med ett disponibelt utkast, aldri eksisterende arrangement som offer |
| Kontosletting | Påkrevd aktiv og testet fra Pages, med nylig Google-innlogging og ingen administrator som slettemål |
| Dataeksport | Test faktisk nedlasting av bare egne data før åpning |
| In-app-varsler / vedlikehold | In-app aktiv; maintenance-only-jobb må fungere før studentdata. Varsler uten automatisk sanntidsoppdatering kommuniseres ærlig |
| Arrangementsbilder | Deploy/test `image-upload` separat før den tilbys. Ellers må opplastingskontrollen skjules/deaktiveres i en godkjent frontendendring |
| Profil-/forslagsbilder | Migrasjonene tillater dem allerede. Test reell eierskap-/kvote-/sletteflyt før bruk, eller godkjenn en reell server-/klientavgrensning; å skjule en knapp alene sperrer ikke API-opplasting |
| Auth-e-post/OTP/SMTP | Ikke tilbudt ved første Google-only-åpning før separat leveringsgodkjenning. Dagens alternative UI er fortsatt synlig og må håndteres i egen endring |
| notifications/Resend/arrangementsmailer | Ikke deploy/aktiver nå; ingen worker-secret eller e-postleverandør påkrevd for kjernen |
| Demoseed / DEV-fixtures | Aldri importer i PROD. Eventuelle senere PROD-testobjekter krever egen avgrenset godkjenning/markering |

Det finnes ikke eksisterende konfigurasjonsflagg som alene skjuler alle utestede metoder. Anbefalt redusert omfang er derfor **et krav til en separat implementerings-/konfigurasjonsoppgave**, ikke en påstand om at funksjonene allerede er av. De to røde mobiltestene må også avklares før en godkjent release.

Ved eventuell senere e-postaktivering: `email_events` er true som standard og outbox kan akkumulere ventende meldinger selv om worker er av. Før aktivering må køalder, preferanser og første utsendelsesomfang godkjennes; ikke send en gammel kø automatisk, nullstill retries eller merk alt sendt. Ingen slike køendringer eller utsendinger inngår i førstegangsplanen.

## 9. DEV/PROD-skille i frontend og GitHub Actions

### 9.1 Lokal utvikling skal forbli DEV

- Behold eksisterende lokale `.env`-verdier og DEV-prosjektet uendret. `npm run dev` skal fortsatt treffe DEV med lokal base `/`.
- Ikke legg PROD-hemmeligheter i noen frontendmiljøfil. Ikke opprett en generell `.env.production.local` i den vanlige arbeidskopien som en skjult global overgang til PROD.
- Godkjent releasebygging skjer i en ren, isolert checkout/runner med **prosessavgrensede offentlige PROD-verdier**. Nye shell-/jobbkontekster hindrer at PROD-verdier arves av lokal `npm run dev`.
- Vite injiserer klientvariabler ved build. Modusnavnet `production` velger ikke automatisk et annet Supabase-prosjekt. Prosessmiljø har forrang over dotenv-filer; en vanlig lokal `npm run build` kan ellers falle tilbake til DEV-URL-en. Se [Vite env/mode](https://vite.dev/guide/env-and-mode).
- En produsert build må valideres for forventet PROD-ref, riktig offentlig nøkkel, ingen DEV-/mock-origin og ingen secrets. Runtime-rotasjon av frontendnøkkel krever nytt bygg; servernøkler skal ikke ligge der.

### 9.2 Nødvendig, separat godkjent workflowendring

Dagens `.github/workflows/pages.yml` leser repository variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Den kontrollerer at de finnes, men **ikke** at URL-en tilhører et godkjent PROD-prosjekt. `build`-jobben har ikke `environment`; bare `deploy` bruker `github-pages`.

Anbefalt konkret endring senere:

1. Definer de tre offentlige repository-variablene `PROD_SUPABASE_PROJECT_REF`, `PROD_SUPABASE_URL`, `PROD_SUPABASE_PUBLISHABLE_KEY`; map dem i Pages-build til eksisterende `VITE_`-navn. Ikke stol på gamle, generiske DEV-verdier eller bland begge sett som fallback.
2. Legg en fail-closed kontroll før build/artifact: kjent faktisk PROD-ref, ulik DEV, URL eksakt tilhørende den, offentlig nøkkeltype, demo false og eksakt Pages-base. Opaque publishable key kan ikke dekodes til ref; verifiser senere nøkkel/prosjekt med en lesende API-kontroll uten å logge nøkkelen.
3. Sett `VITE_DEMO_MODE=false`, `VITE_ENABLE_DEV_PASSWORD_LOGIN=false`, `VITE_BASE_PATH=/pluss-minus-null-stress/` eksplisitt i releasejobben.
4. Behold `workflow_dispatch`, avtal én tillatt release-ref og en gjennomgått SHA. Ingen automatisk deploy på `develop`-push. Ingen merge til main er gitt av denne planen.
5. Krev grønn Verify for **samme commit**, inkludert database, UI og Pages-prøver, før deploy. Dagens Pages-jobb kjører ikke hele denne matrisen og avhenger ikke av Verify-resultatet.
6. Konfigurer `github-pages` environment med godkjent branch/ref-regel og required reviewer der kontoplanen støtter det. Ikke anta at navnet alene beskytter deploy. Hvis GitHub-planen ikke tilbyr ønsket port, avtal og dokumenter en konkret kontrollert operatørprosess før release.
7. Settings → Pages bruker GitHub Actions; minst nødvendige deployrettigheter, beskyttet godkjenningspunkt og ingen PROD-service-key/DB-passord i Pages-workflowen. Backendmigrasjoner og Edge-deploy holdes utenfor denne frontend-workflowen.

**Viktig scopefelle:** GitHub environment-variabler er bare tilgjengelige for jobber som faktisk refererer environment. Å legge variablene bare under dagens `github-pages` vil ikke gi dem til dagens build-jobb. Denne planen velger derfor eksplisitte offentlige repository-variabler. Et alternativ med environment-scopet build krever en annen, gjennomgått workflowendring. Se [GitHub environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

CI `.github/workflows/ci.yml` skal fortsette å bruke mock/demo og lokale testdatabaser, ikke PROD-legitimasjon. Ingen automatisk `db push`, testkonto eller opprydding mot PROD i CI. Eksisterende live-harness er hardlåst til DEV og skal ikke modifiseres til å akseptere PROD.

Etter godkjent bygg: kontroller manifest/hash, `dist/index.html`, JS/CSS/font/favicon-stier, direkte hash-lenker og refresh. Lokal mock-preview bekrefter ikke PROD-redirect eller produksjons-RLS. Eksisterende `dist` fra forrige revisjon har fiktiv backend og skal ikke lastes opp som release.

## 10. Gjennomføringsporter og nødvendige godkjenninger

Hver port er en **egen beslutning**. Å godkjenne planen, prosjektopprettelse eller installasjon gir ikke automatisk tillatelse til neste endring. Rapportér resultat og stopp ved feil, ukjent prosjekt, drift i kildehash eller uventede data. Lesende kontroll innen avtalt prosjekt kan brukes til å dokumentere porten; alle mutasjoner må ha eksplisitt scope.

| Port | Hva må godkjennes separat? | Ferdigkriterium / stopp før videre arbeid |
| --- | --- | --- |
| G0 — beslutningsgrunnlag | Eier/region/plan, backupansvar, funksjonsomfang; eventuelle lokale kode-/workflowrettinger er egne endringer | Avtalte ansvarlige og kostnadsramme. Lokal release fryses og relevante tester blir grønne før installasjon/deploy |
| G1 — nytt prosjekt | Avsluttet; agentens lesende kontroller + prosjektansvarligs manuelle Free-/organisasjonsbekreftelse 24.10.2026 | **BESTÅTT.** Riktig PROD/Ireland, tom appdatabase/Auth/Storage og 0 Edge Functions; ingen installasjon |
| G2A — lokal forberedelse | Kun lokale kontrollfiler, isolert release og oppdatert plan er godkjent | **Fullført lokalt.** 10/10 hasher, minimale 11 filer, CLI-støtte/grants/RLS/avhengigheter dokumentert. Ingen link eller dry-run |
| G2B — migrasjonsplan | B0–B7 er godkjent 24.10.2026; operatørstyrt passordinnskriving/rutine er deretter valgt | **Avventer operatørkjøring.** Lokale hasher og 25 offline sikkerhetskontroller består. Live-preflight/link/dry-run/etterkontroll er ikke kjørt; ingen pending-liste eller G2B-suksess foreligger. Stopp før G3 |
| G3 — databaseinstallasjon | Kun 001–010 og tilhørende CLI-historikk i verifisert PROD | Lesende etterkontroll som i 3.3. Ved delvis feil: stopp, ingen repair/reset/retry med annet scope |
| G4a — backup/driftsoppsett | Konkret backupmål, credentials/tilganger og avgrenset restoreøvelse i godkjent isolert mål | Dokumentert dekning og målt restore; ingen restore/import av DEV-data |
| G4b — retensjon | Bare nødvendig Cron-oppsett og én maintenance-only-jobb; avgrensede syntetiske tester krever eget datascope | Eksisterende guard består, minst to jobbkjøringer og feiloppfølging verifisert; ingen notifications/e-post |
| G5a — Google Cloud | Egen PROD-konfigurasjon/klient og avtalte adresser/scopes | DEV-klienten uendret; ny legitimasjon lagret privat, faktisk konsollkrav avklart |
| G5b — PROD Auth | Konkrete URL/provider-/signup-/eventuelle e-postvalg | Bare nye PROD endres. Personvern/drift er klare før signup åpnes; ingen konto opprettes som automatisk del av innstillingsendringen |
| G6 — Edge-secret | Kun PROD `ALLOWED_ORIGIN=https://jya2002.github.io` | Bekreft registrering/forventet verdi uten secret-utskrift; DEV og øvrige secrets uendret |
| G7a — slettefunksjon | Deploy bare gjennomgått `account-delete` til PROD | Managed-key-kompatibilitet, kildehash, GET/OPTIONS, CORS og avslag uten token verifisert; ingen slettinger |
| G7b — bilder, hvis valgt | Bare `image-upload` og separat disponibel Storage-test | Rolle/origin/format/kvote/filrydding verifisert. Ellers godkjent og reell avgrensning av bildebruk |
| G8 — GitHub/release | Konkrete workflow-/variabel-/environment-/branch-endringer; første commit/push/merge må godkjennes for seg | Godkjent SHA, riktig PROD-injeksjon, grønn CI og attestert reviewport. Ingen automatisk deployment |
| G9 — kontrollert frontenddeploy | Én Pages-release av bestemt artifact/SHA med riktig PROD-konfigurasjon | Faktisk base/assets/refresh kontrolleres. Dette er teknisk offentlig hosting, ikke en lukket testside eller studentinvitasjon |
| G10a — første konto | Én navngitt første PROD Google-innlogging | Konto får ny PROD-UUID og studentrolle; identitet verifisert, ingen DEV-import |
| G10b — første admin | Én eksplisitt rollebootstrap til akkurat verifisert PROD-UUID med audit | Én kontrollert endring, riktig admin og ny innlogging. Ingen automatisk «første bruker»-regel |
| G11 — integrasjonsprøve | Gjennomgått, eksakt testkonto-/rolle-/objekt-/slette-/cleanup-omfang, som skissert nedenfor | Alle kritiske akseptansekriterier består; kun egne fixtures ryddet, audit bevart. Ingen reell admin som slettemål |
| G12 — åpning for studenter | Selvstendig lanseringsvedtak etter alle P0-porter | Kontakt/personvern, support, backup, retensjon og faktisk offentlig Google/student/admin-flyt godkjent. Funksjoner uten bestått prøve tilbys ikke |

G4/G5/G7/G8 kan forberedes i avhengighetsriktig rekkefølge, men oppsett er ikke automatisk aktivert av at G3 består. Signup må ikke åpnes før den faktiske behandlingen er klar. Å holde tilbake invitasjoner eller bruke Google Testing er ikke en teknisk tilgangssperre; ved krav om reelt lukket PROD-test må et konkret, separat godkjent adgangsvern planlegges.

### 10.1 Forslag til senere avgrenset PROD-prøve — ikke godkjent nå

Foreslått omfang før studentåpning: første admin beholdes som driftskonto; **tre navngitte, kontrollerte testidentiteter** brukes til student A/B og styre C. Opprettelse av deres PROD-profiler og tildeling av C sin styretestrolle må stå eksplisitt i godkjenningen. De er ikke DEV-kontokopier. En praktisk reduksjon/rollebytteplan krever gjennomgang før den erstatter dette forslaget.

**Viktig blokkering:** Gmail-plussaliaser som fungerer for administrativt opprettede passord-fixtures skaper ikke separate Google OAuth-identiteter. Vi trenger faktiske separate Google-kontoer som testansvarlig kontrollerer. Ikke slå på e-post/passord i PROD eller bruk tilfeldige adresser for å omgå dette. Eksisterende `test-registration-live`, `test-community-live`, `test-account-delete-live` og `playwright.live.config.ts` er DEV-bundet; de skal ikke startes med PROD-nøkler. En produksjonsprøve må ha egen gjennomgått prosjektbinding eller være operatørstyrt med kun lesende agentkontroller.

Mulig, konkret objektomfang å godkjenne: én isolert tilgangsgruppe, ett merket publisert testevent med kapasitet 1 og gruppemålgruppe, ett merket tomt utkast, ett skjult forslag, én kort testpoll med avklart synlighet og eventuelle nøyaktig registrerte små testbilder. Pollmålet kan ikke isoleres med event-gruppepolicy; prøven må derfor skje uten invitert studentbruk og med avklart risiko for annen tilgang. Registrer intensjoner/UUID-er før skriving, eiermarkører, baseline og cleanup-kriterier. Ingen rå JWT/passord i manifest, trace, skjermbilder eller rapport.

Prøven skal omfatte:

- Google fra faktisk Pages-origin, ønsket retur, studentrolle, utlogging og feil-/avbruddsflyt på desktop/mobil.
- Medlemskap og student/styre/admin-grenser, rå API-avslag og egne/andres data.
- A confirmed, B waitlisted, A avmelding og B confirmed; duplikat, frist og kapasitet. Samtidighetsstress og hele RLS-matrisen må først bestå lokalt/DEV; ingen uavgrenset PROD-belastningstest.
- Forslag/anonymitet, én stemme, pollmålgruppe/periode/skjulte resultater.
- Kun testutkastet slettes via faktisk admin-dialog med eksakt tittel; én riktig audit, opprinnelig baseline bevart.
- Egen eksportnedlasting og account-delete på en disponibel **student**, med nylig Google-innlogging. Auth/database/Storage/anonymisering/opprykk kontrolleres før eventuell administrativ restopprydding.
- Retensjonsgrenser på syntetiske gamle rader under separat scope, cron-kjøring/feilrutine og faktisk restoreøvelse. En API-respons alene beviser ikke etterfølgende sletting/backup.
- Til slutt: bare eierskapsverifiserte testrester fjernes etter det godkjente omfanget; audit beholdes. Uventede deltakere, stemmer, rolleendringer eller filinnhold stopper cleanup. Ingen manuell reparasjon eller bredere sletting uten ny godkjenning.

## 11. Lanseringssjekkliste og konkrete blokkeringer

Status etter avsluttet G1 og lokal G2A; avkryssede punkter gjelder bare det oppgitte bevisomfanget:

- [x] Faktisk PROD-ref `unrdvalfkusnqhbfhber`, navn/organisasjon, `ACTIVE_HEALTHY`, Ireland `eu-west-1` og PostgreSQL 17.11 er lesende bekreftet; ref er ulik DEV.
- [x] Free-plan, organisasjon, PROD-ref og Ireland-region er manuelt bekreftet av prosjektansvarlig 24.10.2026; dette er ikke en agentutført Billing-kontroll.
- [x] G2A: ti kildemigrasjoner og ti byteidentiske releasekopier samsvarer med manifestet; minimal config, CLI-versjon/flaggsupport og fravær av seed/DEV-/env-/linkfiler er kontrollert lokalt.
- [ ] Navngitte ansvarlige, backup-/kostnadsramme og gjenoppretting er avklart.
- [x] G2B B0–B7 er separat godkjent; operatørstyrt rutine er valgt og klargjort for skjult lokal passordinnskriving.
- [ ] G2B er gjennomført med eksplisitt PROD-binding, uendret remote baseline og forventet pending-liste. Ingen slik live-preflight/link/dry-run/etterkontroll er gjort nå.
- [ ] Godkjent release-SHA, rene kildehashverdier og grønne relevante tester foreligger; de to mobiltestfeilene er lukket gjennom godkjent endring.
- [x] G1-snapshot: ingen apprelasjoner/-policies/-triggere, Auth-brukere, identities, buckets, Storage-objekter eller deployede Edge Functions. Eksisterende RLS-/plattformhjelpere er dokumentert. Tomhet må kontrolleres på nytt før senere installasjon.
- [ ] Nøyaktig 001–010 er anvendt én gang og korrekt registrert i PROD-historikk. DEV-historikken er urørt.
- [ ] 23 RLS-tabeller, 42 funksjoner, 10 triggere, grants/constraints/indekser og 3 buckets består lesende og senere autoriserte rolleprøver.
- [ ] Offentlig kontakt/personvern, leverandør-/regionvalg og kosthensynsbehandling er vedtatt og faktisk levert i appen.
- [ ] Backup/restore og periodisk retensjon har mål, ansvarlig, dokumentert prøve og fungerende overvåkning før studentdata.
- [ ] Ny Google PROD-klient, eksakt Supabase callback/Pages redirect og faktisk konsollstatus er kontrollert; ingen DEV OAuth-endring.
- [ ] `account-delete` er testet med Pages-origin; ekte nylig innlogging, egen konto og siste-admin-vern er beholdt. Ingen wildcard-CORS.
- [ ] Første admin er verifisert som student først, separat autorisert og auditført; kontinuitets-/reserveadministratorplan er avtalt.
- [ ] GitHub-buildens PROD-variabler er riktig injisert, environment/release-ref/godkjenning fungerer og fake-/DEV-build avvises.
- [ ] Faktisk Pages assets/font/favicon, direkte hashrute og refresh består; local DEV er fortsatt DEV etter alle oppsettsteg.
- [ ] Disponibel offentlig integrasjonstest og opprydding er godkjent og bestått uten andre dataendringer; ingen uprøvde bilder/e-postmetoder tilbys.
- [ ] Eget vedtak om offentlig åpning er gitt. Kontosletting, e-post, bildeopplasting, funksjonsdeploy, migrasjoner og studentinvitasjoner har ikke fått generell tillatelse gjennom dette dokumentet.

**G1 er lukket; G2A er fullført lokalt.** G2B er godkjent og avventer prosjektansvarligs lokale operatørkjøring med skjult passordinnskriving, uten automatisk SQL-rolle-/unban-fallback. Managed schema-/Storage-grants og faktisk default-ACL er ennå ikke kontrollert i et nytt snapshot. 003 sin generelle default-EXECUTE-herding er ufullstendig som beskrevet, uten påvist mangel i de nåværende app-grantene; ingen retting inngår nå. **Senere lanseringsblokkeringer:** drifts-/backupansvar, kostnadsramme, frosset release, kontakt/personvern, retensjon, to tidligere røde UI-tester, workflow-binding, Google-/runtime-oppsett og testidentiteter gjenstår. Ingen av disse skal løses gjennom endring av DEV.

## 12. Tilbakerulling, dokumentasjon og neste beslutning

Ved feil stoppes neste port. Før kontoer/data finnes er en delvis installasjon et kontrollert avvik, ikke en anledning til automatisk reset/prosjektsletting. Etter datainnsamling brukes bare gjennomgåtte fremoverrettinger eller særskilt godkjent restore/hendelsesplan. Frontend kan rulles tilbake til en kjent release bare dersom den fortsatt peker til riktig PROD og er kompatibel med databaseskjemaet. Ikke rull tilbake til en DEV-/mock-build.

For hver gjennomført port lagres prosjekt-ID, tidspunkt, godkjenningsscope, faktisk operatør, kilde-/artifact-hash, anonymiserte resultater og hva som fortsatt er av. Hemmeligheter og personidentifikatorer blir i avtalte private registre, ikke offentlig Git. Følg egne godkjenninger ved enhver ny endring, også når en tidligere plan allerede er godkjent.

**Neste handling gjelder allerede godkjent G2B:** kjør den gjennomgåtte operatørrutinen én gang med skjult lokal passordinnskriving. Ingen ny legitimasjon, SQL-loginrolle, historikk-DDL, migrasjon eller annen endring inngår automatisk. **G1 er bestått, G2A er fullført, og G2B avventer operatørkjøring. Ingen live-preflight, link, dry-run eller etterkontroll er utført i denne runden. G3, migrasjoner, secrets, Auth-endringer, deploy og push er fortsatt ikke godkjent.**
