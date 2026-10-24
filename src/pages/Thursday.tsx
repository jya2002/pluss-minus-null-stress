import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowUp,
  Plus,
  Sparkles,
  CalendarDays,
  Check,
  LockKeyhole,
} from "lucide-react";
import { api, db, demo, imageUrl, request, rpc, upload } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNow } from "../lib/clock";
import { categories, suggestionStatuses } from "../lib/types";
import type { Poll, PollOption, Suggestion } from "../lib/types";
import { suggestionSchema } from "../lib/schemas";
import type { SuggestionInput } from "../lib/schemas";
import { dateLabel, errorMessage } from "../lib/utils";
import {
  Badge,
  Empty,
  Failure,
  Field,
  Loading,
  Modal,
  Submit,
  useToast,
} from "../components/ui";
export default function Thursday() {
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("popular");
  const { session } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const suggestions = useQuery({
    queryKey: ["suggestions"],
    queryFn: api.suggestions,
  });
  const polls = useQuery({ queryKey: ["polls"], queryFn: api.polls });
  const options = useQuery({
    queryKey: ["poll-options"],
    queryFn: api.options,
  });
  const mutation = useMutation({
    mutationFn: ({ id, vote }: { id: string; vote: boolean }) =>
      rpc("vote_suggestion", { p_suggestion: id, p_vote: vote }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["suggestions"] }),
    onError: (e) => toast(errorMessage(e), true),
  });
  const filtered = suggestions.data
    ?.filter(
      (s) =>
        (!category || s.category === category) &&
        (!status || s.status === status),
    )
    .sort((a, b) =>
      sort === "popular"
        ? b.votes - a.votes
        : Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  return (
    <div className="container page">
      <div className="page-heading thursday-heading">
        <div>
          <div className="eyebrow">SAMMEN FINNER VI PÅ NOE</div>
          <h1>
            Torsdagsbanken<span className="pink-dot">.</span>
          </h1>
          <p>En idé fra deg kan bli en kveld for alle.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setParams({ nytt: "1" })}
        >
          <Plus size={19} />
          Foreslå en aktivitet
        </button>
      </div>
      <div className="notice">
        <Sparkles size={19} />
        <span>
          Stemmer gir styret innspill. En vinner blir først et offisielt
          arrangement når styret bekrefter og publiserer det.
        </span>
      </div>
      <section className="poll-section">
        <h2>
          <CalendarDays size={23} /> Neste torsdag?
        </h2>
        {polls.error ? (
          <Failure error={polls.error} />
        ) : polls.isPending ? (
          <Loading />
        ) : polls.data?.some((p) => p.published) && options.error ? (
          <Failure error={options.error} retry={() => void options.refetch()} />
        ) : polls.data?.some((p) => p.published) && options.isPending ? (
          <Loading />
        ) : polls.data?.filter((p) => p.published).length ? (
          <div className="poll-grid">
            {polls.data
              .filter((p) => p.published)
              .map((p) => (
                <PollCard
                  key={p.id}
                  poll={p}
                  options={
                    options.data?.filter((o) => o.poll_id === p.id) ?? []
                  }
                />
              ))}
          </div>
        ) : (
          <div className="quiet-note">
            <p>
              {demo
                ? "Avstemninger vises når styret har opprettet dem i Supabase. Ingen demostemmer er registrert."
                : "Styret har ikke publisert noen avstemninger ennå. Legg gjerne inn et forslag i mellomtiden."}
            </p>
          </div>
        )}
      </section>
      <div className="section-heading">
        <div>
          <h2>Ideer i potten</h2>
          <p>Små påfunn. Store muligheter.</p>
        </div>
        <span className="muted">
          {filtered?.length ?? 0} forslag{demo ? " · demo" : ""}
        </span>
      </div>
      <div className="filters">
        <select
          aria-label="Filtrer forslag etter kategori"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Alle kategorier</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Forslagsstatus"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Alle statuser</option>
          {Object.entries(suggestionStatuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Sorter forslag"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="popular">Mest populære</option>
          <option value="newest">Nyeste først</option>
        </select>
      </div>
      {suggestions.isPending ? (
        <Loading />
      ) : suggestions.error ? (
        <Failure error={suggestions.error} />
      ) : filtered?.length ? (
        <div className="suggestion-grid">
          {filtered.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              disabled={demo || !session || mutation.isPending}
              onVote={() => mutation.mutate({ id: s.id, vote: !s.my_vote })}
            />
          ))}
        </div>
      ) : (
        <Empty title="Her er det plass til en idé">
          Vær den første til å foreslå noe.
        </Empty>
      )}
      {!session && !demo && (
        <p className="notice">
          <Link to="/logg-inn?retur=%2Ftorsdagsbanken">
            Logg inn for å foreslå og stemme →
          </Link>
        </p>
      )}
      {params.has("nytt") && (
        <Modal
          title="Hva har du lyst til å finne på?"
          onClose={() => setParams({})}
        >
          {!session ? (
            <>
              <p>
                {demo
                  ? "Forslag kan sendes når Supabase er konfigurert."
                  : "Du må være innlogget for å sende inn et forslag. Du kan velge å vise navnet ditt anonymt."}
              </p>
              {!demo && (
                <Link
                  className="button primary"
                  to="/logg-inn?retur=%2Ftorsdagsbanken%3Fnytt%3D1"
                >
                  Logg inn
                </Link>
              )}
            </>
          ) : (
            <SuggestionForm onDone={() => setParams({})} />
          )}
        </Modal>
      )}
    </div>
  );
}
function SuggestionCard({
  suggestion: s,
  disabled,
  onVote,
}: {
  suggestion: Suggestion;
  disabled: boolean;
  onVote: () => void;
}) {
  const src = imageUrl(s.image_path, "suggestion-images");
  return (
    <article className="panel suggestion-card">
      {src && <img className="suggestion-image" src={src} alt="" />}
      <div className="button-row">
        <Badge tone={s.status === "planned" ? "green" : "blue"}>
          {suggestionStatuses[s.status]}
        </Badge>
        <span className="small-text">{s.category}</span>
      </div>
      <h3>{s.title}</h3>
      <p>{s.description}</p>
      {s.preferred_date && (
        <small>Ønsket dato: {dateLabel(`${s.preferred_date}T12:00:00Z`)}</small>
      )}
      {s.budget_nok !== null && (
        <small>Budsjettanslag: {s.budget_nok} kr</small>
      )}
      <div className="suggestion-bottom">
        <span>{s.author_name}</span>
        <button
          className={`vote-button ${s.my_vote ? "voted" : ""}`}
          disabled={disabled || !["proposed", "reviewing"].includes(s.status)}
          aria-label={`${s.my_vote ? "Trekk stemmen på" : "Stem på"} ${s.title}`}
          aria-pressed={s.my_vote}
          onClick={onVote}
        >
          <ArrowUp size={18} />
          {s.votes}
        </button>
      </div>
    </article>
  );
}
function SuggestionForm({ onDone }: { onDone: () => void }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const form = useForm<SuggestionInput>({
    resolver: zodResolver(suggestionSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "Sosialt",
      preferred_date: "",
      budget: "",
      anonymous: false,
    },
  });
  const anonymous = useWatch({ control: form.control, name: "anonymous" });
  const mutation = useMutation({
    mutationFn: async (v: SuggestionInput) => {
      const path =
        file && !v.anonymous
          ? await upload(file, "suggestion-images", session!.user.id)
          : null;
      return rpc("submit_suggestion", {
        p_title: v.title,
        p_description: v.description,
        p_category: v.category,
        p_date: v.preferred_date || null,
        p_budget: v.budget ? Number(v.budget) : null,
        p_anonymous: v.anonymous,
        p_image: path,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suggestions"] });
      toast("Ideen din er lagt i potten!");
      onDone();
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
    >
      <Field label="Tittel" error={form.formState.errors.title?.message}>
        <input
          {...form.register("title")}
          placeholder="Hva med PowerPoint Roulette?"
        />
      </Field>
      <Field
        label="Beskriv ideen"
        error={form.formState.errors.description?.message}
      >
        <textarea rows={4} {...form.register("description")} />
      </Field>
      <Field label="Kategori">
        <select {...form.register("category")}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <div className="form-row">
        <Field label="Ønsket dato (valgfritt)">
          <input type="date" {...form.register("preferred_date")} />
        </Field>
        <Field
          label="Budsjett i kr (valgfritt)"
          error={form.formState.errors.budget?.message}
        >
          <input inputMode="numeric" {...form.register("budget")} />
        </Field>
      </div>
      <Field
        label="Bilde (valgfritt)"
        hint={
          anonymous
            ? "Anonyme forslag publiseres uten bilde for å beskytte identiteten din."
            : undefined
        }
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={anonymous}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <label className="checkbox">
        <input type="checkbox" {...form.register("anonymous")} />
        Vis meg som anonym student
      </label>
      <p className="small-text">
        Styret kan se hvem som har sendt inn forslaget. Navnet ditt skjules i
        den offentlige visningen når du velger anonymitet.
      </p>
      <Submit pending={mutation.isPending}>Send inn forslaget</Submit>
    </form>
  );
}
function PollCard({ poll: p, options }: { poll: Poll; options: PollOption[] }) {
  const now = useNow();
  const { session } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState("");
  const results = useQuery({
    queryKey: ["poll-results", p.id],
    queryFn: () =>
      rpc<{ option_id: string; votes: number }[]>("poll_results", {
        p_poll: p.id,
      }),
    refetchInterval: 30000,
  });
  const own = useQuery({
    queryKey: ["own-poll-vote", p.id, session?.user.id],
    queryFn: () =>
      request<{ option_id: string } | null>(
        db()
          .from("poll_votes")
          .select("option_id")
          .eq("poll_id", p.id)
          .eq("user_id", session!.user.id)
          .maybeSingle(),
      ),
    enabled: !!session,
  });
  const mutation = useMutation({
    mutationFn: () => rpc("vote_poll", { p_poll: p.id, p_option: selected }),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast("Stemmen din er registrert.");
    },
    onError: (e) => toast(errorMessage(e), true),
  });
  const open = now >= Date.parse(p.opens_at) && now < Date.parse(p.closes_at);
  const total = results.data?.reduce((s, r) => s + r.votes, 0) ?? 0;
  return (
    <article className="panel poll-card">
      <Badge tone={open ? "green" : "blue"}>
        {open
          ? "Åpen avstemning"
          : now < Date.parse(p.opens_at)
            ? "Åpner snart"
            : "Avsluttet"}
      </Badge>
      <h3>{p.question}</h3>
      <p className="small-text">
        {p.audience === "members" ? "Kun godkjente medlemmer · " : ""}Stenger{" "}
        {dateLabel(p.closes_at)} kl.{" "}
        {new Intl.DateTimeFormat("nb", {
          timeZone: "Europe/Oslo",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(p.closes_at))}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset
          disabled={
            !open ||
            !!own.data ||
            !session ||
            own.isPending ||
            own.isError ||
            mutation.isPending
          }
        >
          <legend className="sr-only">Velg en aktivitet</legend>
          {options.map((o) => {
            const r = results.data?.find((r) => r.option_id === o.id);
            return (
              <label className="poll-option" key={o.id}>
                <input
                  type="radio"
                  name={`poll-${p.id}`}
                  value={o.id}
                  checked={(own.data?.option_id ?? selected) === o.id}
                  onChange={() => setSelected(o.id)}
                />
                <span>{o.label}</span>
                {r && (
                  <strong>
                    {r.votes} ({total ? Math.round((r.votes / total) * 100) : 0}{" "}
                    %)
                  </strong>
                )}
              </label>
            );
          })}
        </fieldset>
        {own.data ? (
          <p className="success-line">
            <Check size={17} />
            Du har stemt.
          </p>
        ) : session && open ? (
          <button
            className="button primary"
            disabled={
              !selected || own.isPending || own.isError || mutation.isPending
            }
          >
            Registrer min stemme
          </button>
        ) : !session && open ? (
          <Link className="button" to="/logg-inn?retur=%2Ftorsdagsbanken">
            Logg inn for å stemme
          </Link>
        ) : null}
      </form>
      {p.hide_results && results.data?.length === 0 && (
        <p className="small-text">
          <LockKeyhole size={14} />
          Resultatene vises når avstemningen er stengt.
        </p>
      )}
      {results.error && <Failure error={results.error} />}
      {own.error && <Failure error={own.error} />}
      <p className="small-text">
        Resultatet er et innspill til styret, ikke en bekreftelse på et
        arrangement.
      </p>
    </article>
  );
}
