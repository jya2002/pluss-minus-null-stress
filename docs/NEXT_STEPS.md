# Neste steg i utviklingsprosjektet

**Ny primærmetode:** Google OAuth er implementert lokalt; se [manuelt oppsett og tester](GOOGLE_OAUTH.md). Testpassordet nedenfor beholdes for utvikling. Ikke følg eldre SMTP-anbefalinger som en forutsetning for Google-innlogging.

**24. oktober: se [lanseringsgjennomgangen](PRELAUNCH_REVIEW.md).** Brukeren har rapportert alle seks ekte community-API-tester bestått og ryddet. Ikke kjør dem eller migrasjonene på nytt som neste steg. Prioriter faktisk produksjonsinnlogging, manglende Edge-sletting, kontakt/personvern og drift før pilot. Ingen ny ekstern handling er godkjent av denne rapporten.

**Nyeste neste steg:** Se [COMMUNITY_TESTS.md](COMMUNITY_TESTS.md). Medlemskap, forslag, avstemninger og mobil er lokalt gjennomgått. Migrasjon 007–009 og den nye community-live-testen krever godkjenning før kjøring i Supabase. Innlogging og arrangementstester nedenfor beskriver tidligere arbeid; brukeren har nå rapportert ekte arrangements-API-/nettlesertester bestått.

Tilkoblingsfeilen er rettet i lokal `.env`: `VITE_SUPABASE_URL` skal være prosjektets rotadresse, uten `/rest/v1` eller andre understier. Nøkkelen er uendret. Hovedoppsettet skal ikke kjøres på nytt.

## 1. Opprett en bekreftet testbruker og logg inn med passord

Den eksisterende flyten brukte bare magic link/OTP. Passordinnlogging er nå lagt til bak `VITE_ENABLE_DEV_PASSWORD_LOGIN=true` og aktivert i lokal `.env`. Skjemaet vises bare når Vite kjører i utviklingsmodus; produksjonsbuilden viser det aldri, selv om flagget settes. Start dev-serveren på nytt hvis den ikke laster `.env`-endringen automatisk.

1. Velg **utviklingsprosjektet** i Supabase Dashboard.
2. Gå til **Authentication > Users > Add user > Create new user**. Velg opprettelse, ikke «Send invitation».
3. Skriv inn en **ekte e-postadresse du kontrollerer**, og et langt, unikt testpassord. Ikke bruk `example.com`, `.test`, `.invalid` eller andre plassholderadresser. Hvis adressen allerede finnes, bruk en annen adresse eller et nytt alias du kontrollerer, fremfor å slette eksisterende brukere.
4. Kryss av **Auto Confirm User** for akkurat denne testbrukeren, og trykk **Create user**. Dette er en administrativ bekreftelse av én testkonto; **Confirm Email** i prosjektets generelle innstillinger skal fortsatt være på.
5. Åpne brukeren og kontroller at e-posten har bekreftet status, eller at `email_confirmed_at` har et tidspunkt.
6. Åpne **http://127.0.0.1:5173/#/logg-inn**, velg **Passord (utvikling)** dersom det ikke allerede er valgt, skriv inn samme e-post og passord og trykk **Logg inn med passord**.
7. Kontroller at **Min side** åpnes og at profilnavnet kan lagres. Passordinnlogging oppretter ikke nye kontoer og sender ikke innloggingsmail. Bruk samme fremgangsmåte for flere studenttestkontoer når vi tester venteliste.

Ikke legg testpassord i `.env`, kildekode, Git eller chat. De trengs bare i Dashboard ved opprettelse og i innloggingsskjemaet. Rolleoppslag og RLS bruker den ekte Supabase-sesjonen; ingen rolle eller e-postbekreftelse simuleres i appen. En Dashboard-opprettet konto får som før `student` fra signup-triggeren.

