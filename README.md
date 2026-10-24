# Pluss Minus Null Stress

Referansebasert gul/lilla visuell identitet er ferdigstilt lokalt. Se [redesign, testresultater og forhåndsvisninger](docs/REDESIGN.md). Ingen backendendring eller offentlig deploy inngår.

Nyeste [lanseringsgjennomgang og prioritert pilotliste](docs/PRELAUNCH_REVIEW.md) er datert 24. oktober 2026. Koden er lokalt verifisert; øvrige P0-punkter må lukkes før studentpilot. Ingen offentlig deploy er utført. [Google OAuth er nå primær innlogging](docs/GOOGLE_OAUTH.md); brukeren har bekreftet ekte Supabase-innlogging, Min side, studentrolle og utlogging/ny innlogging. [Kontosletting bestod én godkjent ekte backend-test med fullført testopprydding](docs/ACCOUNT_DELETE.md) i utviklingsprosjektet. Offentlig Pages-origin, mobil og Google-basert sletting gjennom Min side er ikke dermed verifisert.

**Mer sosialt, mindre stress.** Norsk studentforeningsplattform for matematikkstudenter ved Universitetet i Oslo.

Dette er en React-applikasjon med en faktisk Supabase-datamodell, RLS og transaksjonelle påmeldings-/stemmefunksjoner. Uten backend får man en tydelig merket, skrivebeskyttet demonstrasjon. Ingen handlinger simulerer lagring eller e-postlevering.

**Status:** Implementert for lokal verifikasjon og videre testing mot Supabase-utviklingsprosjektet. Ikke lansert eller godkjent som produksjonsklar. Se [verifikasjonsmatrisen](docs/VERIFICATION.md) for presis testdekning og gjenstående arbeid.

## Start lokalt

Installer Node.js 24 LTS, deretter:

```sh
npm ci
cp .env.example .env
npm run dev
```

På Windows kan du bruke `Copy-Item .env.example .env`. Fyll inn `VITE_SUPABASE_URL` og `VITE_SUPABASE_PUBLISHABLE_KEY` i `.env`. Bruk bare prosjektets **publishable key**, eventuelt gammel **anon key**. Service-role-/secret-nøkler skal aldri stå i `VITE_`-variabler. `.env` er ignorert av Git.

Den portable, sjekksumverifiserte Node-installasjonen brukt i denne arbeidsøkten ligger i `.runtime/node-v24.22.1-win-x64/` og er ikke en del av kildekoden. På denne maskinen kan du midlertidig legge den til PATH i PowerShell:

```powershell
$env:PATH = "$PWD/.runtime/node-v24.22.1-win-x64;$env:PATH"
npm.cmd run dev
```

For utvikling uten innloggingsmail kan du sette `VITE_ENABLE_DEV_PASSWORD_LOGIN=true` i lokal `.env` og bruke en bekreftet testbruker opprettet i Supabase Dashboard. Dette er aktivert lokalt i prosjektet. Se [trinnene for testkonto og passordinnlogging](docs/NEXT_STEPS.md). Produksjonsbuilden viser aldri dette utviklingsskjemaet. Global e-postbekreftelse, roller og RLS beholdes.

Lokal base er `/`. Produksjonsbasen er **`/pluss-minus-null-stress/`**. HashRouter gir lenker som `/pluss-minus-null-stress/#/arrangementer` og gjør omlasting/dypkobling trygg på GitHub Pages. `npm run build` bruker lokal base med mindre `VITE_BASE_PATH` er satt. Pages-workflowen setter korrekt produksjonsbase.

## Hva finnes?

- Responsiv Bokmål-grensesnitt med navigasjon, matematisk identitet, kalender, filtre, arrangementssider, tilstander, dialoger og varsler.
- E-postinnlogging/opprettelse av konto med Supabase Auth; magic link og manuell OTP. Konto, medlemskap og arrangementspåmelding er separate ting.
- Atomisk kapasitet, duplikatsperre, venteliste i påmeldingsrekkefølge, avbestilling og automatisk opprykk. Hvert lagmedlem bruker sin egen konto.
- Torsdagsbanken med anonym offentlig avsender, intern ansvarlighet, forslag, stemmer som kan trekkes og styremoderering.
- Tidsavgrensede avstemninger med private individuelle stemmer, ett valg per konto og skjulte resultater.
- Min side: profil, påmeldingshistorikk, egne forslag/stemmer, medlemskap, varslingsvalg, dataeksport og sletting.
- Styreportal på `#/admin`: arrangementer og bilder, lag/deltakere/CSV/oppmøte, forslag, avstemninger, medlemskap, roller, tilgangsgrupper, innhold, kontaktmeldinger og databaserte oversikter.
- In-app-varsler, e-postkø og Edge Functions for Resend, kontosletting og foreningseide arrangementsbilder.
- Migrasjoner, isolerte PostgreSQL-tester, Vitest/RTL, Playwright, axe-kontroller og manuell GitHub Pages-release.

