import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Search,
  Users,
  List,
  ArrowLeft,
  Accessibility,
} from "lucide-react";
import { api, demo, request, db, rpc } from "../lib/api";
import { useAuth } from "../lib/auth";
import { categories } from "../lib/types";
import type { Registration, Team } from "../lib/types";
import { dateLabel, errorMessage, timeLabel, osloInput } from "../lib/utils";
import { registrationSchema } from "../lib/schemas";
import type { RegistrationInput } from "../lib/schemas";
import EventCard, { EventArt } from "../components/EventCard";
import {
  Badge,
  Empty,
  Failure,
  Field,
  Loading,
  Submit,
  useToast,
} from "../components/ui";
export default function Events() {
  const [params, setParams] = useSearchParams();
  const view = params.get("visning") ?? "liste";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [past, setPast] = useState(false);
  const [sort, setSort] = useState("date");
  const events = useQuery({ queryKey: ["events"], queryFn: api.events });
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary });
  const filtered =
    events.data
      ?.filter(
        (e) =>
          (past
            ? new Date(e.ends_at) < new Date()
            : new Date(e.ends_at) >= new Date()) &&
          (!category || e.category === category) &&
          `${e.title} ${e.description} ${e.location}`
            .toLocaleLowerCase("nb")
            .includes(search.toLocaleLowerCase("nb")),
      )
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title, "nb")
          : sort === "price"
            ? a.price_nok - b.price_nok
            : (past ? -1 : 1) *
              (Date.parse(a.starts_at) - Date.parse(b.starts_at)),
      ) ?? [];
  return (
    <div className="container page">
      <div className="page-heading">
        <div className="eyebrow">GODE FOLK. GODE PAUSER.</div>
        <h1>
          Arrangementer<span className="pink-dot">.</span>
        </h1>
        <p>Finn din neste møteplass – på og utenfor Blindern.</p>
      </div>
      <div className="toolbar">
        <div className="segmented">
          <button
            className={!past ? "selected" : ""}
            onClick={() => setPast(false)}
          >
            Kommende
          </button>
          <button
            className={past ? "selected" : ""}
            onClick={() => setPast(true)}
          >
            Tidligere
          </button>
        </div>
        <div className="segmented">
          <button
            aria-label="Listevisning"
            aria-pressed={view === "liste"}
            className={view === "liste" ? "selected" : ""}
            onClick={() => setParams({ visning: "liste" })}
          >
            <List size={17} />
            Liste
          </button>
          <button
            aria-label="Kalendervisning"
            aria-pressed={view === "kalender"}
            className={view === "kalender" ? "selected" : ""}
            onClick={() => setParams({ visning: "kalender" })}
          >
            <CalendarDays size={17} />
            Kalender
          </button>
        </div>
      </div>
      <div className="filters">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Søk etter arrangementer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk etter arrangementer …"
          />
        </label>
        <select
          aria-label="Kategori"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Alle kategorier</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Sorter arrangementer"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date">Etter dato</option>
          <option value="title">Etter navn</option>
          <option value="price">Etter pris</option>
        </select>
      </div>
      {events.isPending ? (
        <Loading />
      ) : events.error ? (
        <Failure error={events.error} retry={() => void events.refetch()} />
      ) : view === "kalender" ? (
        <Calendar events={filtered} />
      ) : filtered.length ? (
        <div className="event-grid">
          {filtered.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              summary={summary.data?.find((s) => s.event_id === e.id)}
            />
          ))}
        </div>
      ) : (
        <Empty title="Ingen arrangementer funnet">
          Prøv et annet søk eller en annen kategori.
        </Empty>
      )}
    </div>
  );
}
function Calendar({ events }: { events: import("../lib/types").Event[] }) {
  const osloMonth = (instant: string) => {
    const [year, month] = osloInput(instant).slice(0, 7).split("-").map(Number);
    return new Date(year, month - 1, 1);
  };
  const [month, setMonth] = useState(() => {
    return osloMonth(events[0]?.starts_at ?? new Date().toISOString());
  });
  const start =
    (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <section className="calendar" aria-label="Arrangementskalender">
      <div className="calendar-head">
        <h2>
          {new Intl.DateTimeFormat("nb", {
            month: "long",
            year: "numeric",
          }).format(month)}
        </h2>
        <div className="button-row">
          <button
            className="icon-button"
            aria-label="Forrige måned"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft />
          </button>
          <button
            className="button small"
            onClick={() => setMonth(osloMonth(new Date().toISOString()))}
          >
            I dag
          </button>
          <button
            className="icon-button"
            aria-label="Neste måned"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((d) => (
          <div className="weekday" key={d}>
            {d}
          </div>
        ))}
        {Array.from({ length: start }, (_, i) => (
          <div className="calendar-day blank" key={`blank${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          return (
            <div className="calendar-day" key={key}>
              <span>{i + 1}</span>
              {events
                .filter(
                  (e) =>
                    new Intl.DateTimeFormat("sv-SE", {
                      timeZone: "Europe/Oslo",
                    }).format(new Date(e.starts_at)) === key,
                )
                .map((e) => (
                  <Link to={`/arrangementer/${e.id}`} key={e.id}>
                    <span>{timeLabel(e.starts_at)}</span>
                    {e.title}
                    {e.status === "draft" ? " (utkast)" : ""}
                  </Link>
                ))}
            </div>
          );
        })}
      </div>
      <p className="calendar-note">Alle tider vises i Europe/Oslo.</p>
    </section>
  );
}
export function EventDetail() {
  const { id } = useParams();
  const events = useQuery({ queryKey: ["events"], queryFn: api.events });
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary });
  const event = events.data?.find((e) => e.id === id);
  if (events.isPending)
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  if (events.error)
    return (
      <div className="container page">
        <Failure error={events.error} />
      </div>
    );
  if (!event)
    return (
      <div className="container page">
        <Empty title="Arrangementet finnes ikke">
          Det kan være et upublisert utkast.
        </Empty>
        <Link to="/arrangementer" className="button">
          Til arrangementene
        </Link>
      </div>
    );
  const counts = summary.data?.find((s) => s.event_id === id);
  return (
    <div className="container page">
      <Link className="text-button back-link" to="/arrangementer">
        <ArrowLeft size={17} />
        Alle arrangementer
      </Link>
      <div className="detail-grid">
        <article>
          <EventArt event={event} large />
          <div className="detail-title">
            <Badge>{event.category}</Badge>
            <h1>{event.title}</h1>
            <p className="lead">{event.subtitle}</p>
          </div>
          {event.status === "draft" && (
            <div className="notice">
              Dette er et utkast. Styret må bekrefte detaljene før arrangementet
              kan publiseres og påmeldingen åpnes.
            </div>
          )}
          {event.status === "cancelled" && (
            <div className="error">Arrangementet er avlyst.</div>
          )}
          <h2>En kveld å bli med på</h2>
          <p className="pre-line description">{event.description}</p>
          <div className="panel">
            <h3>
              <Accessibility size={21} />
              Tilgjengelighet
            </h3>
            <p>{event.accessibility}</p>
          </div>
          {event.alcohol_approved && event.alcohol_info && (
            <div className="panel">
              <h3>Praktisk informasjon</h3>
              <p>{event.alcohol_info}</p>
            </div>
          )}
          {event.external_url && (
            <a
              className="text-button"
              href={event.external_url}
              target="_blank"
              rel="noreferrer"
            >
              Ekstern arrangementsside ↗
            </a>
          )}
        </article>
        <aside className="registration-panel panel">
          <Badge tone="green">
            {event.price_nok === 0 ? "Gratis å delta" : `${event.price_nok} kr`}
          </Badge>
          <h2>Bli med!</h2>
          <ul className="event-facts">
            <li>
              <CalendarDays />
              <div>
                <strong>
                  {dateLabel(event.starts_at, { weekday: "long" })}
                </strong>
                <span>
                  {timeLabel(event.starts_at)}–{timeLabel(event.ends_at)}
                </span>
              </div>
            </li>
            <li>
              <MapPin />
              <div>
                <strong>{event.location}</strong>
                {event.map_url && (
                  <a href={event.map_url} target="_blank" rel="noreferrer">
                    Se kart ↗
                  </a>
                )}
              </div>
            </li>
            <li>
              <Users />
              <div>
                <strong>Maks {event.capacity} deltakere</strong>
                <span>
                  {counts
                    ? `${Math.max(0, event.capacity - counts.confirmed)} ledige · ${counts.waitlisted} på venteliste`
                    : summary.error
                      ? "Plassoversikten er utilgjengelig."
                      : demo
                        ? "Demo: ingen reelle påmeldinger"
                        : "Plassoversikt hentes …"}
                </span>
              </div>
            </li>
            <li>
              <Clock />
              <div>
                <strong>Påmeldingsfrist</strong>
                <span>
                  {dateLabel(event.deadline)} kl. {timeLabel(event.deadline)}
                </span>
              </div>
            </li>
          </ul>
          {summary.error && (
            <Failure
              error={summary.error}
              retry={() => void summary.refetch()}
            />
          )}
          <p className="muted">
            {event.audience === "members"
              ? "Kun godkjente medlemmer"
              : event.audience === "groups"
                ? "For godkjente grupper"
                : "Åpent for alle"}
            {event.min_age ? ` · ${event.min_age} års aldersgrense` : ""}
          </p>
          <RegistrationForm event={event} />
          <p className="small-text">Arrangør: {event.organizer}</p>
        </aside>
      </div>
    </div>
  );
}
function RegistrationForm({ event }: { event: import("../lib/types").Event }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: registrations, error: regError } = useQuery({
    queryKey: ["my-registrations", session?.user.id],
    queryFn: () =>
      request<Registration[]>(
        db()
          .from("event_registrations")
          .select("*")
          .eq("user_id", session!.user.id),
      ),
    enabled: !!session,
  });
  const teams = useQuery({
    queryKey: ["teams", event.id],
    queryFn: () => rpc<Team[]>("list_teams", { p_event: event.id }),
    enabled: !!session && event.registration_mode === "team",
  });
  const form = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      dietary: "",
      dietaryConsent: false,
      team: "",
      teamName: "",
    },
  });
  const selectedTeam = useWatch({ control: form.control, name: "team" });
  const registration = registrations?.find(
    (r) => r.event_id === event.id && r.status !== "cancelled",
  );
  const mutation = useMutation({
    mutationFn: (v: RegistrationInput) =>
      rpc<string>("register_event", {
        p_event: event.id,
        p_dietary: v.dietary,
        p_dietary_consent: v.dietaryConsent,
        p_team: v.team && v.team !== "new" ? v.team : null,
        p_team_name: v.team === "new" ? v.teamName.trim() : null,
      }),
    onSuccess: async (status) => {
      await qc.invalidateQueries();
      toast(
        status === "confirmed"
          ? "Du er påmeldt! Bekreftelsen ligger på Min side."
          : "Du står på ventelisten. Vi varsler deg når du får plass.",
      );
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  if (demo)
    return (
      <div className="notice">Demovisning. Ingen påmelding blir lagret.</div>
    );
  // Closing new registrations must not hide an already stored confirmation.
  if (event.status === "published" && registration)
    return (
      <div className="notice success">
        {registration.status === "confirmed"
          ? "Du er påmeldt!"
          : "Du står på ventelisten."}
        <Link to="/min-side">Administrer på Min side →</Link>
      </div>
    );
  if (
    event.status !== "published" ||
    !event.registration_open ||
    new Date(event.deadline) < new Date()
  )
    return <div className="notice">Påmeldingen er stengt.</div>;
  if (!session)
    return (
      <Link
        to={`/logg-inn?retur=${encodeURIComponent(`/arrangementer/${event.id}`)}`}
        className="button primary full"
      >
        Logg inn for å melde deg på
      </Link>
    );
  if (regError) return <Failure error={regError} />;
  if (!registrations) return <p role="status">Henter din påmelding …</p>;
  return (
    <form
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      className="form-stack"
    >
      {event.registration_mode === "team" && (
        <>
          <Field
            label="Lag"
            hint="Hvert lagmedlem melder seg på med sin egen konto."
          >
            <select {...form.register("team")}>
              <option value="">Jeg kommer uten lag</option>
              <option value="new">Opprett et nytt lag</option>
              {teams.data?.map((t) => (
                <option
                  value={t.id}
                  key={t.id}
                  disabled={t.members >= event.max_team_size}
                >
                  {t.name} ({t.members}/{event.max_team_size})
                </option>
              ))}
            </select>
          </Field>
          {teams.error && <Failure error={teams.error} />}
          {selectedTeam === "new" && (
            <Field
              label="Lagnavn"
              error={form.formState.errors.teamName?.message}
            >
              <input {...form.register("teamName")} />
            </Field>
          )}
        </>
      )}
      <Field
        label="Kosthensyn (valgfritt)"
        error={form.formState.errors.dietary?.message}
        hint="Kun du og styret kan se dette. Kosthensyn er frivillig; oppgi bare det arrangøren trenger."
      >
        <textarea rows={2} {...form.register("dietary")} />
      </Field>
      <label className="checkbox">
        <input type="checkbox" {...form.register("dietaryConsent")} />
        Jeg samtykker til at kosthensyn lagres for dette arrangementet. Feltet
        kan stå tomt.
      </label>
      {form.formState.errors.dietaryConsent && (
        <small role="alert" className="field-error">
          {form.formState.errors.dietaryConsent.message}
        </small>
      )}
      <Submit pending={mutation.isPending}>
        Meld meg på / sett meg på venteliste
      </Submit>
      <p className="small-text">
        Fullt? Du får ventelisteplass hvis ventelisten er åpen.
      </p>
    </form>
  );
}