`email_address_invalid` ved OTP kan skyldes eksempel-/testdomener, og `Email rate limit exceeded` gjelder e-postflyten. Passordinnlogging bruker `signInWithPassword` og trenger ingen e-postlevering, men vanlige Auth-rategrenser gjelder fortsatt. Ikke gjenta OTP-forsøk for å teste passordflyten. Se [Supabase-feilkoder](https://supabase.com/docs/guides/auth/debugging/error-codes), [passordinnlogging](https://supabase.com/docs/reference/javascript/auth-signinwithpassword) og [bekreftelseskravet](https://supabase.com/docs/guides/auth/users).

Ved `Email not confirmed`: kontroller bekreftelsen for denne brukeren; ikke deaktiver den globalt. Ved feil passord: bruk testpassordet fra opprettelsen, ikke Supabase Dashboard-passordet ditt. Ved manglende profiler/roller: oppgi feilmeldingen, uten passord eller token; ikke legg inn en lokal rolleomgåelse.

De åtte nye Auth-komponenttestene er kjørt med simulerte API-svar, inkludert produksjonssperre, faktisk kall til SDK-metoden, feil legitimasjon, ubekreftet bruker og fortsatt tilgjengelig magic-link-flyt. Det betyr ikke at en ekte passordinnlogging er testet mot utviklingsprosjektet; den må fullføres med testkontoen ovenfor.

### Hvis passordinnlogging svarer HTTP 400

Den kjørende Vite-frontendens prosjekt er kontrollert mot `gawhbppuhnixqvhnnpnn`. Det offentlige Auth-endepunktet returnerer `external.email=true`, som også kontrollerer e-post/passord-granten i Supabase Auth. Implementasjonen sender `{ email, password }` direkte til `signInWithPassword`; passordet trimmes eller endres ikke.

Oppdater innloggingssiden og prøv én gang. Ved avslag vises en vedvarende boks **Supabase Auth-diagnostikk** under knappen, med HTTP-status og strukturert feilkode. Bare disse to feltene vises, kun i utviklingsmodus; verken rå feilmelding, passord, nøkler, token eller responskropp logges. Del bare feilkoden og statusen.

- `invalid_credentials`: Supabase godtar ikke legitimasjonen. Koden skiller med vilje ikke mellom feil kombinasjon, manglende konto eller konto uten passord. At en konto er bekreftet og ikke utestengt beviser ikke at den har et passord.
- `email_not_confirmed`: kontroller bekreftelsen på den aktuelle kontoen, uten å endre global innstilling.
- `email_provider_disabled`: kontroller e-postleverandøren i utviklingsprosjektet; den offentlige kontrollen viste den aktivert ved undersøkelsen.
- `over_request_rate_limit`: vent før et nytt forsøk; ikke gjenta innlogging automatisk.

Hvis den faktiske koden er `invalid_credentials`, kan `.runtime/check-test-user-password.sql` kjøres manuelt i SQL Editor etter at testbrukerens UUID er satt inn. Den er lesende og returnerer bare `email_confirmed`, `is_banned`, `has_password` og `has_email_identity`, aldri passordhash eller andre hemmeligheter. `has_password=false` fastslår at kontoen ikke kan brukes til passordinnlogging før et passord er satt. `has_password=true` beviser ikke at det innskrevne passordet er riktig. Bruk Supabase sin administrative brukerhåndtering for å sette passord, eller opprett en ny, bekreftet testbruker med et kjent passord; ikke rediger `encrypted_password` direkte.

Se [Supabase sin feilkodedokumentasjon](https://supabase.com/docs/guides/auth/debugging/error-codes) og [passord-grantens serverimplementasjon](https://github.com/supabase/auth/blob/master/internal/api/token.go). Den konkrete feilkoden fra ditt siste innloggingsforsøk er ikke kjent før den nye visningen brukes; HTTP 400 alene gir ikke denne informasjonen.

## 2. Gi din egen konto første administratorrolle

Når innloggingen virker, finn kontoens **User UID** under Authentication > Users. Denne endringen gir tilgang til private administrasjonsdata; velg bare din egen konto eller en uttrykkelig godkjent styrekonto. Kjør manuelt i SQL Editor med den riktige UUID-en:

```sql
update public.user_roles
set role = 'admin'
where user_id = 'REPLACE_WITH_YOUR_AUTH_USER_UUID'
returning user_id, role;
```

Forvent én rad med `admin`. Logg ut og inn igjen, og åpne `http://127.0.0.1:5173/#/admin`. Ikke endre RLS eller gi administratorrolle gjennom brukermetadata.

Etterpå kan et tydelig merket utviklingsarrangement med kapasitet 1 brukes til å teste ekte studentpåmelding og venteliste fra to separate studentkontoer. Det er ikke opprettet slike testkontoer eller arrangementer i dette arbeidet ennå.

## Bilder kan vente til kjerneflyten virker

`event-images` er bevisst stengt for direkte nettleseropplasting. Appen sender arrangementsbilder gjennom den autoriserte `image-upload` Edge Function, som oppretter foreningseide filer. GET-kontrollen mot utviklingsprosjektet returnerte `404 / NOT_FOUND`: funksjonen er ikke deployet.

Det er derfor ikke laget noen policy-migrasjon nå. Arrangementer kan opprettes uten bilder. Når vi tar bildeopplasting, må **bare `image-upload`** deployes til utviklingsprosjektet og få `ALLOWED_ORIGIN=http://127.0.0.1:5173`. Dette krever Dashboard/CLI-tilgang. `notifications`, cron og produksjonsdeploy skal fortsatt ikke aktiveres.

## Nye kontroller i denne arbeidsøkten

- Ekte Supabase-tabeller og Auth-konfigurasjon svarer HTTP 200; e-postinnlogging og signup er aktivert.
- Åtte målrettede live-kontroller bestod: offentlige arrangements-/forslags-RPC-er og innstillinger, anonym isolasjon av profiler/roller/påmeldinger/varsler og avvist anonym påmelding.
- Ingen nye brukere, arrangementer, påmeldinger eller filer er skrevet til Supabase.
- Tidligere beståtte enhets-, database- og nettlesersuiter er ikke kjørt på nytt.