## Oppsett og drift

1. Følg [Supabase-oppsettet](docs/SUPABASE.md), og kjør migrasjonene i det nye utviklingsprosjektet.
2. Konfigurer innlogging, Edge Functions og første administrator. Test mot utvikling først.
3. Les [styrehåndboken](docs/BOARD.md).
4. Gjennomgå [sikkerhet](docs/SECURITY.md), [personvern](docs/PRIVACY.md) og [lanseringssjekklisten](docs/DEPLOYMENT.md).
5. Kjør [testene](docs/TESTING.md). Se siste [lokale verifikasjon av medlemskap, forslag, avstemninger og mobil](docs/COMMUNITY_TESTS.md), inkludert migrasjonene som avventer godkjenning. Kontroller faktisk e-postlevering før dere omtaler den som fungerende.

Ingen ressurser er kjøpt. Ingen produksjonsdeploy utføres automatisk ved push. `pages.yml` må startes manuelt etter godkjenning, og `github-pages`-miljøet bør kreve en reviewer. CI er klargjort, men en GitHub Actions-kjøring er ikke bekreftet fra denne arbeidsøkten.

## Vanlige kommandoer

```sh
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:e2e
npm run build
node scripts/bundle-sql.mjs
node scripts/check-backend.mjs
```

Databasetestene bruker kun en egen ny database med navneprefikset `pmns_test_`, aldri Supabase-utviklings- eller produksjonsdata. De krever en lokal PostgreSQL-administratorforbindelse; se testdokumentasjonen. For backend-E2E kreves en komplett lokal Supabase-stack. De testene er eksplisitt hoppet over når den ikke finnes.

## Teknologi og struktur

React 19, TypeScript strict, Vite 8, Tailwind 4, React Router, Lucide, React Hook Form, Zod og TanStack Query. Eksakte kompatible versjoner og transitive avhengigheter er låst i `package.json` og `package-lock.json`.

```text
src/components/        Designsystem, layout og arrangementskort
src/pages/             Offentlige sider, konto og styreportal
src/lib/               API, sesjon/roller, typer, skjema og Oslo-tid
supabase/migrations/   Skjema, RLS, transaksjoner og herding
supabase/functions/    Serverfunksjoner uten frontend-hemmeligheter
supabase/seed.sql      Kun eksplisitt utviklingsdemo
supabase/schedule.sql  Manuelt, godkjent oppsett av vedlikeholdsjobb
tests/                 Nettleser- og databaseverifikasjon
docs/                  Arkitektur, tester, personvern og drift
.github/workflows/     CI og manuelt godkjent Pages-release
```

Quiz & Kaos er et utkast med dato **5. november 2026 kl. 18:00–21:30 Europe/Oslo**, maksimalt 40 deltakere og uavklart sted. Verken lokale, premier eller tillatelse til alkohol er bekreftet. Demoimporten må aldri brukes som faktiske kunngjøringer eller fiktive deltakerregistreringer.

## Tjenester og kostnader

GitHub Pages betjener statiske filer; database, innlogging, filer og serverfunksjoner ligger i Supabase. Resend er valgfritt for arrangementsmail, mens Supabase Auth trenger eget godkjent SMTP-oppsett før ordinær bruk.

Kontrollert 23. oktober 2026: Supabase Free inkluderer blant annet 500 MB database og 1 GB fillagring; lav aktivitet kan pause prosjektet etter sju dager. Pro starter rundt USD 25/måned. Resend Free har 3 000 e-poster/måned og 100/dag, og Pro starter rundt USD 20/måned. Priser, avgifter og kvoter kan endres; bilder, API-trafikk og e-postvolum må overvåkes. Se [Supabase-priser](https://supabase.com/pricing), [prosjektpausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Resend-priser](https://resend.com/pricing) og [GitHub Pages-grenser](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). Ingen betalt oppgradering er nødvendig for å inspisere eller teste kildekoden lokalt.
