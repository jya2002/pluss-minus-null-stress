# Sikkerhetsmodell og lanseringsgjennomgang

Nyeste gjennomgang: [PRELAUNCH_REVIEW.md](PRELAUNCH_REVIEW.md), 24. oktober 2026. Ingen ny kritisk autorisasjonsfeil er funnet i kodegjennomgangen, men manglende Edge-sletting, faktisk innlogging og persondata-/driftsrutiner hindrer foreløpig studentpilot. Ekte community-API-tester er nå rapportert bestått av brukeren.

Dette dokumentet beskriver implementerte kontroller og resterende operative krav. Det er ikke en uavhengig sikkerhetssertifisering.

**Nyeste lokale sikkerhetsgjennomgang:** [COMMUNITY_TESTS.md](COMMUNITY_TESTS.md) beskriver regressjoner og migrasjon 007–009 for anonyme bildestier, offentlig forslagsbildemetadata og avstemningsfrist etter låsventing. Rettet og testet lokalt; ikke anvendt i Supabase uten godkjenning. Anonyme forslag har ikke offentlig bilde. Migrasjon 009 begrenser listing av `suggestion-images` til eier/styre; offentlige bilde-URL-er endres ikke.

## Tillitsgrenser

| Område               | Autoritet og kontroll                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Nettleser            | Ubetrodd. Skjema og skjulte admin-knapper gir bare brukeropplevelse.                               |
| Auth                 | Supabase validerer Google OAuth eller eksisterende e-postinnlogging og utsteder sesjoner. Appen bruker PKCE. Se [Google-oppsettet](GOOGLE_OAUTH.md); provider er ikke aktivert av agenten. |
| Roller               | `user_roles`, skrevet av bootstrap eller administrator-RPC. Brukermetadata brukes aldri som rolle. |
| Database             | RLS på alle app-tabeller, minst mulige grants og FK/unique/check-regler.                           |
| Kritiske operasjoner | RPC med autentisering, rettighetskontroll, fast `search_path` og avgrensede execute-grants.        |
| Edge                 | Validerer token mot Auth, sjekker roller eller worker-hemmelighet; service-role er bare på server. |
| Storage              | Bare avtalte bildeformater/størrelser, eierskapsstier og kvoter. Ingen deltakerdata i filer.       |

## Konkrete beskyttelser

- Event-radlås serialiserer påmelding, avbestilling, lagtilordning og ventelisteopprykk. Kapasitetsendringer bruker samme radlås. Unique `(event_id,user_id)` avviser duplikater.
- Hvert lagmedlem teller én faktisk konto. Lagets størrelsesgrense kontrolleres i transaksjonen. Ingen kapteiner kan reservere navn eller kosthensyn for andre uten samtykke.
- Studenter får ikke INSERT/UPDATE på registreringer, medlemsstatus, stemmer eller roller. Modifiserte nettleserforespørsler omgår derfor ikke reglene.
- Medlems- og gruppebegrensninger kontrolleres på server ved påmelding og på nytt ved opprykk.
- Offentlig plassoversikt er aggregert. Forslagsfeed fjerner intern avsender-ID og skjuler navn ved anonymitet. Rå forslag leses bare av forfatter eller styre.
- Individuelle stemmer leses kun av den som avga dem. Resultater beregnes gjennom en RPC som håndhever skjuling. Unique-regler sikrer én stemme per konto; avstemningens tidsvindu kontrolleres mens poll-raden holdes låst.
- Forslag, påmelding, stemmer, kontakt og kunngjøringer har kontoavgrensede timekvoter. Autentiserings- og nettverksmisbruk må i tillegg begrenses i Supabase. Transaksjoner som feiler ruller også tilbake rate-telleren; dette er ikke en fullstendig IP-basert DDoS-beskyttelse.
- React tekstinnhold rendres som tekst, aldri som `dangerouslySetInnerHTML`. Eksterne event-/sosiale lenker begrenses til HTTPS i databasen. CSV-verdier siteres og formelprefikser nøytraliseres.
- Sletting krever gyldig token, nylig faktisk innlogging, riktig origin og eksplisitt bekreftelse. FK-cascades og trigger frigir plasser og anonymiserer forslag. En global transaksjonslås beskytter siste administrator mot samtidige rolle-/sletteendringer.
- Auth-bytter tømmer query-cache, slik at privat klienttilstand ikke gjenbrukes mellom kontoer. Utlogging tømmer også cache. Browser localStorage inneholder sesjonstoken og må beskyttes mot XSS og delte maskiner.
- Arrangementsbilder går via en styreautorisert Edge Function med bildesignaturkontroll. Den servereide opplastingen unngår at foreningsbilder hindrer kontosletting. Profil-/forslagsbilder er begrenset av bucket-MIME, filtype, størrelse, sti og kontokvote. Alle bilder er offentlige, og må aldri inneholde sensitive opplysninger.
- Notification-worker bruker låst outbox med `SKIP LOCKED`, provider-idempotens, avgrensede retries og private varslingsvalg. Unik påminnelsesindeks hindrer dupliserte påminnelser ved samtidige worker-kjøringer.

