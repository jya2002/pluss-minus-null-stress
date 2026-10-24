# Supabase-oppsett

Bruk et separat utviklingsprosjekt. Velg egnet europeisk region og gjennomgå databehandleravtaler og overføringsgrunnlag før dere lagrer reelle personopplysninger.

## 1. Migrasjoner

Foretrukket for utviklere med Supabase CLI:

```sh
supabase login
supabase link --project-ref YOUR_DEV_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Kjør aldri `db reset` mot et prosjekt som inneholder data dere vil beholde. Se gjennom endringene før anvendelse. Produksjonsendringer krever godkjenning.

Alternativt, for et **nytt og tomt** prosjekt i Dashboard:

```sh
node scripts/bundle-sql.mjs
```

Åpne `.runtime/supabase-setup.sql`, kopier hele filen til SQL Editor og kjør én gang. Alt ligger i én transaksjon. Filen inneholder ikke demodata, betalte ressurser, planlagte jobber eller sletting av brukerdata. Ikke kjør den på nytt etter vellykket installasjon. Hvis prosjektet allerede har tabeller med samme navn, stopper transaksjonen; ikke fjern dem for å «fikse» dette.

Dashboard-metoden oppretter ikke CLI-historikk. Før dere senere bytter til `db push`, bruk `supabase migration repair 202610230001 202610230002 202610230003 202610230004 202610230005 --status applied` mot det samme prosjektet, etter at dere har kontrollert at alle fem migrasjoner ble anvendt. `migration repair` endrer historikk og skal aldri brukes til å skjule en mislykket migrasjon.

Hvis du allerede kjørte oppsettsfilen med fire migrasjoner, kjør bare `supabase/migrations/202610230005_maintenance_fix.sql` som tillegg. Ikke kjør hele oppsettsfilen på nytt. Tillegget retter funksjonen uten å kjøre vedlikehold eller aktivere cron.

`node scripts/check-backend.mjs` utfører en lesende API-kontroll og logger bare HTTP-status. HTTP 404 før migrasjonene er forventet; HTTP 200 etterpå viser at skjemaet er tilgjengelig, ikke at alle brukerflyter er testet.

## 2. Auth og e-postmaler

**Primærmetoden er nå Google OAuth:** følg [GOOGLE_OAUTH.md](GOOGLE_OAUTH.md) for manuelt Google Cloud-/provideroppsett og eksakte callback-adresser. Det krever ingen ny migrasjon eller SMTP. E-postoppsettet nedenfor gjelder bare den beholdte alternative metoden og er ikke en forutsetning for Google-innlogging.

I Authentication > URL Configuration:

- Utvikling: Site URL og tillatt redirect `http://127.0.0.1:5173/`.
- Produksjon senere: `https://jya2002.github.io/pluss-minus-null-stress/` med nøyaktig samme redirect, og eventuelt avtalt eget domene.
- Ikke bruk vide wildcard-redirects i produksjon.

Aktiver e-postinnlogging og bekreftelse. Legg til både en magic link og OTP i malene «Confirm signup» og «Magic link»:

```html
<h2>Logg inn hos Pluss Minus Null Stress</h2>
<p><a href="{{ .ConfirmationURL }}">Åpne innloggingslenken</a></p>
<p>Du kan også skrive inn denne engangskoden: {{ .Token }}</p>
<p>Hvis du ikke ba om dette, kan du se bort fra e-posten.</p>
```

PKCE-lenken skal åpnes i samme nettleser som startet innloggingen. OTP-alternativet gir en enkel reserveflyt. Tilpass meldingen til faktiske utløpstider i prosjektet. Konfigurer egnet custom SMTP; eget domene er ikke et krav for Gmail-prøven beskrevet i [AUTH_AND_DELETION_P0.md](AUTH_AND_DELETION_P0.md). Supabase-standardlevering har restriksjoner og er ikke en produksjonsløsning for vilkårlige studenter. Aktiver relevante Auth-rategrenser og CAPTCHA etter behov. UI og database gir ikke UiO-studentverifisering; alle bekreftede e-postkontoer er i utgangspunktet kvalifisert der «alle» er valgt.

