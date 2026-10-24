# Null-fjeset — lokal redesign

Implementeringsplan og gjennomført lokal verifikasjon, 24. oktober 2026, `develop`. Ingen push, merge eller deploy.

## Kartlegging

Frontend har en felles Layout, EventCard og UI-komponenter. Sider og skjemaer bruker den samme CSS-filen. Ved kartleggingen fantes allerede et påbegynt redesign med referansefargene, SVG-merke, lokal Fraunces-font, nye kort og designregresjoner. Dette er videreført og ferdigstilt uten å bygge om fungerende kode. Auth, medlemskap, påmeldinger, ventelister, forslag, avstemninger og administrasjon finnes allerede og er beholdt. Ingen skriving til ekte Supabase inngikk i designarbeidet.

## Plan

1. Bruk referansebildets gul `#FFDF45`, lilla `#291638`, krem, mint og rosa som felles designtokens. Lag én SVG-fil for null-fjeset som brukes i React og favicon. Selvhost Fraunces med lisens; brødtekst og navigasjon bruker systemets sans-serif.
2. Forny toppmeny, forside og arrangementskort. Forsiden får «Mer fellesskap. Mindre stress.», store kort med datomerker og en tydelig inngang til eksisterende påmelding. Behold API-spørringer, publiseringsstatus, Oslo-tid og tom-/feiltilstander. Demoinnhold skal fortsatt merkes.
3. Utvid felles stil til alle sider, skjemaer, kalender, modalvinduer og administrasjon. Hold data- og skjemakort rette, og bruk rotasjon bare på forsidens arrangementsplakater. Behold tastatur- og fokuslogikk, og respekter redusert bevegelse.
4. Kjør TypeScript, lint, berørte komponenttester, simulerte Playwright-flyter og tilgjengelighets-/responsivkontroller. Kontroller produksjonsbuild og repo-sti for Pages. Ingen live-fixtures, endring av backend, push eller deploy.

## Verifikasjon

| Kontroll | Resultat | Avgrensning |
| --- | --- | --- |
| TypeScript strict og ESLint | Bestått | Lokal kildekode |
| Berørte komponenttester | 30/30 bestått i fem filer | EventCard, app/forside, påmelding, Auth og forslag; simulerte data |
| Playwright UI | 40 ulike tester bestått på desktop og mobil | Design, tomtilstand, påmelding/venteliste/avmelding/opprykk, adminoppretting/redigering, Sted-skriving/innliming, community, Google-flyt og slette-UI; simulerte API-er |
| Responsivitet og tilgjengelighet | 8/8 responsive tester bestått, inngår i de 40 | Axe med WCAG A/AA-tags til og med 2.2, tastatur/skiplink, meny, dialogfokus, offentlige sider, Min side, forslag/polls og alle adminfaner; egne 320px-kontroller |
| Designregresjoner | 4/4 bestått, inngår i de 40 | Farger, font, logo/favicon, kortlenker, reelle datofelt, kort i første skjermbilde, ingen fiktive publiserte arrangementer; 320/390/768/1024/1440 px og redusert bevegelse |
| Pages-produksjonsbuild | Bestått | Base `/pluss-minus-null-stress/`, fiktiv offentlig Supabase-konfigurasjon, ingen servernøkler |
| Playwright Pages | 10 ulike tester bestått | Desktop/mobil, assets, direkte hash-ruter, omlasting, PKCE-retur og Google suksess/avbrutt/ugyldig; simulerte svar |
| Hemmeligheter og backend | Ingen funn i kilde-/buildskann; fire gjennomgåtte backendhashverdier uendret | Kun lesende lokal kontroll; `develop`, miljøfiler og forhåndsvisninger fortsatt Git-ignorert |

Testantallene teller hver test bare én gang. Første UI-kjøring hadde 34 beståtte og seks kontrastfeil. Etter retting bestod de 12 berørte design-/responsivtestene, inkludert de seks som hadde feilet; de øvrige funksjonsflytene ble ikke gjentatt unødvendig. Første Pages-kjøring hadde åtte beståtte og to feil fordi testens mock-origin ble lest fra lokal `.env`, mens builden brukte den fiktive backenden. Bare de to routing-testene ble kjørt på nytt med samsvarende fiktiv konfigurasjon; begge bestod. Ingen produkt- eller backendendring var nødvendig for dette testoppsettsavviket.

## Ferdigstilt og rettet

- Gul `#FFDF45`, lilla `#291638`, krem `#FFF9ED`, mint `#8DE2CB` og rosa `#FF8DB4` brukes på tvers av alle sider. Tette adminflater bruker rette kort og lesbar sans-serif.
- Null-fjeset i `src/assets/null-face.svg` deles av React-komponenten `BrandMark` og favicon. Fraunces lastes lokalt fra `src/assets/fonts`, med vedlagt OFL-lisens; ingen ekstern fontforespørsel.
- Forsiden følger referansens prioritering: todelt serif-overskrift og kommende arrangementer først. Introduksjon og snarveier er beholdt under kortene, slik at arrangementene også vises i første skjermbilde på mobil. Ingen API-spørring eller publiseringsregel er erstattet med hardkodet arrangementsinnhold.
- Kortene har krem/mint, rosa/krem datomerker, mørke konturer, diskret rotasjon og tydelig inngang til eksisterende påmeldingsside. Utkast, avlysning, frist, pris, kapasitet, feil og tomtilstander beholdes.
- Rettet feilaktig `exact`-opsjon i en Testing Library-test som hindret TypeScript-kontrollen.
- Rettet for generell CSS-knappeselektor som overstyrte den mørke bakgrunnen på aktive adminfaner og andre valgte knapper. Regresjonen kontrollerer bakgrunnsfargen på alle adminfanene.
- Økt kontrasten på matematikkdetaljen i forslagsseksjonen. Den store, nedtonede tekstdekorasjonen i medlemsseksjonen er erstattet med en dekorativ SVG-plussfigur.

## Forhåndsvisninger og lokal kontroll

Følgende Git-ignorerte bilder er visuelt gjennomgått. De viser **simulerte, tydelig merkede testarrangementer**, ikke publisert foreningsinformasjon:

- `.runtime/design-review/homepage-desktop.png`
- `.runtime/design-review/homepage-mobile.png`
- `.runtime/design-review/homepage-desktop-full.png`
- `.runtime/design-review/homepage-mobile-full.png`

Start vanlig lokal utvikling med `npm.cmd run dev`. Den bruker eksisterende `.env`; uten publiserte arrangementer viser forsiden tomtilstanden. Den genererte `dist` i denne runden bruker en fiktiv backend for isolerte Pages-tester og skal ikke publiseres som en fungerende Supabase-build.

Nettlesertestene bruker eksisterende isolerte oppsett med simulerte Supabase-svar. Dette er ikke nye ekte Auth-, database- eller RLS-tester; tidligere ekte backend-resultater er beholdt. Ingen database, migrasjon, Edge Function, secret, Supabase-konfigurasjon eller rollelogikk er endret. Offentlig publisering og reell bruk på Pages er fortsatt separate, ikke utførte steg.