## Viktige driftsbegrensninger

En bekreftet e-postkonto er ikke bevis på UiO-studentstatus. «Alle» omfatter alle kontoer; bruk manuelt godkjente medlemmer/grupper når dette kreves. Studentverifisering via UiO/Feide er ikke implementert og er ikke en forutsetning for de åpne arrangementene i spesifikasjonen.

Offentlige feeder og de sentrale adminoversiktene henter stabile sider på 500 rader, under standardgrensen på 1 000, slik at deltakerlister og tall ikke kuttes stille. Ved store datamengder bør oversikter bruke serveraggregater. Sidevisninger er ikke en revisjonssnapshot under samtidige endringer. Oppdater data før endelig eksport. Manglende data vises som lasting eller feil, ikke som oppdiktede nullverdier.

GitHub Pages støtter ikke denne appens egendefinerte HTTP-sikkerhetshoder via en `_headers`-fil. Bruk HTTPS, unngå tredjepartsskript, og vurder en frontproxy/vertsløsning med CSP og andre sikkerhetshoder dersom trusselbildet krever det. Ikke legg en brutt CSP i HTML som hindrer Supabase-forbindelser.

Kontoers profil-/forslagsbilder slettes via Storage API før Auth-slettingen. Dersom lagringsopprydding lykkes og siste Auth-slettesteg feiler, kan enkelte bilder allerede være fjernet; brukeren får feil og kan prøve igjen. Foreningseide arrangementsbilder beholdes. Avtalt praksis for eldre bilder, foreldreløse opplastinger og sikkerhetskopier må inngå i drift.

En Image Upload-kvote for arrangementsbilder håndheves i Edge Function, men er ikke en betalingsgaranti under samtidige opplastinger. Supabase kvotevarsler og eventuelle budsjettgrenser må overvåkes. Foreningens styre er en betrodd innholdsredaktør, ikke en isolert multitenant-kunde.

## Før lansering

- [ ] Migrasjoner verifisert mot et ekte Supabase-utviklingsprosjekt og API-grants gjennomgått.
- [ ] Reelle kontoer testet som anonym, student, styre og administrator via API, også med modifiserte forespørsler.
- [ ] Auth redirect-allowlist, SMTP, utløpstider, rategrenser og CAPTCHA vurdert.
- [ ] Supabase og GitHub-administratorer har MFA; styreoverlevering og hendelsesansvar er avtalt.
- [ ] Alle Edge Functions er deployet til utvikling og deretter til godkjent produksjon; token/origin-avslag er testet.
- [ ] Kontosletting, dataeksport, Storage-opprydding og gjenoppretting er gjennomført med testkontoer.
- [ ] E-postdomene/DNS er verifisert; faktisk levering, preferanser og køfeil er testet.
- [ ] Vedlikeholdsjobb kjører og overvåkes; sikkerhetskopier og gjenoppretting er avtalt.
- [ ] Supabase Security Advisor, avhengighetsvarsler og hemmelighetsskanning er gjennomgått.
- [ ] Ingen `.env`, servernøkler, deltakerlister, CSV-er eller reelle persondata finnes i Git-historikken.

Kjør testene beskrevet i [TESTING.md](TESTING.md). De isolerte PostgreSQL-testene er sterke bevis for SQL-logikken, men erstatter ikke Auth-, PostgREST-, Storage- og Edge-verifikasjon i en komplett Supabase-stack.
