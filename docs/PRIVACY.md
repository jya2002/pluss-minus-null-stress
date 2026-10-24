# Personvern og databehandling

Dette er et implementasjonsgrunnlag. Foreningen må selv fastsette og dokumentere behandlingsansvarlig, formål, grunnlag, mottakere og faktiske leverandørvilkår. Ingen juridisk GDPR-sertifisering er gitt.

| Data                            | Formål og synlighet                                                    | Planlagt frist                                                      |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| E-post og Auth-UUID             | Innlogging; kun kontoeier og begrenset leverandøradministrasjon        | Til kontosletting/årlig kontogjennomgang                            |
| Visningsnavn                    | Kontopresentasjon og interne deltakeroversikter                        | Til kontosletting                                                   |
| Studieprogram/-år               | Valgfrie profilopplysninger; egen konto og styre                       | Til kontosletting eller brukerendring                               |
| Profilbilde                     | Frivillig offentlig bildeasset; ikke bruk sensitive bilder             | Til sletting/opprydding; kontosletting fjerner eide filer           |
| Medlemskap og grupper           | Manuelt godkjent tilhørighet og adgang                                 | Til sletting/årlig medlemsgjennomgang                               |
| Påmeldinger og lagtilhørighet   | Arrangementsgjennomføring; egen konto og styre                         | 180 dager etter arrangementsslutt                                   |
| Kosthensyn og samtykketidspunkt | Frivillig, spesifikk tilrettelegging; bare egen konto og styre         | Ved avbestilling eller senest 7 dager etter slutt                   |
| Forslag                         | Aktivitetstilbakemeldinger; offentlig innhold, valgfri anonym avsender | Beholdes anonymisert ved kontosletting; gjennomgå historisk innhold |
| Individuelle stemmer            | Én konto/én stemme og egen stemmehistorikk                             | Til kontosletting; avstemningsperioder gjennomgås årlig             |
| In-app-varsler og e-postkø      | Transaksjonsbekreftelser og valgfrie nyheter                           | 180 dager                                                           |
| Kontaktmeldinger                | Svare på spørsmål; kontoeier og styre                                  | 90 dager                                                            |
| Endringslogg                    | Begrenset administrativ etterprøvbarhet; styre                         | 365 dager; aktør anonymiseres ved sletting                          |
| Rategrenser                     | Forebygge misbruk; kun intern servertilstand                           | To dager                                                            |

Fristene håndheves av `run_maintenance()` gjennom den planlagte jobben. Uten aktivering/overvåking er de ikke en faktisk driftsgaranti. Off-site eksport, leverandørlogger og sikkerhetskopier har egne prosedyrer som styret må dokumentere.

Kosthensyn kan røpe helse eller religion. Feltet er valgfritt, med separat eksplisitt samtykke og tidsstempel; databasen avviser tekst uten bekreftelse. Be bare om praktisk tilrettelegging, ikke diagnoser. Avklar behandlingsgrunnlag, tilbaketrekking og et alternativ via styret med ansvarlig person før lansering. Appen lar brukeren fjerne kosthensyn ved avbestilling; øvrige rettighetsforespørsler kan sendes til styret. Et avkrysningsfelt alene er ikke juridisk vurdering.

Avsenderanonymitet for forslag er offentlig anonymitet, ikke anonymitet overfor modererende styre. Opplys om dette før innsending. Ikke forsøk å identifisere anonyme avsendere uten et nødvendig og dokumentert formål.

## Rettigheter i appen

Min side gir profilredigering, varslingsvalg, JSON-eksport og kontosletting. Eksporten inkluderer egen Auth-e-post, profil, rolle, medlemskap, grupper, påmeldinger, egne forslag/stemmer, lag som kaptein, kontaktmeldinger, varsler og egne audit-loggoppføringer. Andre kontoinnehaveres opplysninger inkluderes ikke.

Sletting fjerner konto, private data og stemmer; forslag beholder innholdet med nullstilt forfatter. Hvis selve forslagsteksten inneholder personopplysninger, må styret redigere/skjule eller slette etter vurdering; «anonymisert forfatter» er ikke automatisk anonymisering av fritekst. Begrensede audit-UUID-er kan fortsatt finnes til loggens frist. Avklar lovlig lagring av slike sikkerhetsspor.

Medlemskap følger ikke automatisk av arrangementsdeltakelse. Valgfrie kunngjøringsmailer er avslått som standard. E-post om egne arrangementer er et separat valg, mens in-app-status fortsatt er tilgjengelig.

## Leverandører og avtaler før lansering

| Leverandør             | Opplysninger                                            | Styrets gjennomgang                                                                                    |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Supabase               | Auth, PostgreSQL, Storage og Edge Functions             | DPA, europeisk region, underleverandører, tilgang, backups, logger, slettefrister, overføringsgrunnlag |
| Google, ved Google-innlogging | Innlogging/samtykke, e-post og grunnleggende profil til Supabase; ingen Gmail-/Drive-/Calendar-tilgang | Leverandørvilkår, dataflyt, overføringsgrunnlag, kontaktansvar og oppdatert offentlig personvernerklæring før aktivering |
| GitHub Pages / Actions | Offentlige frontendfiler og tekniske besøks-/bygglogger | Hostingvilkår, repo-synlighet, loggtilgang, Actions-rettigheter og hemmeligheter                       |
| Resend, hvis aktivert  | Mottakeradresse og nødvendig e-posttekst                | DPA, region/overføringer, domene, logging, retensjon, avvisning og sletting                            |
| SMTP for Supabase Auth | Innloggingsadresse og autentiseringsmelding             | DPA, levering, sikkerhet, logging og sporingsfrie lenker                                               |

Det er ingen besøksanalyse eller markedsføringssporing i appen. Auth-sesjonen lagres i nettleserens localStorage. Forklar denne nødvendige lagringen, og be brukere logge ut på delte maskiner.

Fyll ut kontaktadresse, foreningens ansvarlige person, grunnlag for hvert formål, rutine for innsyn/klage og henvisning til Datatilsynet i den offentlige personvernerklæringen før publisering. Versjoner vedtatt tekst, gjennomfør en enkel risikovurdering og avklar behov for ytterligere vurdering ved sensitiv tilrettelegging.