Se [Supabase e-postmaler](https://supabase.com/docs/guides/auth/auth-email-templates). Ingen ekte e-postlevering er bekreftet før dere har gjort en leveringstest.

## 3. Første administrator

Logg inn i appen først. Finn din konto-UUID i Authentication > Users. Kjør deretter som prosjektansvarlig i SQL Editor:

```sql
update public.user_roles set role='admin' where user_id='YOUR_AUTH_USER_UUID';
```

Dette er en eksplisitt bootstrap-handling, ikke en åpen API-funksjon. Logg ut og inn igjen. Andre roller administreres under Styreportalen > Medlemmer og roller. Bruk to administratorer for kontinuitet, sterke e-postkontoer og MFA på Supabase/GitHub. En administrator kan ikke endre egen rolle; den siste administratoren kan ikke slette kontoen.

## 4. Edge Functions og secrets

Bare etter særskilt godkjenning: deploy én valgt funksjon til utviklingsprosjektet. For den aktuelle P0-prøven gjelder bare `account-delete`; se [testplan og godkjenninger](AUTH_AND_DELETION_P0.md). Ikke deploy notifications eller aktiver cron nå:

```sh
supabase functions deploy account-delete --project-ref gawhbppuhnixqvhnnpnn
```

`verify_jwt=false` er tilsiktet: hver funksjon gjør eksplisitt validering. Kontosletting og bildeopplasting verifiserer brukerens access token med `auth.getUser`, deretter nødvendige rettigheter. Notification-worker bruker en separat, tilfeldig serverhemmelighet. En publishable key gir aldri tilgang til workeren.

Sett secrets i Dashboard > Edge Functions > Secrets, ikke i kildekode eller GitHub Pages:

| Secret                       | Verdi/formål                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `ALLOWED_ORIGIN`             | `http://127.0.0.1:5173` i utvikling; senere `https://jya2002.github.io`, uten repo-sti |
| `APP_URL`                    | Full app-URL med `/pluss-minus-null-stress/` i produksjon                               |
| `NOTIFICATION_WORKER_SECRET` | Lang tilfeldig verdi; bare server og Vault                                              |
| `RESEND_API_KEY`             | Valgfri; mangler den sendes ingen arrangementsmail                                      |
| `EMAIL_FROM`                 | Godkjent avsender på verifisert e-postdomene                                            |

Supabase stiller `SUPABASE_URL`, `SUPABASE_ANON_KEY` og `SUPABASE_SERVICE_ROLE_KEY` til disposisjon i servermiljøet. De privilegerte nøklene skal aldri kopieres til `.env`-variabler som begynner med `VITE_`.

Arrangementsbilder lastes opp som foreningseide objekter via `image-upload`, slik at et styremedlems kontosletting ikke fjerner foreningens bilder. Profil-/forslagsbilder har kontoeide nøkkelstier og slettes ved kontosletting. Bare JPG/PNG/WebP, maks 4 MB; SVG og HTML er ikke tillatt. Visuelle filer er offentlige. Bruk ikke bilder av personer uten avklart publiseringsgrunnlag.

## 5. Varsler, påminnelser og lagringsfrister

Kall `notifications` med `Authorization: Bearer <worker-secret>` fra et sikkert servermiljø. Ikke fra nettleseren. Responsen viser utviklingsmodus når e-post ikke er satt opp. Da blir ingen meldinger markert som sendt, og in-app-varslene beholdes.

Når manuell levering og vedlikehold er kontrollert, aktiver pg_cron og pg_net, lagre `pmns_project_url` og `pmns_worker_secret` i Vault og kjør `supabase/schedule.sql` én gang etter godkjenning. Jobben kjører hvert kvarter. Se [Supabase-planlegging](https://supabase.com/docs/guides/functions/schedule-functions).

Workeren håndterer maksimalt 25 e-poster per kjøring. Automatisk retry er begrenset til fem forsøk innen 23 timer, slik at leverandørens idempotensvindu ikke overskrides. Inspiser feilede køelementer og leverandørlogg før manuell retry; ikke nullstill køstatus blindt. Provider-aksept er ikke bekreftet innbokslevering.

Kontroller `cron.job_run_details`, HTTP-responser, Edge Function-feil og Resend. Opprett driftspåminnelse ved manglende jobbkjøring. Uten aktiv jobb er lagringsfristene og påminnelsene **ikke operative**. Gå også gjennom gamle/uaktuelle kontoer årlig, og fjern foreldreløse, ubrukte bilder via Storage API etter gjennomgang. Ikke slett direkte fra `storage.objects`.

## 6. Utviklingsdemo

`supabase/seed.sql` er valgfri, eksplisitt utviklingsdata. Ikke importer i produksjon. Quiz & Kaos er alltid `draft` i seed. Andre eksempelarrangementer er merket `is_demo=true`; ingen fiktive deltakere, stemmer eller reelle kunngjøringer opprettes.
