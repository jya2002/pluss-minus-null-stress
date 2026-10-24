import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import {
  CalendarDays,
  Check,
  Copy,
  Download,
  Edit3,
  LayoutDashboard,
  Mail,
  Megaphone,
  Plus,
  Shield,
  Trash2,
  Users,
  Vote,
} from "lucide-react";
import { api, db, demo, request, rpc, tableRows, upload } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNow } from "../lib/clock";
import { categories, suggestionStatuses } from "../lib/types";
import type {
  Announcement,
  Event,
  EventSummary,
  Membership,
  Poll,
  Profile,
  Registration,
  Settings,
  Team,
} from "../lib/types";
import {
  csvCell,
  dateLabel,
  download,
  errorMessage,
  fromOsloInput,
  osloInput,
} from "../lib/utils";
import {
  Badge,
  Confirm,
  Empty,
  Failure,
  Field,
  Loading,
  Modal,
  Submit,
  useToast,
} from "../components/ui";
import DeleteEventDialog from "../components/DeleteEventDialog";
type Tab =
  | "overview"
  | "events"
  | "registrations"
  | "suggestions"
  | "polls"
  | "members"
  | "content"
  | "groups"
  | "contact"
  | "audit";
const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Oversikt", icon: LayoutDashboard },
  { id: "events", label: "Arrangementer", icon: CalendarDays },
  { id: "registrations", label: "Påmeldinger og lag", icon: Users },
  { id: "suggestions", label: "Forslag", icon: Vote },
  { id: "polls", label: "Avstemninger", icon: Check },
  { id: "members", label: "Medlemmer og roller", icon: Shield },
  { id: "content", label: "Innhold", icon: Megaphone },
  { id: "groups", label: "Tilgangsgrupper", icon: Users },
  { id: "contact", label: "Kontaktmeldinger", icon: Mail },
  { id: "audit", label: "Endringslogg", icon: Edit3 },
];
function useAction() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async ({
      name,
      args,
    }: {
      name: string;
      args?: Record<string, unknown>;
    }) => rpc(name, args),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast("Endringen er lagret.");
    },
    onError: (e) => toast(errorMessage(e), true),
  });
}
export default function Admin() {
  const { session, loading, role, roleError } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const enabled = !!session && role !== "student";
  const events = useQuery({
    queryKey: ["events"],
    queryFn: api.events,
    enabled,
  });
  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: api.summary,
    enabled,
  });
  const registrations = useQuery({
    queryKey: ["admin-registrations"],
    queryFn: () =>
      tableRows<Registration>("event_registrations", {
        order: ["created_at", "id"],
      }),
    enabled,
  });
  const profiles = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: () =>
      tableRows<Profile>("profiles", { order: ["display_name", "id"] }),
    enabled,
  });
  const members = useQuery({
    queryKey: ["admin-members"],
    queryFn: () =>
      tableRows<Membership>("memberships", {
        order: ["joined_at", "user_id"],
        ascending: false,
      }),
    enabled,
  });
  if (loading)
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  if (demo)
    return (
      <div className="container page narrow">
        <div className="panel">
          <Shield size={32} />
          <h1>Styreportalen</h1>
          <p>
            Administrasjon krever en ekte Supabase-konto med styre- eller
            administratorrolle. Demovisningen har ingen simulert
            administratorinnlogging.
          </p>
          <Link to="/" className="button">
            Til forsiden
          </Link>
        </div>
      </div>
    );
  if (!session) return <Navigate to="/logg-inn?retur=%2Fadmin" replace />;
  if (roleError)
    return (
      <div className="container page">
        <Failure error={roleError} />
      </div>
    );
  if (role === "student")
    return (
      <div className="container page">
        <Empty title="Kun for styret">
          Kontoen din har ikke tilgang til styreportalen.
        </Empty>
      </div>
    );
  const error =
    events.error ||
    summary.error ||
    registrations.error ||
    profiles.error ||
    members.error;
  if (error)
    return (
      <div className="container page">
        <Failure error={error} />
      </div>
    );
  if (
    events.isPending ||
    summary.isPending ||
    registrations.isPending ||
    profiles.isPending ||
    members.isPending
  )
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  return (
    <div className="container page admin-page">
      <div className="page-heading">
        <div className="eyebrow">PLUSS MINUS NULL STRESS · STYREPORTALEN</div>
        <h1>
          Hei, styret<span className="pink-dot">.</span>
        </h1>
        <p>En god møteplass begynner med litt oversikt.</p>
      </div>
      <div className="admin-layout">
        <nav className="admin-nav" aria-label="Administrasjon">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="admin-main">
          {error && <Failure error={error} />}
          {tab === "overview" && (
            <Overview
              events={events.data ?? []}
              summary={summary.data ?? []}
              registrations={registrations.data ?? []}
              members={members.data ?? []}
            />
          )}
          {tab === "events" && <AdminEvents events={events.data ?? []} />}
          {tab === "registrations" && (
            <Participants
              events={events.data ?? []}
              registrations={registrations.data ?? []}
              profiles={profiles.data ?? []}
            />
          )}
          {tab === "suggestions" && <Moderation />}
          {tab === "polls" && <AdminPolls />}
          {tab === "members" && (
            <Members
              profiles={profiles.data ?? []}
              members={members.data ?? []}
              admin={role === "admin"}
            />
          )}
          {tab === "content" && <Content />}
          {tab === "groups" && (
            <Groups profiles={profiles.data ?? []} events={events.data ?? []} />
          )}
          {tab === "contact" && <Contacts profiles={profiles.data ?? []} />}
          {tab === "audit" && <Audit />}
        </div>
      </div>
    </div>
  );
}
function Overview({
  events,
  summary,
  registrations,
  members,
}: {
  events: Event[];
  summary: EventSummary[];
  registrations: Registration[];
  members: Membership[];
}) {
  const now = useNow();
  const upcoming = events.filter(
    (e) => e.status === "published" && Date.parse(e.ends_at) > now,
  );
  const current = summary.filter((s) =>
    upcoming.some((e) => e.id === s.event_id),
  );
  const suggestions = useQuery({
    queryKey: ["suggestions"],
    queryFn: api.suggestions,
  });
  const polls = useQuery({ queryKey: ["polls"], queryFn: api.polls });
  const [poll, setPoll] = useState("");
  const results = useQuery({
    queryKey: ["poll-results", poll],
    queryFn: () =>
      rpc<{ option_id: string; votes: number }[]>("poll_results", {
        p_poll: poll,
      }),
    enabled: !!poll,
  });
  return (
    <>
      <h2>Dette skjer nå</h2>
      <div className="stats-grid">
        {[
          { label: "Kommende arrangementer", value: upcoming.length },
          {
            label: "Bekreftede påmeldinger",
            value: current.reduce((s, r) => s + r.confirmed, 0),
          },
          {
            label: "På venteliste",
            value: current.reduce((s, r) => s + r.waitlisted, 0),
          },
          {
            label: "Godkjente medlemmer",
            value: members.filter((m) => m.status === "approved").length,
          },
        ].map((s) => (
          <div className="panel stat" key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <h3>Kapasitet og oppmøte</h3>
        <div
          className="table-wrap"
          role="region"
          aria-label="Kapasitet og oppmøte"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Arrangement</th>
                <th>Bekreftet</th>
                <th>Ledig</th>
                <th>Venteliste</th>
                <th>Registrert oppmøte</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const s = summary.find((s) => s.event_id === e.id);
                return (
                  <tr key={e.id}>
                    <td>
                      {e.title}
                      <small>
                        {e.status === "draft"
                          ? "Utkast"
                          : dateLabel(e.starts_at)}
                      </small>
                    </td>
                    <td>{s?.confirmed ?? 0}</td>
                    <td>{Math.max(0, e.capacity - (s?.confirmed ?? 0))}</td>
                    <td>{s?.waitlisted ?? 0}</td>
                    <td>
                      {
                        registrations.filter(
                          (r) =>
                            r.event_id === e.id &&
                            r.attended &&
                            r.status === "confirmed",
                        ).length
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="two-cols">
        <section className="panel">
          <h3>Populære forslag</h3>
          {suggestions.error ? (
            <Failure error={suggestions.error} />
          ) : (
            suggestions.data
              ?.slice()
              .sort((a, b) => b.votes - a.votes)
              .slice(0, 5)
              .map((s) => (
                <div className="account-row" key={s.id}>
                  <span>{s.title}</span>
                  <Badge>{s.votes} stemmer</Badge>
                </div>
              ))
          )}
        </section>
        <section className="panel">
          <h3>Medlemsvekst</h3>
          <p>
            {
              members.filter(
                (m) =>
                  m.status === "approved" &&
                  Date.parse(m.joined_at) >= now - 30 * 86400000,
              ).length
            }{" "}
            nåværende godkjente medlemmer søkte de siste 30 dagene.
          </p>
          <h3>Stemmedeltakelse</h3>
          <select
            aria-label="Velg avstemning for statistikk"
            value={poll}
            onChange={(e) => setPoll(e.target.value)}
          >
            <option value="">Velg avstemning</option>
            {polls.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.question}
              </option>
            ))}
          </select>
          {poll && results.isPending && <p role="status">Laster stemmer …</p>}
          {poll && results.data && (
            <p>
              {results.data?.reduce((s, r) => s + r.votes, 0) ?? 0} registrerte
              stemmer
            </p>
          )}
          {results.error && <Failure error={results.error} />}
        </section>
      </div>
      <p className="small-text">
        Tall hentes fra databasen. Gamle deltakerdata slettes etter
        lagringsfristen og inngår deretter ikke i oversikten.
      </p>
    </>
  );
}
function AdminEvents({ events }: { events: Event[] }) {
  const [edit, setEdit] = useState<Event | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const { session, role } = useAuth();
  const duplicate = useMutation({
    mutationFn: (event: Event) => {
      const { id: _id, created_at: _created, ...copy } = event;
      void _id;
      void _created;
      return request(
        db()
          .from("events")
          .insert({
            ...copy,
            title: `${event.title} (kopi)`,
            status: "draft",
            created_by: session!.user.id,
          }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      toast("Kopi lagret som utkast.");
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  return (
    <>
      <div className="section-heading">
        <h2>Arrangementer</h2>
        <button className="button primary" onClick={() => setEdit("new")}>
          <Plus size={18} />
          Nytt arrangement
        </button>
      </div>
      {events.length ? (
        events.map((e) => (
          <article className="panel admin-event-row" key={e.id}>
            <div>
              <Badge tone={e.status === "published" ? "green" : "blue"}>
                {
                  {
                    draft: "Utkast",
                    published: "Publisert",
                    cancelled: "Avlyst",
                  }[e.status]
                }
              </Badge>
              {e.is_demo && <Badge tone="pink">Demo</Badge>}
              <h3>{e.title}</h3>
              <p>
                {dateLabel(e.starts_at)} · {e.capacity} plasser
              </p>
            </div>
            <div className="button-row">
              <button className="button small" onClick={() => setEdit(e)}>
                <Edit3 size={16} />
                Rediger
              </button>
              <button
                className="icon-button"
                aria-label={`Dupliser ${e.title}`}
                disabled={duplicate.isPending}
                onClick={() => duplicate.mutate(e)}
              >
                <Copy size={17} />
              </button>
              {role === "admin" && (
                <button
                  className="button small danger"
                  onClick={() => setDeleteTarget(e)}
                >
                  <Trash2 size={16} /> Slett permanent
                </button>
              )}
            </div>
          </article>
        ))
      ) : (
        <Empty title="Opprett den første møteplassen" />
      )}
      {deleteTarget && (
        <DeleteEventDialog
          key={deleteTarget.id}
          event={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onEdit={() => {
            setEdit(deleteTarget);
            setDeleteTarget(null);
          }}
          onDeleted={() => {
            qc.setQueryData<Event[]>(["events"], (previous) =>
              previous?.filter((event) => event.id !== deleteTarget.id),
            );
            setDeleteTarget(null);
            void qc.invalidateQueries();
            toast(
              "Utkastet er slettet permanent. Arrangementsbilder er beholdt.",
            );
          }}
        />
      )}
      {edit && (
        <Modal
          title={edit === "new" ? "Nytt arrangement" : "Rediger arrangement"}
          onClose={() => setEdit(null)}
        >
          <EventEditor
            event={edit === "new" ? undefined : edit}
            onDone={() => setEdit(null)}
          />
        </Modal>
      )}
    </>
  );
}
type EventForm = {
  title: string;
  subtitle: string;
  description: string;
  starts: string;
  ends: string;
  deadline: string;
  location: string;
  map_url: string;
  category: string;
  capacity: number;
  price_nok: number;
  organizer: string;
  min_age: string;
  accessibility: string;
  external_url: string;
  status: Event["status"];
  registration_mode: Event["registration_mode"];
  max_team_size: number;
  audience: Event["audience"];
  registration_open: boolean;
  waitlist_enabled: boolean;
  is_demo: boolean;
  alcohol_approved: boolean;
  alcohol_info: string;
};
function EventEditor({
  event: e,
  onDone,
}: {
  event?: Event;
  onDone: () => void;
}) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const form = useForm<EventForm>({
    defaultValues: {
      title: e?.title ?? "",
      subtitle: e?.subtitle ?? "",
      description: e?.description ?? "",
      starts: e ? osloInput(e.starts_at) : "",
      ends: e ? osloInput(e.ends_at) : "",
      deadline: e ? osloInput(e.deadline) : "",
      location: e?.location ?? "Annonseres snart",
      map_url: e?.map_url ?? "",
      category: e?.category ?? "Sosialt",
      capacity: e?.capacity ?? 40,
      price_nok: e?.price_nok ?? 0,
      organizer: e?.organizer ?? "Pluss Minus Null Stress",
      min_age: e?.min_age?.toString() ?? "",
      accessibility: e?.accessibility ?? "Kontakt styret for tilrettelegging.",
      external_url: e?.external_url ?? "",
      status: e?.status ?? "draft",
      registration_mode: e?.registration_mode ?? "individual",
      max_team_size: e?.max_team_size ?? 6,
      audience: e?.audience ?? "everyone",
      registration_open: e?.registration_open ?? true,
      waitlist_enabled: e?.waitlist_enabled ?? true,
      is_demo: e?.is_demo ?? false,
      alcohol_approved: e?.alcohol_approved ?? false,
      alcohol_info: e?.alcohol_info ?? "",
    },
  });
  const alcoholApproved = useWatch({
    control: form.control,
    name: "alcohol_approved",
  });
  const mutation = useMutation({
    mutationFn: async (v: EventForm) => {
      const starts_at = fromOsloInput(v.starts),
        ends_at = fromOsloInput(v.ends),
        deadline = fromOsloInput(v.deadline);
      if (ends_at <= starts_at || deadline > starts_at)
        throw new Error("Slutt må være etter start, og fristen før start.");
      const image_path = file
        ? await upload(file, "event-images", session!.user.id)
        : (e?.image_path ?? null);
      const {
        starts: _s,
        ends: _e,
        deadline: _d,
        min_age: _age,
        map_url: _map,
        external_url: _external,
        ...rest
      } = v;
      void _s;
      void _e;
      void _d;
      void _age;
      void _map;
      void _external;
      const payload = {
        ...rest,
        title: v.title.trim(),
        starts_at,
        ends_at,
        deadline,
        min_age: v.min_age ? Number(v.min_age) : null,
        map_url: v.map_url || null,
        external_url: v.external_url || null,
        alcohol_info: v.alcohol_approved ? v.alcohol_info || null : null,
        image_path,
      };
      return request(
        e
          ? db().from("events").update(payload).eq("id", e.id)
          : db()
              .from("events")
              .insert({ ...payload, created_by: session!.user.id }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      toast("Arrangementet er lagret.");
      onDone();
    },
    onError: (error) => toast(errorMessage(error), true),
  });
  const text = (
    name: keyof EventForm,
    label: string,
    options: {
      required?: boolean;
      type?: string;
      max?: number;
      min?: number;
    } = {},
  ) => (
    <Field label={label}>
      <input
        type={options.type ?? "text"}
        {...form.register(name, { required: options.required })}
        maxLength={options.type ? undefined : (options.max ?? 240)}
        min={options.min}
        max={options.type === "number" ? options.max : undefined}
        required={options.required}
      />
    </Field>
  );
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
    >
      {text("title", "Tittel", { required: true, min: 3, max: 160 })}
      {text("subtitle", "Undertittel")}
      <Field label="Beskrivelse">
        <textarea
          rows={5}
          {...form.register("description")}
          maxLength={10000}
        />
      </Field>
      <div className="form-row">
        {text("starts", "Start (Europe/Oslo)", {
          type: "datetime-local",
          required: true,
        })}
        {text("ends", "Slutt (Europe/Oslo)", {
          type: "datetime-local",
          required: true,
        })}
      </div>
      {text("deadline", "Påmeldingsfrist (Europe/Oslo)", {
        type: "datetime-local",
        required: true,
      })}
      {text("location", "Sted", { required: true })}
      {text("map_url", "Kartlenke (https)", { type: "url" })}
      <div className="form-row">
        <Field label="Kategori">
          <select {...form.register("category")}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Kapasitet">
          <input
            type="number"
            min={1}
            max={10000}
            required
            {...form.register("capacity", { valueAsNumber: true })}
          />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Pris i kr">
          <input
            type="number"
            min={0}
            required
            {...form.register("price_nok", { valueAsNumber: true })}
          />
        </Field>
        {text("min_age", "Aldersgrense (valgfritt)", {
          type: "number",
          min: 0,
          max: 100,
        })}
      </div>
      {text("organizer", "Arrangør", { required: true })}
      <Field label="Tilgjengelighet">
        <textarea rows={2} {...form.register("accessibility")} />
      </Field>
      {text("external_url", "Ekstern lenke (https)", { type: "url" })}
      <Field label="Forsidebilde">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
        />
      </Field>
      <div className="form-row">
        <Field label="Påmeldingsmodus">
          <select {...form.register("registration_mode")}>
            <option value="individual">Individuell</option>
            <option value="team">Lag og individuelle</option>
          </select>
        </Field>
        <Field label="Maks lagstørrelse">
          <input
            type="number"
            min={1}
            max={30}
            {...form.register("max_team_size", { valueAsNumber: true })}
          />
        </Field>
      </div>
      <Field label="Hvem kan delta?">
        <select {...form.register("audience")}>
          <option value="everyone">Alle</option>
          <option value="members">Godkjente medlemmer</option>
          <option value="groups">
            Godkjente grupper (sett opp under Tilgangsgrupper)
          </option>
        </select>
      </Field>
      <div className="checkbox-grid">
        {[
          ["registration_open", "Påmelding åpen"],
          ["waitlist_enabled", "Venteliste aktiv"],
          ["is_demo", "Merk som demonstrasjonsinnhold"],
          ["alcohol_approved", "Styret har godkjent alkoholinformasjonen"],
        ].map(([key, label]) => (
          <label className="checkbox" key={key}>
            <input type="checkbox" {...form.register(key as keyof EventForm)} />
            {label}
          </label>
        ))}
      </div>
      {alcoholApproved && (
        <Field label="Godkjent alkoholinformasjon">
          <textarea {...form.register("alcohol_info")} />
        </Field>
      )}
      <Field label="Publiseringsstatus">
        <select {...form.register("status")}>
          <option value="draft">Utkast / avpublisert</option>
          <option value="published">Publisert</option>
          <option value="cancelled">Avlyst</option>
        </select>
      </Field>
      <p className="small-text">
        Endringer i viktige detaljer varsles til påmeldte. Økt kapasitet fyller
        opp fra ventelisten. Publiser først når styret har bekreftet
        informasjonen.
      </p>
      <Submit pending={mutation.isPending}>Lagre arrangement</Submit>
    </form>
  );
}
function Participants({
  events,
  registrations,
  profiles,
}: {
  events: Event[];
  registrations: Registration[];
  profiles: Profile[];
}) {
  const [eventId, setEventId] = useState("");
  const [cancel, setCancel] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const action = useAction();
  const toast = useToast();
  const teams = useQuery({
    queryKey: ["teams", eventId],
    queryFn: () => rpc<Team[]>("list_teams", { p_event: eventId }),
    enabled: !!eventId,
  });
  const rows = registrations.filter((r) => r.event_id === eventId);
  const event = events.find((e) => e.id === eventId);
  function exportCsv() {
    const header = ["Navn", "Status", "Lag", "Kosthensyn", "Oppmøte"];
    download(
      "deltakere.csv",
      "\uFEFF" +
        [
          header,
          ...rows.map((r) => [
            profiles.find((p) => p.id === r.user_id)?.display_name ?? "",
            r.status,
            teams.data?.find((t) => t.id === r.team_id)?.name ?? "",
            r.dietary ?? "",
            r.attended ? "Ja" : "Nei",
          ]),
        ]
          .map((row) => row.map(csvCell).join(";"))
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
    toast(
      "CSV lastet ned. Behandle deltakerlisten fortrolig og slett den etter bruk.",
    );
  }
  return (
    <>
      <h2>Påmeldinger, lag og venteliste</h2>
      <Field label="Velg arrangement">
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">Velg et arrangement</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </Field>
      {eventId && (
        <>
          <div className="toolbar">
            <p>
              {rows.filter((r) => r.status === "confirmed").length} bekreftet ·{" "}
              {rows.filter((r) => r.status === "waitlisted").length} på
              venteliste
            </p>
            <button className="button small" onClick={exportCsv}>
              <Download size={16} />
              Eksporter CSV
            </button>
          </div>
          <div
            className="table-wrap"
            role="region"
            aria-label="Påmeldinger og lag"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Lag</th>
                  <th>Kosthensyn</th>
                  <th>Oppmøte</th>
                  <th>Handling</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {profiles.find((p) => p.id === r.user_id)?.display_name ??
                        "Student"}
                    </td>
                    <td>
                      {
                        {
                          confirmed: "Bekreftet",
                          waitlisted: "Venteliste",
                          cancelled: "Avbestilt",
                        }[r.status]
                      }
                    </td>
                    <td>
                      {event?.registration_mode === "team" &&
                      r.status !== "cancelled" ? (
                        <select
                          aria-label={`Lag for ${profiles.find((p) => p.id === r.user_id)?.display_name}`}
                          value={r.team_id ?? ""}
                          disabled={action.isPending}
                          onChange={(e) =>
                            action.mutate({
                              name: "assign_team",
                              args: {
                                p_registration: r.id,
                                p_team: e.target.value || null,
                              },
                            })
                          }
                        >
                          <option value="">Uten lag</option>
                          {teams.data?.map((t) => (
                            <option value={t.id} key={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{r.dietary || "—"}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Oppmøte for ${profiles.find((p) => p.id === r.user_id)?.display_name}`}
                        checked={r.attended}
                        disabled={r.status !== "confirmed" || action.isPending}
                        onChange={(e) =>
                          action.mutate({
                            name: "mark_attendance",
                            args: {
                              p_registration: r.id,
                              p_attended: e.target.checked,
                            },
                          })
                        }
                      />
                    </td>
                    <td>
                      {r.status !== "cancelled" && (
                        <button
                          className="text-button danger-text"
                          onClick={() => setCancel(r.user_id)}
                        >
                          Avbestill
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {teams.error && <Failure error={teams.error} />}
          <section className="panel">
            <h3>Send oppdatering til påmeldte</h3>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                action.mutate({
                  name: "send_event_announcement",
                  args: { p_event: eventId, p_body: body },
                });
              }}
            >
              <Field label="Melding">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  minLength={5}
                  maxLength={3000}
                />
              </Field>
              <Submit pending={action.isPending}>Send varsel</Submit>
            </form>
          </section>
          <p className="small-text">
            Ventelisten sorteres etter påmeldingstid. Ved ledig kapasitet
            flyttes neste kvalifiserte person automatisk opp før
            påmeldingsfristen.
          </p>
        </>
      )}
      {cancel && (
        <Confirm
          title="Avbestille for studenten?"
          pending={action.isPending}
          onClose={() => setCancel(null)}
          onConfirm={() => {
            action.mutate(
              {
                name: "cancel_registration",
                args: { p_event: eventId, p_user: cancel },
              },
              { onSuccess: () => setCancel(null) },
            );
          }}
        >
          Dette frigir plassen og kan flytte en person opp fra ventelisten.
        </Confirm>
      )}
    </>
  );
}
function Moderation() {
  const suggestions = useQuery({
    queryKey: ["admin-suggestions"],
    queryFn: () =>
      request<
        {
          id: string;
          title: string;
          description: string;
          status: string;
          hidden: boolean;
          author_id: string | null;
        }[]
      >(
        db()
          .from("suggestions")
          .select("*")
          .order("created_at", { ascending: false }),
      ),
  });
  const action = useAction();
  return (
    <>
      <h2>Forslag til vurdering</h2>
      {suggestions.error ? (
        <Failure error={suggestions.error} />
      ) : suggestions.data?.length ? (
        suggestions.data.map((s) => (
          <article className="panel" key={s.id}>
            <h3>{s.title}</h3>
            <p>{s.description}</p>
            <small>Intern avsender-ID: {s.author_id ?? "Slettet konto"}</small>
            <div className="form-row">
              <Field label="Status">
                <select
                  value={s.status}
                  disabled={action.isPending}
                  onChange={(e) =>
                    action.mutate({
                      name: "moderate_suggestion",
                      args: {
                        p_id: s.id,
                        p_status: e.target.value,
                        p_hidden: s.hidden,
                      },
                    })
                  }
                >
                  {Object.entries(suggestionStatuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={s.hidden}
                  disabled={action.isPending}
                  onChange={(e) =>
                    action.mutate({
                      name: "moderate_suggestion",
                      args: {
                        p_id: s.id,
                        p_status: s.status,
                        p_hidden: e.target.checked,
                      },
                    })
                  }
                />
                Skjul offentlig
              </label>
            </div>
          </article>
        ))
      ) : (
        <Empty title="Ingen forslag til vurdering" />
      )}
    </>
  );
}
function AdminPolls() {
  const now = useNow();
  const [updatedAt, setUpdatedAt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [period, setPeriod] = useState<Poll | null>(null);
  const polls = useQuery({ queryKey: ["polls"], queryFn: api.polls });
  const qc = useQueryClient();
  const toast = useToast();
  const form = useForm<{
    question: string;
    opens: string;
    closes: string;
    options: string;
    hide: boolean;
    audience: string;
  }>({ defaultValues: { hide: true, audience: "everyone" } });
  const create = useMutation({
    mutationFn: (v: {
      question: string;
      opens: string;
      closes: string;
      options: string;
      hide: boolean;
      audience: string;
    }) =>
      rpc("create_poll", {
        p_question: v.question,
        p_opens: fromOsloInput(v.opens),
        p_closes: fromOsloInput(v.closes),
        p_options: v.options
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        p_hide: v.hide,
        p_audience: v.audience,
      }),
    onSuccess: () => {
      void qc.invalidateQueries();
      setCreating(false);
      form.reset();
      toast("Avstemningen er opprettet.");
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  const update = useMutation({
    mutationFn: ({ id, ...patch }: Partial<Poll> & { id: string }) =>
      request(db().from("polls").update(patch).eq("id", id)),
    onSuccess: () => {
      setPeriod(null);
      setUpdatedAt(Date.now());
      void qc.invalidateQueries();
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  return (
    <>
      <div className="section-heading">
        <h2>Avstemninger</h2>
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus size={17} />
          Ny avstemning
        </button>
      </div>
      {polls.error && <Failure error={polls.error} />}
      {polls.data?.map((p) => (
        <article className="panel" key={p.id}>
          <h3>{p.question}</h3>
          <p>
            {dateLabel(p.opens_at)} – {dateLabel(p.closes_at)}
          </p>
          <div className="button-row">
            <button
              className="button small"
              disabled={update.isPending}
              onClick={() => setPeriod(p)}
            >
              Endre stemmeperiode
            </button>
            <button
              className="button small"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ id: p.id, published: !p.published })
              }
            >
              {p.published ? "Avpubliser" : "Publiser"}
            </button>
            {Date.parse(p.closes_at) > Math.max(now, updatedAt) &&
              Date.parse(p.opens_at) < now && (
                <button
                  className="button small"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      id: p.id,
                      closes_at: new Date().toISOString(),
                    })
                  }
                >
                  Avslutt nå
                </button>
              )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={p.hide_results}
                disabled={update.isPending}
                onChange={(e) =>
                  update.mutate({ id: p.id, hide_results: e.target.checked })
                }
              />
              Skjul resultater til slutt
            </label>
          </div>
        </article>
      ))}
      {period && (
        <Modal title="Endre stemmeperiode" onClose={() => setPeriod(null)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              try {
                const opens_at = fromOsloInput(String(values.get("opens")));
                const closes_at = fromOsloInput(String(values.get("closes")));
                if (closes_at <= opens_at)
                  throw new Error("Stengetiden må være etter åpningstiden.");
                update.mutate({ id: period.id, opens_at, closes_at });
              } catch (error) {
                toast(errorMessage(error), true);
              }
            }}
          >
            <p>{period.question}</p>
            <Field label="Åpner (Europe/Oslo)">
              <input
                name="opens"
                type="datetime-local"
                required
                defaultValue={osloInput(period.opens_at)}
              />
            </Field>
            <Field label="Stenger (Europe/Oslo)">
              <input
                name="closes"
                type="datetime-local"
                required
                defaultValue={osloInput(period.closes_at)}
              />
            </Field>
            <Submit pending={update.isPending}>Lagre stemmeperiode</Submit>
          </form>
        </Modal>
      )}
      {creating && (
        <Modal title="Ny torsdagsavstemning" onClose={() => setCreating(false)}>
          <form
            className="form-stack"
            onSubmit={form.handleSubmit((v) => create.mutate(v))}
          >
            <Field label="Spørsmål">
              <input
                {...form.register("question")}
                required
                minLength={5}
                maxLength={200}
              />
            </Field>
            <Field label="Åpner (Europe/Oslo)">
              <input
                type="datetime-local"
                required
                {...form.register("opens")}
              />
            </Field>
            <Field label="Stenger (Europe/Oslo)">
              <input
                type="datetime-local"
                required
                {...form.register("closes")}
              />
            </Field>
            <Field label="Alternativer, ett per linje (2–12)">
              <textarea rows={5} required {...form.register("options")} />
            </Field>
            <Field label="Hvem kan stemme?">
              <select {...form.register("audience")}>
                <option value="everyone">Alle kontoer</option>
                <option value="members">Godkjente medlemmer</option>
              </select>
            </Field>
            <label className="checkbox">
              <input type="checkbox" {...form.register("hide")} />
              Skjul resultater til slutt
            </label>
            <Submit pending={create.isPending}>Opprett avstemning</Submit>
          </form>
        </Modal>
      )}
    </>
  );
}
function Members({
  profiles,
  members,
  admin,
}: {
  profiles: Profile[];
  members: Membership[];
  admin: boolean;
}) {
  const action = useAction();
  const roles = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () =>
      tableRows<{ user_id: string; role: string }>("user_roles", {
        order: ["user_id"],
      }),
    enabled: admin,
  });
  return (
    <>
      <h2>Medlemmer og kontoroller</h2>
      <div
        className="table-wrap"
        role="region"
        aria-label="Medlemmer og kontoroller"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Studium</th>
              <th>Medlemskap</th>
              {admin && <th>Kontorolle</th>}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const member = members.find((m) => m.user_id === p.id);
              return (
                <tr key={p.id}>
                  <td>{p.display_name}</td>
                  <td>{p.study_programme || "—"}</td>
                  <td>
                    {member ? (
                      <select
                        aria-label={`Medlemsstatus for ${p.display_name}`}
                        value={member.status}
                        disabled={action.isPending}
                        onChange={(e) =>
                          action.mutate({
                            name: "manage_member",
                            args: { p_user: p.id, p_status: e.target.value },
                          })
                        }
                      >
                        {Object.entries({
                          pending: "Venter",
                          approved: "Godkjent",
                          rejected: "Avslått",
                          inactive: "Inaktiv",
                        }).map(([k, v]) => (
                          <option value={k} key={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      "Ingen søknad"
                    )}
                  </td>
                  {admin && (
                    <td>
                      <select
                        aria-label={`Rolle for ${p.display_name}`}
                        value={
                          roles.data?.find((r) => r.user_id === p.id)?.role ??
                          "student"
                        }
                        disabled={action.isPending}
                        onChange={(e) =>
                          action.mutate({
                            name: "set_role",
                            args: { p_user: p.id, p_role: e.target.value },
                          })
                        }
                      >
                        <option value="student">Student</option>
                        <option value="board">Styremedlem</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {roles.error && <Failure error={roles.error} />}
      <p className="small-text">
        Bare administrator kan endre andres kontoroller. Medlemskap gir ikke
        administratorrettigheter.
      </p>
    </>
  );
}
function Content() {
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const news = useQuery({
    queryKey: ["announcements"],
    queryFn: api.announcements,
  });
  const [edit, setEdit] = useState<Announcement | "new" | null>(null);
  return (
    <>
      <h2>Foreningsinformasjon</h2>
      {settings.error ? (
        <Failure error={settings.error} />
      ) : (
        settings.data && <SettingsForm settings={settings.data} />
      )}
      <div className="section-heading">
        <h2>Nyheter og kunngjøringer</h2>
        <button className="button primary" onClick={() => setEdit("new")}>
          Ny kunngjøring
        </button>
      </div>
      {news.error && <Failure error={news.error} />}
      {news.data?.map((n) => (
        <div className="panel" key={n.id}>
          <Badge>{n.published ? "Publisert" : "Utkast"}</Badge>
          <h3>{n.title}</h3>
          <p>{n.body}</p>
          <button className="button small" onClick={() => setEdit(n)}>
            Rediger
          </button>
        </div>
      ))}
      {edit && (
        <Modal title="Kunngjøring" onClose={() => setEdit(null)}>
          <AnnouncementEditor
            announcement={edit === "new" ? undefined : edit}
            onDone={() => setEdit(null)}
          />
        </Modal>
      )}
    </>
  );
}
function SettingsForm({ settings }: { settings: Settings }) {
  const form = useForm<Settings>({ defaultValues: settings });
  const qc = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (v: Settings) =>
      request(db().from("site_settings").update(v).eq("id", true)),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast("Foreningsinformasjonen er lagret.");
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  return (
    <form
      className="form-stack panel"
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
    >
      <Field label="Om foreningen">
        <textarea
          rows={4}
          {...form.register("about")}
          required
          maxLength={10000}
        />
      </Field>
      <Field label="Kontaktadresse">
        <input type="email" {...form.register("contact_email")} />
      </Field>
      <Field label="Instagram (https)">
        <input type="url" {...form.register("instagram_url")} />
      </Field>
      <Field label="Facebook (https)">
        <input type="url" {...form.register("facebook_url")} />
      </Field>
      <label className="checkbox">
        <input type="checkbox" {...form.register("membership_approval")} />
        Medlemskap krever styregodkjenning
      </label>
      <Submit pending={mutation.isPending}>Lagre informasjon</Submit>
    </form>
  );
}
function AnnouncementEditor({
  announcement: a,
  onDone,
}: {
  announcement?: Announcement;
  onDone: () => void;
}) {
  const form = useForm<{
    title: string;
    body: string;
    published: boolean;
    is_demo: boolean;
  }>({
    defaultValues: {
      title: a?.title ?? "",
      body: a?.body ?? "",
      published: a?.published ?? false,
      is_demo: a?.is_demo ?? false,
    },
  });
  const qc = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (v: {
      title: string;
      body: string;
      published: boolean;
      is_demo: boolean;
    }) =>
      request(
        a
          ? db().from("announcements").update(v).eq("id", a.id)
          : db().from("announcements").insert(v),
      ),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast("Kunngjøringen er lagret.");
      onDone();
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
    >
      <Field label="Tittel">
        <input
          {...form.register("title")}
          minLength={3}
          maxLength={160}
          required
        />
      </Field>
      <Field label="Tekst">
        <textarea
          {...form.register("body")}
          rows={6}
          required
          maxLength={5000}
        />
      </Field>
      <label className="checkbox">
        <input type="checkbox" {...form.register("published")} />
        Publisert
      </label>
      <label className="checkbox">
        <input type="checkbox" {...form.register("is_demo")} />
        Demoinnhold
      </label>
      <Submit pending={mutation.isPending}>Lagre kunngjøring</Submit>
    </form>
  );
}
function Groups({
  profiles,
  events,
}: {
  profiles: Profile[];
  events: Event[];
}) {
  const [name, setName] = useState("");
  const [user, setUser] = useState("");
  const [event, setEvent] = useState("");
  const [remove, setRemove] = useState(false);
  const action = useAction();
  const groups = useQuery({
    queryKey: ["admin-groups"],
    queryFn: async () => ({
      groups: await tableRows<{ id: string; name: string }>("access_groups"),
      members: await tableRows<{ group_id: string; user_id: string }>(
        "group_members",
        { order: ["group_id", "user_id"] },
      ),
      events: await tableRows<{ group_id: string; event_id: string }>(
        "event_access_groups",
        { order: ["group_id", "event_id"] },
      ),
    }),
  });
  return (
    <>
      <h2>Tilgangsgrupper</h2>
      <p>
        Knytt kontoer og arrangementer til en navngitt gruppe. Velg «Godkjente
        grupper» i arrangementets innstillinger.
      </p>
      <form
        className="panel form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          action.mutate({
            name: "manage_group",
            args: {
              p_name: name,
              p_user: user || null,
              p_event: event || null,
              p_remove: remove,
            },
          });
        }}
      >
        <Field label="Gruppenavn">
          <input
            required
            minLength={1}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            list="groups"
          />
          <datalist id="groups">
            {groups.data?.groups.map((g) => (
              <option key={g.id}>{g.name}</option>
            ))}
          </datalist>
        </Field>
        <Field label="Konto (valgfritt)">
          <select value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">Ingen konto</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Arrangement (valgfritt)">
          <select value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">Ingen arrangement</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={remove}
            onChange={(e) => setRemove(e.target.checked)}
          />
          Fjern valgte tilknytninger
        </label>
        <Submit pending={action.isPending}>Lagre tilgangsgruppe</Submit>
      </form>
      {groups.error && <Failure error={groups.error} />}
      {groups.data?.groups.map((g) => (
        <article className="panel" key={g.id}>
          <h3>{g.name}</h3>
          <p>
            {groups.data.members
              .filter((m) => m.group_id === g.id)
              .map(
                (m) => profiles.find((p) => p.id === m.user_id)?.display_name,
              )
              .join(", ") || "Ingen kontoer"}
          </p>
          <p>
            {groups.data.events
              .filter((e) => e.group_id === g.id)
              .map((e) => events.find((ev) => ev.id === e.event_id)?.title)
              .join(", ") || "Ingen arrangementer"}
          </p>
        </article>
      ))}
    </>
  );
}
function Contacts({ profiles }: { profiles: Profile[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const messages = useQuery({
    queryKey: ["admin-contact"],
    queryFn: () =>
      request<
        {
          id: string;
          user_id: string;
          subject: string;
          message: string;
          resolved: boolean;
          created_at: string;
        }[]
      >(
        db()
          .from("contact_submissions")
          .select("*")
          .order("created_at", { ascending: false }),
      ),
  });
  const resolve = useMutation({
    mutationFn: (id: string) =>
      request(
        db()
          .from("contact_submissions")
          .update({ resolved: true })
          .eq("id", id),
      ),
    onSuccess: () => void qc.invalidateQueries(),
    onError: (e) => toast(errorMessage(e), true),
  });
  return (
    <>
      <h2>Kontaktmeldinger</h2>
      {messages.error ? (
        <Failure error={messages.error} />
      ) : messages.data?.length ? (
        messages.data.map((m) => (
          <article className="panel" key={m.id}>
            <Badge>{m.resolved ? "Behandlet" : "Ny melding"}</Badge>
            <h3>{m.subject}</h3>
            <p className="pre-line">{m.message}</p>
            <p className="small-text">
              {profiles.find((p) => p.id === m.user_id)?.display_name ??
                "Slettet bruker"}{" "}
              · {dateLabel(m.created_at)}
            </p>
            {!m.resolved && (
              <button
                className="button small"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate(m.id)}
              >
                Marker behandlet
              </button>
            )}
          </article>
        ))
      ) : (
        <Empty title="Ingen kontaktmeldinger" />
      )}
    </>
  );
}
function Audit() {
  const logs = useQuery({
    queryKey: ["audit"],
    queryFn: () =>
      request<
        {
          id: number;
          action: string;
          entity: string;
          entity_id: string;
          created_at: string;
        }[]
      >(
        db()
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ),
  });
  return (
    <>
      <h2>Siste 100 endringer</h2>
      {logs.error ? (
        <Failure error={logs.error} />
      ) : (
        <div
          className="table-wrap"
          role="region"
          aria-label="Endringslogg"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Handling</th>
                <th>Tabell</th>
                <th>Tid</th>
              </tr>
            </thead>
            <tbody>
              {logs.data?.map((l) => (
                <tr key={l.id}>
                  <td>{l.action}</td>
                  <td>{l.entity}</td>
                  <td>
                    {dateLabel(l.created_at)}{" "}
                    {new Date(l.created_at).toLocaleTimeString("nb", {
                      timeZone: "Europe/Oslo",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
