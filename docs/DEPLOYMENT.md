# GitHub Pages og produksjonsforberedelse

**Ingen offentlig produksjonsdeploy er utført eller automatisk godkjent.** Repoet heter `pluss-minus-null-stress`; Pages-basen er `/pluss-minus-null-stress/`. Lokalt brukes `/`.

## 1. Kildekode og CI

Opprett/velg det avtalte GitHub-repoet, og push kildekoden etter gjennomgang. Ingen `.env`, `.runtime`, CSV-er eller brukerdata skal legges til. CI kjører typer, lint, Vitest, en produksjonsbuild, demo-E2E/axe og ekte PostgreSQL-transaksjonstester med minimale Supabase-grensesnitt.

Workflowen bruker PostgreSQL 17 i CI, mens den første lokale kontrollen ble utført på PostgreSQL 18. GitHub Actions er skrevet, men ikke kjørt av denne agenten. Bekreft den første kjøringen og vedlikehold Actions-versjoner som del av avhengighetsoppdateringer.

## 2. GitHub-konfigurasjon

I Settings > Pages velges **GitHub Actions**. Opprett repository variables, ikke serverhemmeligheter:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Dette er offentlige klientverdier, og beskyttelsen ligger i RLS. Builden avviser gjenkjennelige Supabase-secret-/service-role-nøkler i public key-feltet. Ikke stol på dette som eneste hemmelighetskontroll.

Opprett environment `github-pages` med required reviewer hvis kontoplanen støtter det. Pages-workflowen har bare `workflow_dispatch`, så vanlig push deployer ikke. Etter godkjente tester og lanseringsgjennomgang starter en ansvarlig manuelt «Deploy approved release to GitHub Pages».

`VITE_BASE_PATH=/pluss-minus-null-stress/` er eksplisitt satt i workflowen. Vite skriver asset-lenker med denne basen. React HashRouter sørger for fungerende dypkoblinger uten serverfallback. Verifiser `/pluss-minus-null-stress/#/arrangementer` ved direkte åpning og omlasting etter første godkjente deploy.

Lokal reproduksjon i PowerShell:

```powershell
$env:VITE_BASE_PATH='/pluss-minus-null-stress/'
npm run build
Remove-Item Env:VITE_BASE_PATH
npm run preview
```

`Remove-Item Env:...` fjerner bare den midlertidige prosessvariabelen. Besøk repo-stien i preview ved base-test. Ingen hemmeligheter skal inngå i byggartefakter.

## 3. Supabase-produksjon

Bruk et separat produksjonsprosjekt. Gjennomgå migrasjonene og kjør dry-run før godkjent anvendelse. Bruk aldri reset/seed mot produksjon. Konfigurer nøyaktig Site URL/redirect, SMTP, Edge Functions, secrets, Vault, scheduler og bilder som i [SUPABASE.md](SUPABASE.md).

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
