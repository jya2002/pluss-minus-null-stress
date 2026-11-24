# GitHub Pages og produksjonsforberedelse

Produksjonsadressen er **https://plussminusnullstress.no/**. Både produksjon og lokal utvikling bruker base `/`. GitHub Pages leverer nå domenets rot, ikke repo-understien `/pluss-minus-null-stress/`.

Lesende kontroll 24. november 2026 med Chrome viste HTML 200, men JS/CSS 404 under den gamle repo-understien og en tom React-rot. Denne rettelsen klargjør en ny build; merge og deploy krever fortsatt godkjenning.

## 1. Kildekode og CI

Opprett/velg det avtalte GitHub-repoet, og push kildekoden etter gjennomgang. Ingen `.env`, `.runtime`, CSV-er eller brukerdata skal legges til. CI kjører typer, lint, Vitest, en produksjonsbuild, demo-E2E/axe og ekte PostgreSQL-transaksjonstester med minimale Supabase-grensesnitt.

Workflowen bruker PostgreSQL 17 i CI, mens den første lokale kontrollen ble utført på PostgreSQL 18. GitHub Actions er skrevet, men ikke kjørt av denne agenten. Bekreft den første kjøringen og vedlikehold Actions-versjoner som del av avhengighetsoppdateringer.

## 2. GitHub-konfigurasjon

I Settings > Pages velges **GitHub Actions**. Opprett repository variables, ikke serverhemmeligheter:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_BASE_PATH=/`

Produksjonsworkflowen krever fortsatt nøyaktig `https://unrdvalfkusnqhbfhber.supabase.co`, en ikke-tom offentlig nøkkel og base `/`. Demo og utviklingspassord er eksplisitt av. Lesende kontroll 24. november bekreftet riktig repository-base, PROD-ref og offentlig nøkkeltype; ingen nøkkelverdier er logget eller lagret i Git.

Dette er offentlige klientverdier, og beskyttelsen ligger i RLS. Builden avviser gjenkjennelige Supabase-secret-/service-role-nøkler i public key-feltet. Ikke stol på dette som eneste hemmelighetskontroll.

Opprett environment `github-pages` med required reviewer hvis kontoplanen støtter det. Pages-workflowen har bare `workflow_dispatch`, så vanlig push deployer ikke. Etter godkjente tester og lanseringsgjennomgang starter en ansvarlig manuelt «Deploy approved release to GitHub Pages».

`VITE_BASE_PATH=/` brukes i workflowen og som standard i Vite-valideringen. Vite skriver asset-lenker under `/assets/`. React HashRouter sørger for fungerende dypkoblinger uten serverfallback. Verifiser `https://plussminusnullstress.no/#/arrangementer` ved direkte åpning og omlasting etter godkjent deploy. Kontroller også JS/CSS, logo, favicon, Google-bilde og lokal font for 200-svar og riktig innholdstype.

Lokal reproduksjon i PowerShell:

```powershell
$env:VITE_BASE_PATH='/'
$env:VITE_DEMO_MODE='false'
$env:VITE_SUPABASE_URL='https://pmns-ui.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_ui_test'
npm run build
npm run test:pages
```

Dette er en lokal produksjonsbuild med fiktiv backend og simulerte OAuth-/API-svar; den skal ikke deployes som produksjon. `test:pages` starter Vite preview på `/` og tester den ferdige `dist`, ikke utviklingsserveren. Bruk en egen terminal og lukk den etterpå slik at testvariablene ikke påvirker andre builds. Ingen hemmeligheter skal inngå i byggartefakter.

## 3. Supabase-produksjon

Behold produksjonsprosjektet `unrdvalfkusnqhbfhber` og installerte migrasjoner. Domene-/baseendringen trenger ingen databasemigrasjon, reset, seed eller endring av bruker-/arrangementsdata.

Før godkjent deploy må en ansvarlig kontrollere disse innstillingene i eksisterende PROD-oppsett:

- Supabase Auth: Site URL og eksakt tillatt Redirect URL `https://plussminusnullstress.no/`, uten hash og uten repo-understi.
- Google Cloud: den aktuelle PROD-klientens Authorized JavaScript origin `https://plussminusnullstress.no` og Authorized redirect URI `https://unrdvalfkusnqhbfhber.supabase.co/auth/v1/callback`. Ikke erstatt Supabase-callbacken med frontendens adresse.
- Eventuell `www`-adresse må enten returnere til den kanoniske adressen eller få eksplisitt godkjent Auth-/origin-oppsett. Ikke legg til wildcard som snarvei.
- Aktive Edge Functions må ha riktig offentlig origin `https://plussminusnullstress.no`. Lesende OPTIONS mot PROD `account-delete` ga 404 den 24. november; funksjonens tilgjengelighet må avklares separat før kontosletting kan godkjennes. Dette er ikke årsaken til asset-feilen.

Offentlig GET av Auth-settings ga 200 og Google aktivert. Privat Site URL/redirectliste og Google Cloud-konsollen kunne ikke leses med tilgjengelige tilganger og er derfor **ikke verifisert**. Lokal produksjonspreview tester redirect/PKCE med mocks; faktisk Google-innlogging, retur, utlogging og eksisterende roller må kontrolleres etter en separat godkjent deploy. Ingen Auth-innstilling er endret i denne rettelsen.

Rotasjon av `.env`-verdier krever ny frontend-build. Rotasjon av serversecrets gjøres i Supabase og krever ingen frontendnøkkel. Endring av `ALLOWED_ORIGIN` må samsvare med faktisk origin uten repo-sti.

## Lanseringssjekkliste

- [ ] Godkjenning til offentlig deploy er gitt av prosjektansvarlig.
- [ ] GitHub CI er grønn og produksjonsbuildens base/dypkoblinger er kontrollert.
- [ ] Migrasjoner er anvendt og ekte Supabase-kontoer er testet for alle fire tilgangsnivåer.
- [ ] Full autentisert student-/styreflyt er kjørt mot en separat teststack.
- [ ] Magic link/OTP virker med faktisk SMTP, også på mobil og etter utløpt lenke.
- [ ] Påmelding, samtidighet, venteliste, lag og medlem-/gruppebegrensning er verifisert via API.
- [ ] Opplasting, eksport og full kontosletting er testet mot reell Storage/Edge.
- [ ] Resend/DNS, preferanser, påminnelser og faktisk innbokslevering er kontrollert.
- [ ] Vedlikeholdsjobben er aktiv, overvåket og har gjennomført frister på testdata.
- [ ] Sikkerhetskopiering, gjenoppretting, kvotevarsler og eventuelle kostnader er godkjent.
- [ ] Personvernerklæring, kontaktadresse, DPA og behandlingsgrunnlag er gjennomgått.
- [ ] Alle eksempelopplysninger er fjernet fra produksjon eller eksplisitt beholdt som demo i avtalt testmiljø.
- [ ] Styret har bekreftet Quiz & Kaos-detaljene før publisering; alkoholopplysninger er godkjent separat.
- [ ] Mobil, tastatur og skjermleserprøve er gjennomført; automatiske axe-kontroller erstatter ikke manuell WCAG-gjennomgang.

## Tilbakerulling og hendelser

Frontend kan bygges fra en tidligere gjennomgått Git-revisjon og deployes manuelt. Ikke tilbakestill databasen automatisk: en migrasjon kan ha nye brukerdata og må vurderes særskilt. Avpubliser et arrangement fra styreportalen ved innholdsfeil. Ved sikkerhetshendelse må den ansvarlige vurdere sperring av berørt bruker/rolle, nøkkelrotasjon, loggtilgang, varsling og kontrollert gjenoppretting.
