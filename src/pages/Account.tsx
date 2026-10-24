import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Download, LogOut, Trash2, UserRound } from "lucide-react";
import { api, db, imageUrl, request, rpc, upload } from "../lib/api";
import { useAuth } from "../lib/auth";
import type {
  Membership,
  Notification,
  Profile,
  Registration,
  Suggestion,
} from "../lib/types";
import { dateLabel, download, errorMessage } from "../lib/utils";
import { profileSchema } from "../lib/schemas";
import type { ProfileInput } from "../lib/schemas";
import {
  Badge,
  Confirm,
  Empty,
  Failure,
  Field,
  Loading,
  Submit,
  useToast,
} from "../components/ui";
export default function Account() {
  const { session, loading, role } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [cancel, setCancel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const id = session?.user.id;
  const profile = useQuery({
    queryKey: ["profile", id],
    queryFn: () =>
      request<Profile>(
        db().from("profiles").select("*").eq("id", id!).single(),
      ),
    enabled: !!id,
  });
  const registrations = useQuery({
    queryKey: ["my-registrations", id],
    queryFn: () =>
      request<Registration[]>(
        db()
          .from("event_registrations")
          .select("*")
          .eq("user_id", id!)
          .order("created_at", { ascending: false }),
      ),
    enabled: !!id,
  });
  const membership = useQuery({
    queryKey: ["membership", id],
    queryFn: () =>
      request<Membership | null>(
        db().from("memberships").select("*").eq("user_id", id!).maybeSingle(),
      ),
    enabled: !!id,
  });
  const notifications = useQuery({
    queryKey: ["notifications", id],
    queryFn: () =>
      request<Notification[]>(
        db()
          .from("notifications")
          .select("*")
          .eq("user_id", id!)
          .order("created_at", { ascending: false })
          .limit(100),
      ),
    enabled: !!id,
  });
  const suggestions = useQuery({
    queryKey: ["my-suggestions", id],
    queryFn: () =>
      request<{ id: string; title: string; status: Suggestion["status"] }[]>(
        db().from("suggestions").select("id,title,status").eq("author_id", id!),
      ),
    enabled: !!id,
  });
  const votes = useQuery({
    queryKey: ["my-votes", id],
    queryFn: async () => ({
      suggestions: await request<{ suggestion_id: string }[]>(
        db()
          .from("suggestion_votes")
          .select("suggestion_id")
          .eq("user_id", id!),
      ),
      polls: await request<{ poll_id: string; option_id: string }[]>(
        db().from("poll_votes").select("poll_id,option_id").eq("user_id", id!),
      ),
    }),
    enabled: !!id,
  });
  const feed = useQuery({
    queryKey: ["suggestions"],
    queryFn: api.suggestions,
  });
  const polls = useQuery({ queryKey: ["polls"], queryFn: api.polls });
  const options = useQuery({
    queryKey: ["poll-options"],
    queryFn: api.options,
  });
  const events = useQuery({ queryKey: ["events"], queryFn: api.events });
  const action = useMutation({
    mutationFn: async ({
      name,
      args,
    }: {
      name: string;
      args?: Record<string, unknown>;
    }) => rpc(name, args),
    onSuccess: () => {
      void qc.invalidateQueries();
      setCancel(null);
      toast("Endringen er lagret.");
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  const exportData = useMutation({
    mutationFn: () => rpc<unknown>("export_my_data"),
    onSuccess: (data) => {
      download("mine-personopplysninger.json", JSON.stringify(data, null, 2));
      toast("Dataeksporten er lastet ned.");
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  const deleteAccount = useMutation({
    mutationFn: async () => {
      const { data, error } = await db().functions.invoke("account-delete", {
        body: { confirmation: "SLETT" },
      });
      if (error || data?.deleted !== true)
        throw new Error(
          "Kontoen ble ikke slettet. Logg inn på nytt og prøv igjen.",
        );
      await db().auth.signOut({ scope: "local" });
    },
    onSuccess: () => {
      qc.clear();
      setDeleting(false);
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await db().auth.signOut();
      if (error)
        throw new Error(
          "Utloggingen kunne ikke bekreftes for alle økter. Prøv igjen dersom du fortsatt er innlogget.",
        );
    },
    onSuccess: () => qc.clear(),
    onError: (error) => toast(errorMessage(error), true),
  });
  if (loading)
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  if (!session) return <Navigate to="/logg-inn?retur=%2Fmin-side" replace />;
  return (
    <div className="container page">
      <div className="page-heading">
        <div className="eyebrow">DIN LILLE DEL AV FELLESSKAPET</div>
        <h1>
          Hei, {profile.data?.display_name ?? "student"}
          <span className="pink-dot">!</span>
        </h1>
        <p>Påmeldinger, medlemskap og ideer. Samlet på ett sted.</p>
      </div>
      <div className="account-grid">
        <div>
          <section className="panel">
            <h2>Mine påmeldinger</h2>
            {registrations.error ? (
              <Failure error={registrations.error} />
            ) : registrations.isPending ? (
              <Loading />
            ) : !registrations.data.length ? (
              <Empty title="Du har ingen påmeldinger ennå">
                <Link to="/arrangementer">Finn et arrangement →</Link>
              </Empty>
            ) : (
              registrations.data.map((r) => {
                const e = events.data?.find((e) => e.id === r.event_id);
                return (
                  <div className="account-row" key={r.id}>
                    <div>
                      <Link to={`/arrangementer/${r.event_id}`}>
                        <strong>{e?.title ?? "Arrangement"}</strong>
                      </Link>
                      <p>{e ? dateLabel(e.starts_at) : ""}</p>
                      <Badge tone={r.status === "confirmed" ? "green" : "blue"}>
                        {r.status === "confirmed"
                          ? "Bekreftet"
                          : r.status === "waitlisted"
                            ? "Venteliste"
                            : "Avbestilt"}
                      </Badge>
                      {e?.status === "cancelled" && (
                        <Badge tone="pink">Arrangement avlyst</Badge>
                      )}
                    </div>
                    {r.status !== "cancelled" && (
                      <button
                        className="text-button"
                        onClick={() => setCancel(r.event_id)}
                      >
                        Avbestill
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </section>
          <section className="panel">
            <h2>
              <Bell size={22} />
              Varsler
            </h2>
            <p className="small-text">
              Bekreftelser vises her. E-post krever konfigurert og testet
              e-postleverandør.
            </p>
            {notifications.error ? (
              <Failure error={notifications.error} />
            ) : notifications.data?.length ? (
              notifications.data.map((n) => (
                <article
                  className={`notification ${n.read_at ? "read" : ""}`}
                  key={n.id}
                >
                  <h3>{n.subject}</h3>
                  <p>{n.body}</p>
                  <small>{dateLabel(n.created_at)}</small>
                  {!n.read_at && (
                    <button
                      className="text-button"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          name: "read_notification",
                          args: { p_id: n.id },
                        })
                      }
                    >
                      Marker som lest
                    </button>
                  )}
                </article>
              ))
            ) : (
              <Empty title="Ingen varsler ennå" />
            )}
          </section>
          <section className="panel">
            <h2>Mine ideer og stemmer</h2>
            {suggestions.error ? (
              <Failure error={suggestions.error} />
            ) : suggestions.data?.length ? (
              suggestions.data.map((s) => (
                <p key={s.id}>
                  <Link to="/torsdagsbanken">{s.title}</Link>
                </p>
              ))
            ) : (
              <p>Du har ikke sendt inn noen forslag ennå.</p>
            )}
            {votes.error ? (
              <Failure error={votes.error} />
            ) : (
              <>
                <h3>Forslag jeg støtter</h3>
                {votes.data?.suggestions.length ? (
                  votes.data.suggestions.map((v) => (
                    <p key={v.suggestion_id}>
                      {feed.data?.find((s) => s.id === v.suggestion_id)
                        ?.title ?? "Forslag som ikke lenger er offentlig"}
                    </p>
                  ))
                ) : (
                  <p>Ingen stemmer på forslag.</p>
                )}
                <h3>Mine avstemninger</h3>
                {votes.data?.polls.length ? (
                  votes.data.polls.map((v) => (
                    <p key={v.poll_id}>
                      {polls.data?.find((p) => p.id === v.poll_id)?.question ??
                        "Avstemning"}
                      :{" "}
                      {options.data?.find((o) => o.id === v.option_id)?.label ??
                        "Registrert stemme"}
                    </p>
                  ))
                ) : (
                  <p>Du har ikke stemt i noen avstemninger.</p>
                )}
              </>
            )}
            <Link to="/torsdagsbanken" className="text-button">
              Til Torsdagsbanken →
            </Link>
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>
              <UserRound size={22} />
              Profil
            </h2>
            <p className="small-text">{session.user.email}</p>
            {profile.error ? (
              <Failure error={profile.error} />
            ) : profile.data ? (
              <ProfileForm profile={profile.data} />
            ) : (
              <Loading />
            )}
          </section>
          <section className="panel">
            <h2>Medlemskap</h2>
            <p>Medlemskap er frivillig og separat fra arrangementspåmelding.</p>
            {membership.error ? (
              <Failure error={membership.error} />
            ) : membership.isPending ? (
              <p>Laster …</p>
            ) : (
              <>
                <Badge>
                  {membership.data
                    ? {
                        pending: "Venter på godkjenning",
                        approved: "Godkjent medlem",
                        rejected: "Søknad avslått",
                        inactive: "Inaktivt medlemskap",
                      }[membership.data.status]
                    : "Ikke medlem"}
                </Badge>
                {membership.data && (
                  <p className="small-text">
                    Søknadsdato: {dateLabel(membership.data.joined_at)}
                  </p>
                )}
                {!membership.data ||
                ["rejected", "inactive"].includes(membership.data.status) ? (
                  <button
                    className="button primary"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ name: "apply_membership" })}
                  >
                    Søk medlemskap
                  </button>
                ) : null}
              </>
            )}
          </section>
          <Preferences userId={id!} />
          <section className="panel">
            <h2>Dine data</h2>
            <button
              className="button full"
              disabled={exportData.isPending}
              onClick={() => exportData.mutate()}
            >
              <Download size={17} />
              Last ned personopplysninger
            </button>
            <p className="small-text">
              Eksporten inneholder dine egne påmeldinger, forslag, stemmer og
              profilopplysninger.
            </p>
            <button
              className="text-button danger-text"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={16} />
              Slett kontoen min
            </button>
            <hr />
            <button
              className="text-button"
              disabled={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              <LogOut size={17} />
              Logg ut
            </button>
            {signOut.error && (
              <div className="error" role="alert">
                {errorMessage(signOut.error)}
              </div>
            )}
            {role !== "student" && (
              <Link className="button full" to="/admin">
                Åpne styreportalen
              </Link>
            )}
          </section>
        </aside>
      </div>
      {cancel && (
        <Confirm
          title="Avbestille påmeldingen?"
          pending={action.isPending}
          onClose={() => setCancel(null)}
          onConfirm={() =>
            action.mutate({
              name: "cancel_registration",
              args: { p_event: cancel },
            })
          }
        >
          Plassen din frigis. Den første kvalifiserte studenten på ventelisten
          får tilbudet automatisk.
        </Confirm>
      )}
      {deleting && (
        <Confirm
          title="Slette kontoen permanent?"
          pending={deleteAccount.isPending}
          onClose={() => setDeleting(false)}
          onConfirm={() => deleteAccount.mutate()}
        >
          Profilen, påmeldingene og stemmene dine slettes. Forslag du har sendt
          inn anonymiseres. Du må ha logget inn de siste 15 minuttene.
          Slettingen kan ikke angres.
        </Confirm>
      )}
    </div>
  );
}
function ProfileForm({ profile }: { profile: Profile }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile.display_name,
      study_programme: profile.study_programme ?? "",
      study_year: profile.study_year?.toString() ?? "",
    },
  });
  const mutation = useMutation({
    mutationFn: async (v: ProfileInput) => {
      const avatar = file
        ? await upload(file, "avatars", profile.id)
        : profile.avatar_path;
      return request(
        db()
          .from("profiles")
          .update({
            display_name: v.display_name,
            study_programme: v.study_programme || null,
            study_year: v.study_year ? Number(v.study_year) : null,
            avatar_path: avatar,
          })
          .eq("id", profile.id),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast("Profilen er oppdatert.");
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
    >
      {profile.avatar_path && (
        <img
          className="avatar"
          src={imageUrl(profile.avatar_path, "avatars")}
          alt="Ditt profilbilde"
        />
      )}
      <Field
        label="Visningsnavn"
        error={form.formState.errors.display_name?.message}
      >
        <input autoComplete="nickname" {...form.register("display_name")} />
      </Field>
      <Field
        label="Studieprogram (valgfritt)"
        error={form.formState.errors.study_programme?.message}
      >
        <input {...form.register("study_programme")} />
      </Field>
      <Field
        label="Studieår (valgfritt)"
        error={form.formState.errors.study_year?.message}
      >
        <input inputMode="numeric" {...form.register("study_year")} />
      </Field>
      <Field label="Profilbilde (valgfritt)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Submit pending={mutation.isPending}>Lagre profil</Submit>
    </form>
  );
}
function Preferences({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const prefs = useQuery({
    queryKey: ["preferences", userId],
    queryFn: () =>
      request<{ email_events: boolean; email_announcements: boolean }>(
        db()
          .from("notification_preferences")
          .select("email_events,email_announcements")
          .eq("user_id", userId)
          .single(),
      ),
  });
  const mutation = useMutation({
    mutationFn: (patch: Record<string, boolean>) =>
      request(
        db()
          .from("notification_preferences")
          .update(patch)
          .eq("user_id", userId),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["preferences"] }),
    onError: (e) => toast(errorMessage(e), true),
  });
  return (
    <section className="panel">
      <h2>Varslingsvalg</h2>
      {prefs.error ? (
        <Failure error={prefs.error} />
      ) : prefs.data ? (
        <div className="form-stack">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={prefs.data.email_events}
              disabled={mutation.isPending}
              onChange={(e) =>
                mutation.mutate({ email_events: e.target.checked })
              }
            />
            E-post om mine arrangementer
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={prefs.data.email_announcements}
              disabled={mutation.isPending}
              onChange={(e) =>
                mutation.mutate({ email_announcements: e.target.checked })
              }
            />
            Valgfrie kunngjøringer på e-post
          </label>
        </div>
      ) : (
        <p>Laster …</p>
      )}
    </section>
  );
}
