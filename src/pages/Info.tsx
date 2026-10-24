import { Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowUpRight, Heart, Mail, Users } from "lucide-react";
import { api, demo, rpc } from "../lib/api";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/utils";
import { Failure, Field, Submit, useToast } from "../components/ui";
export function About() {
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const { session } = useAuth();
  const toast = useToast();
  const form = useForm<{ subject: string; message: string }>();
  const mutation = useMutation({
    mutationFn: (v: { subject: string; message: string }) =>
      rpc("submit_contact", { p_subject: v.subject, p_message: v.message }),
    onSuccess: () => {
      form.reset();
      toast(
        "Meldingen er lagret til styret. Vi svarer gjennom oppgitt kontaktkanal når det er mulig.",
      );
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  return (
    <div className="container page">
      <div className="page-heading">
        <div className="eyebrow">MATEMATIKK + MENNESKER</div>
        <h1>
          Et fellesskap som går opp<span className="pink-dot">.</span>
        </h1>
        <p>Vi er Pluss Minus Null Stress.</p>
      </div>
      <div className="two-cols">
        <article className="panel about-panel">
          <Heart size={34} />
          <h2>Mer enn pensum</h2>
          {settings.error ? (
            <Failure error={settings.error} />
          ) : (
            <p className="pre-line">{settings.data?.about}</p>
          )}
          <p>
            Du trenger ikke kjenne noen fra før. Her er det rom for alle kull og
            alle som er interessert i matematikk, statistikk, matematisk finans
            og modellering.
          </p>
          <h3>
            <Users size={21} />
            Bli med på dine premisser
          </h3>
          <p>
            Kom på et arrangement, legg inn en idé eller søk medlemskap. Å delta
            på et arrangement gjør deg ikke automatisk til medlem.
          </p>
          <Link className="button primary" to="/min-side">
            Søk medlemskap <ArrowUpRight size={18} />
          </Link>
        </article>
        <section className="panel">
          <Mail size={30} />
          <h2>Kontakt styret</h2>
          {settings.data?.contact_email ? (
            <p>
              <a href={`mailto:${settings.data.contact_email}`}>
                {settings.data.contact_email}
              </a>
            </p>
          ) : (
            <p>
              Styret legger inn offisiell kontaktadresse før lansering.
              Innloggede studenter kan sende en melding her.
            </p>
          )}
          {demo ? (
            <div className="notice">
              Kontaktskjemaet aktiveres når Supabase er koblet til.
            </div>
          ) : !session ? (
            <Link className="button" to="/logg-inn?retur=%2Fom">
              Logg inn for å sende en melding
            </Link>
          ) : (
            <form
              className="form-stack"
              onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            >
              <Field label="Emne">
                <input
                  {...form.register("subject")}
                  required
                  minLength={3}
                  maxLength={160}
                />
              </Field>
              <Field
                label="Melding"
                hint="Unngå sensitive opplysninger. Oppgi en kontaktkanal hvis du ønsker svar."
              >
                <textarea
                  rows={5}
                  {...form.register("message")}
                  required
                  minLength={10}
                  maxLength={4000}
                />
              </Field>
              <Submit pending={mutation.isPending}>Send til styret</Submit>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
export function Privacy() {
  return (
    <div className="container page prose">
      <div className="eyebrow">PERSONVERN</div>
      <h1>Dine data, forklart enkelt.</h1>
      <div className="notice">
        Utkast til personvernerklæring. Styret må fylle inn behandlingsansvarlig
        kontakt, behandlingsgrunnlag, valgte leverandørregioner og
        klageinformasjon før lansering. Dette er ikke juridisk sertifisering.
      </div>
      <h2>Hva vi lagrer og hvorfor</h2>
      <p>
        Vi bruker e-post til innlogging, og visningsnavn for kontoen din.
        Studieprogram, studieår og profilbilde er valgfritt. Påmelding,
        lagtilhørighet og kosthensyn brukes til å gjennomføre arrangementene.
        Forslag og stemmer brukes til å planlegge aktiviteter. Medlemskap
        behandles separat.
      </p>
      <h2>Hvem kan se opplysningene?</h2>
      <p>
        Bare du og autoriserte styremedlemmer kan se dine påmeldinger og
        kosthensyn. Andre studenter kan se lagnavn, men ikke medlemslister.
        Forslag vises med visningsnavn eller som «Anonym student». Styret kan se
        avsender internt. Individuelle stemmer er private.
      </p>
      <h2>Hvor lenge lagres de?</h2>
      <p>
        Kosthensyn fjernes senest 7 dager etter arrangementet. Påmeldinger
        fjernes etter 180 dager, kontaktmeldinger etter 90 dager, varsler etter
        180 dager og endringslogger etter 365 dager. Disse fristene forutsetter
        at den dokumenterte vedlikeholdsjobben kjører. Konto og medlemskap
        beholdes til sletting eller styrets årlige gjennomgang. Profilbilder og
        andre opplastinger må også fjernes fra lagring og sikkerhetskopier etter
        leverandørens frister.
      </p>
      <h2>Dine valg og rettigheter</h2>
      <p>
        Du kan oppdatere profilen, velge e-postvarsler, laste ned en kopi av
        dataene dine og slette kontoen fra Min side. Ved sletting fjernes
        personlige rader, mens forslag anonymiseres. Sikkerhetskopier kan
        beholdes i leverandørens begrensede gjenopprettingsperiode. Kontakt
        styret for innsyn, retting, protest, begrensning eller spørsmål om
        sletting.
      </p>
      <h2>Leverandører og lokal lagring</h2>
      <p>
        Ved innlogging med Google behandler Google innlogging og samtykke, og
        deler grunnleggende kontoinformasjon som e-post og profil med Supabase.
        Appen ber ikke om tilgang til e-postinnhold, kalender eller Google
        Drive.
      </p>
      <p>
        Supabase behandler autentisering, database og filer. GitHub Pages
        leverer nettsiden og kan behandle tekniske tilgangslogger. Dersom styret
        aktiverer Resend, behandler denne leverandøren e-postadresse og
        meldingstekst. E-post inneholder aldri kosthensyn eller deltakerlister.
        Styret må gjennomgå databehandleravtaler, overføringsgrunnlag og
        regionvalg.
      </p>
      <p>
        Innlogging lagres lokalt i nettleseren for at du skal forbli innlogget.
        Ingen analyseverktøy eller markedsføringssporing er installert. Når du
        logger ut, fjernes den aktive innloggingsøkten.
      </p>
      <h2>Kontakt og klage</h2>
      <p>
        Kontakt styret via <Link to="/om">kontaktsiden</Link>. Styret må
        dokumentere behandlingsgrunnlag og behandlingsansvarlig før nettsiden
        tas i bruk. Du kan klage til Datatilsynet hvis du mener
        personopplysninger behandles ulovlig.
      </p>
      <Link className="button" to="/min-side">
        Administrer mine data
      </Link>
    </div>
  );
}
