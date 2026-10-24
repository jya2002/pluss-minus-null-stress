import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Heart,
  Plus,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import { api, demo } from "../lib/api";
import EventCard from "../components/EventCard";
import {
  Badge,
  Empty,
  Failure,
  Loading,
  SectionHeading,
} from "../components/ui";
export default function Home() {
  const events = useQuery({ queryKey: ["events"], queryFn: api.events });
  const summaries = useQuery({ queryKey: ["summary"], queryFn: api.summary });
  const suggestions = useQuery({
    queryKey: ["suggestions"],
    queryFn: api.suggestions,
  });
  const news = useQuery({
    queryKey: ["announcements"],
    queryFn: api.announcements,
  });
  const upcoming = events.data
    ?.filter(
      (e) => e.status === "published" && new Date(e.ends_at) > new Date(),
    )
    .slice(0, 4);
  const featured = events.data?.find((e) =>
    demo
      ? e.id === "quiz-kaos"
      : e.status === "published" && new Date(e.ends_at) > new Date(),
  );
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-copy">
            <h1>
              Mer fellesskap.
              <br />
              Mindre stress.
            </h1>
          </div>
        </div>
      </section>
      <section className="section container home-events">
        <SectionHeading
          eyebrow="SETT AV EN KVELD"
          title="Noe å glede seg til"
          to="/arrangementer"
          action="Alle arrangementer"
        />
        {events.isPending ? (
          <Loading />
        ) : events.error ? (
          <Failure error={events.error} retry={() => void events.refetch()} />
        ) : upcoming?.length ? (
          <div className="event-grid">
            {upcoming.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                summary={summaries.data?.find((s) => s.event_id === e.id)}
              />
            ))}
          </div>
        ) : (
          <Empty title="Neste møteplass er på vei">
            Følg med her for nye arrangementer.
          </Empty>
        )}
      </section>
      <section className="container home-intro" aria-label="Bli kjent med oss">
        <div>
          <p>
            Den sosiale linjeforeningen for matematikkstudenter ved
            Universitetet i Oslo.
          </p>
          <div className="hero-footnote">
            <span className="mini-symbols" aria-hidden="true">
              <i>+</i>
              <i>−</i>
              <i>0</i>
            </span>
            <span>Flere kjente fjes. Færre ukjente variabler.</span>
          </div>
        </div>
        <div className="button-row">
          <Link className="button primary" to="/arrangementer">
            Se arrangementer <ArrowUpRight size={19} />
          </Link>
          <Link className="button" to="/torsdagsbanken">
            Kom med forslag <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <div className="brand-strip">
        <div className="container">
          <span>
            <Users size={17} /> Et fellesskap på tvers av kull
          </span>
          <span>
            <Heart size={17} /> Lav terskel. God stemning.
          </span>
          <span>
            <CalendarDays size={17} /> Torsdager med noe attåt
          </span>
          <span className="strip-math" aria-hidden="true">
            + mennesker − stress = sant
          </span>
        </div>
      </div>
      {featured && (
        <section className="container featured">
          <div className="featured-copy">
            <div className="eyebrow">
              {featured.status === "draft"
                ? "PÅ TEGNEBRETTET · UTKAST"
                : "NESTE MØTEPLASS"}
            </div>
            <h2>
              {featured.title}
              <span> {featured.category === "Quiz" ? "?" : "↗"}</span>
            </h2>
            <p>{featured.subtitle}</p>
            <p className="muted">
              {featured.status === "draft"
                ? "Styret avklarer detaljene. Påmeldingen åpner først når arrangementet er bekreftet."
                : featured.description.slice(0, 170)}
            </p>
            <Link className="button light" to={`/arrangementer/${featured.id}`}>
              {featured.status === "draft" ? "Se utkastet" : "Se arrangementet"}
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="featured-poster" aria-hidden="true">
            <div className="poster-plus">+</div>
            <div className="poster-ring" />
            <span>
              en kveld.
              <br />
              mange muligheter.
            </span>
            <small>PLUSS MINUS NULL STRESS</small>
          </div>
        </section>
      )}
      <section className="section container thursday-section">
        <SectionHeading
          eyebrow="DIN TORSDAG. DIN IDÉ."
          title="Torsdagsbanken"
          to="/torsdagsbanken"
          action="Til Torsdagsbanken"
        >
          Hva skal vi finne på neste gang? Legg en idé i potten.
        </SectionHeading>
        <div className="thursday-grid">
          <div className="idea-intro">
            <div className="idea-icon">
              <Sparkles size={28} />
            </div>
            <h3>
              Gode ideer trenger
              <br />
              ingen fasit.
            </h3>
            <p>
              Bowling, brettspill eller noe vi aldri har prøvd? Foreslå en
              aktivitet og stem på det du vil være med på.
            </p>
            <Link className="text-button" to="/torsdagsbanken?nytt=1">
              Del din idé <ArrowRight size={18} />
            </Link>
            <span className="idea-doodle" aria-hidden="true">
              ∑ ideer = ♡
            </span>
          </div>
          <div className="idea-list">
            {suggestions.error ? (
              <Failure error={suggestions.error} />
            ) : suggestions.isPending ? (
              <Loading />
            ) : !suggestions.data?.length ? (
              <Empty title="Den neste ideen kan være din">
                <Link to="/torsdagsbanken?nytt=1">
                  Foreslå noe du vil være med på →
                </Link>
              </Empty>
            ) : (
              suggestions.data
                ?.slice()
                .sort((a, b) => b.votes - a.votes)
                .slice(0, 3)
                .map((s, i) => (
                  <Link className="idea-row" key={s.id} to="/torsdagsbanken">
                    <span className={`idea-number n${i}`}>
                      {["↗", "⌂", "⚄"][i]}
                    </span>
                    <div>
                      <h3>{s.title}</h3>
                      <span>
                        {demo ? "Demoforslag" : s.author_name}{" "}
                        <span aria-hidden="true">·</span> {s.category}
                      </span>
                    </div>
                    <span className="vote-count">
                      <Vote size={17} />
                      {demo ? "Se idé" : s.votes}
                    </span>
                  </Link>
                ))
            )}
          </div>
        </div>
      </section>
      <section className="section container news-section">
        <SectionHeading eyebrow="FRA FORENINGEN" title="Siste nytt" />
        {news.error ? (
          <Failure error={news.error} />
        ) : news.data?.filter((a) => a.published).length ? (
          <div className="news-grid">
            {news.data
              .filter((a) => a.published)
              .slice(0, 3)
              .map((a) => (
                <article className="panel" key={a.id}>
                  {a.is_demo && <Badge>Demo</Badge>}
                  <h3>{a.title}</h3>
                  <p className="pre-line">{a.body}</p>
                </article>
              ))}
          </div>
        ) : (
          <div className="quiet-note">
            <Sparkles size={20} />
            <p>Her kommer oppdateringer fra styret når noe er klart å dele.</p>
          </div>
        )}
      </section>
      <section className="container join-banner">
        <div>
          <Badge tone="pink">DET ER PLASS TIL DEG OGSÅ</Badge>
          <h2>
            Du trenger ikke ha
            <br />
            alt regnet ut.
          </h2>
          <p>Bli med i fellesskapet. Resten tar vi sammen.</p>
        </div>
        <Link className="button primary" to="/min-side">
          Bli medlem <ArrowUpRight size={19} />
        </Link>
        <Plus
          className="join-decoration"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </section>
    </>
  );
}
