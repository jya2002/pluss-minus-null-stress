# Styrets håndbok

Alt ordinært innhold kan administreres uten å redigere kildekode. Du trenger en bekreftet konto med styre- eller administratorrolle.

## Arrangementer

1. Åpne Min side > Styreportal > Arrangementer > Nytt arrangement.
2. Skriv tittel, beskrivelse, klokkeslett, sted, tilgjengelighet og påmeldingsfrist. Alle skjema-klokkeslett er **Europe/Oslo**; databasen lagrer tidsstemplede instanser.
3. Velg kapasitet, pris, kategori og hvem som kan delta. Ved gruppetilgang må du også knytte arrangementet og kontoene til samme tilgangsgruppe.
4. Velg individuell påmelding eller lag + individuelle. Hvert lagmedlem melder seg på selv, og lagets første påmeldte blir lagkaptein. Det reserveres ikke plasser for anonyme lagkamerater.
5. Last opp et bilde hvis ønskelig. Ikke bruk personlige eller sensitive opplysninger i bilder eller lagnavn.
6. Lagre som utkast. Bekreft lokale, dato, kostnader, tilgjengelighet og eventuell aldersgrense før du endrer status til Publisert.

Quiz & Kaos-eksempelet krever styrets avklaring. Ikke godkjenn alkoholinformasjon uten bekreftelse fra ansvarlig arrangør/lokale. Uten eksplisitt godkjenning lagres og vises ingen alkoholinformasjon.

Dupliser lager et nytt utkast uten deltakerregistreringer. Avpublisering skjuler arrangementet fra offentlig oversikt. Avlysning merker det som avlyst og oppretter varsler til aktive påmeldte. Viktige dato-/sted-/innholdsendringer gir også varsler. E-post avhenger av konfigurert worker og brukerens valg.

## Permanent sletting av utkast

Etter at migrasjon `202610230010_delete_draft_event.sql` er særskilt godkjent og aktivert, kan **administrator** velge **Arrangementer → Slett permanent**. Skriv den eksakte tittelen og bekreft i dialogen. Bare utkast uten påmeldinger (også avbestilte), venteliste, lag, varsler eller gruppetilknytninger kan slettes. Serveren kontrollerer dette transaksjonelt; vanlige klienter får ingen generell DELETE-rettighet. Bilder og revisjonslogger beholdes. For publiserte/avlyste arrangementer vises veiledning til publiseringsstatus/avlysning.

Migrasjon 010 er 24. oktober 2026 manuelt installert i utviklingsprosjektet, uten historikkregistrering. Én godkjent manuell UI-slettetest av et disponibelt tomt utkast er bestått: brukeren slettet, og lesende etterkontroll bekreftet korrekt administrator i DELETE-revisjonen, bevart baseline og uendret Storage. Dette er ikke offentlig produksjonsverifikasjon. Se [EVENT_DELETION.md](EVENT_DELETION.md) for sikkerhetskontroller, testresultater og nødvendige godkjenninger.

## Deltakere, lag og venteliste

Velg arrangement under «Påmeldinger og lag». Se bekreftede, venteliste, kosthensyn, lag og oppmøte. Tilordne studenter uten lag til et eksisterende lag. Alle medlemmer bruker egen konto; styret oppretter ikke fiktive deltakere.

Avbestilling krever bekreftelse i appen. Når en plass frigis, eller kapasiteten økes, flyttes neste kvalifiserte student fra ventelisten opp automatisk, før påmeldingsfristen. Ingen automatisk opprykking skjer etter fristen eller når påmelding er stengt. Lag som er fulle ved opprykk, frigis til individuell plass. Ventelisterekkefølgen følger tidspunktet for siste aktive påmelding, med ID som stabil sekundærsortering.

Kapasitet kan ikke settes lavere enn bekreftet antall. Lagstørrelse kan ikke reduseres under eksisterende lag, og lagmodus kan ikke slås av før lagtilordningene er fjernet.

CSV-eksport inneholder private opplysninger og eventuelle kosthensyn. Oppbevar den fortrolig, del bare med personer som trenger den, og slett kopiene etter bruk. Databasefrister sletter ikke en nedlastet CSV. Oppmøte registreres med avkrysningsboksen.

Bruk «Send oppdatering til påmeldte» for en praktisk beskjed. Varsel lagres på Min side; faktisk e-post må kontrolleres separat.

## Torsdagsbanken

Behandle forslag som Foreslått, Under vurdering, Planlagt, Gjennomført eller Avslått. Skjul upassende innhold. Anonymitet skjuler avsender i offentlig feed, mens styret har intern avsender-ID til moderering. Unngå å dele den videre.

Anonyme forslag publiseres uten bilde for å unngå at personlige bildestier røper avsender. Forslag i Planlagt, Gjennomført eller Avslått er stengt for nye stemmer. Foreslått og Under vurdering tillater stemme og tilbaketrekking.

Opprett en avstemning med 2–12 valg, åpning og stenging, eventuell medlemsbegrensning og skjulte resultater. Ett registrert valg per konto. Styret kan avslutte en allerede åpnet avstemning før tiden. Resultatet er et innspill: opprett og publiser et separat bekreftet arrangement når styret har besluttet gjennomføring.

«Opprett avstemning» publiserer avstemningen. Bruk Avpubliser/Publiser for synlighet og «Endre stemmeperiode» for tidspunkt; klokkeslett er Europe/Oslo. «Skjul resultater til slutt» skjuler samlet resultat frem til stenging for vanlige besøkende. Styret kan se samlet resultat tidligere. Medlemsbegrensning gjelder hvem som får stemme; synlige samlede resultater er offentlige, mens individuelle stemmer alltid er private.

## Medlemmer, roller og grupper

Medlemskap er separat fra påmelding. Behandle ventende søknader og sett godkjent, avslått eller inaktiv. Under Innhold kan dere velge om nye medlemskap trenger godkjenning.

Bare administratorer kan gi eller fjerne styre-/administratorroller for andre. Vanlige studenter kan aldri velge privilegert rolle. Sørg for kontinuitet ved styreskifte og fjern gamle styretilganger etter overlevering.

Tilgangsgrupper kobler navngitte grupper til kontoer og arrangementer. «Fjern valgte tilknytninger» fjerner akkurat de valgte konto-/arrangementskoblingene, ikke kontoer eller arrangementer.

## Innhold, kontakt og drift

Oppdater om-tekst, offisiell e-postadresse og sosiale lenker under Innhold. Publiser ekte kunngjøringer først når de er avklart; merk demoinnhold eksplisitt. Valgfrie kunngjøringsmailer sendes bare til dem som har valgt dem.

Kontaktmeldinger finnes i styreportalen og kan markeres behandlet. Svar gjennom en oppgitt kontaktkanal. Plattformen sender ikke et automatisk e-postsvar fra dette panelet.

Oversikten viser faktiske rader og registrert oppmøte, ikke estimater. Etter at gamle persondata er slettet, blir ikke disse historiske deltakerne regnet med. Medlemsvekst gjelder nåværende godkjente medlemmer med søknadsdato innen 30 dager, ikke en historisk tidsserie over godkjenninger.

Følg lanseringssjekklisten, gjennomgå personvern årlig og kontroller at vedlikeholdsjobben kjører. Ved mistenkt kompromittering: steng berørt tilgang, kontakt prosjektansvarlig, roter serverhemmeligheter og vurder varslingsplikt med ansvarlig person. Ikke legg persondata i GitHub-issues.
