import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { Event, EventSummary } from "../lib/types";
import { dateLabel, timeLabel } from "../lib/utils";
import { imageUrl } from "../lib/api";
import { Badge } from "./ui";
import { useNow } from "../lib/clock";
export function EventArt({
  event,
  large = false,
}: {
  event: Event;
  large?: boolean;
}) {
  const src = imageUrl(event.image_path);
  return (
    <div
      className={`event-art art-${event.category === "Quiz" ? "quiz" : event.category === "Filmkveld" ? "film" : event.category === "Karaoke" ? "karaoke" : "games"} ${large ? "large" : ""}`}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" />
      ) : (
        <>
          <span className="art-grid" />
          <span className="art-symbol" aria-hidden="true">
            {event.category === "Quiz"
              ? "?"
              : event.category === "Filmkveld"
                ? "▶"
                : event.category === "Karaoke"
                  ? "♪"
                  : "⚄"}
          </span>
          <span className="art-word" aria-hidden="true">
            {event.category === "Quiz"
              ? "QUIZ & KAOS"
              : event.category === "Filmkveld"
                ? "BARE ÉN FILM TIL."
                : event.category === "Karaoke"
                  ? "TA MIKKEN."
                  : "DIN TUR."}
          </span>
          <span className="art-small" aria-hidden="true">
            PLUSS MINUS NULL STRESS ↗
          </span>
        </>
      )}
      <div className="art-badges">
        <Badge tone="dark">{event.category}</Badge>
        {event.status === "draft" && <Badge tone="pink">Utkast</Badge>}
        {event.status === "cancelled" && <Badge tone="pink">Avlyst</Badge>}
        {event.is_demo && <Badge tone="dark">Demo</Badge>}
      </div>
    </div>
  );
}
export default function EventCard({
  event,
  summary,
}: {
  event: Event;
  summary?: EventSummary;
}) {
  const now = useNow();
  const registrationAvailable =
    event.status === "published" &&
    event.registration_open &&
    new Date(event.deadline).getTime() > now &&
    new Date(event.starts_at).getTime() > now;
  const action =
    event.status === "draft"
      ? "Se utkast"
      : event.status === "cancelled"
        ? "Se avlysning"
        : registrationAvailable
          ? "Meld deg på"
          : "Se arrangement";
  return (
    <article className="event-card">
      {event.image_path && (
        <Link
          to={`/arrangementer/${event.id}`}
          className="event-image-link"
          tabIndex={-1}
          aria-hidden="true"
        >
          <EventArt event={event} />
        </Link>
      )}
      <div className="event-card-body">
        <div className="event-card-labels">
          <div className="event-date">
            <CalendarDays size={15} aria-hidden="true" />
            <time dateTime={event.starts_at}>
              {dateLabel(event.starts_at, { weekday: "short", month: "short" })}
            </time>
          </div>
          {event.status === "draft" && <Badge tone="pink">Utkast</Badge>}
          {event.status === "cancelled" && <Badge tone="pink">Avlyst</Badge>}
          {event.is_demo && <Badge>Demo</Badge>}
        </div>
        <h3>
          <Link to={`/arrangementer/${event.id}`}>
            {event.title}
            <ArrowUpRight size={21} />
          </Link>
        </h3>
        <p className="event-excerpt">{event.subtitle || event.description}</p>
        <Link
          className="button primary event-cta"
          to={`/arrangementer/${event.id}`}
          aria-label={`${action}: ${event.title}`}
        >
          {action} <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
        <div className="event-bottom">
          <span>
            <MapPin size={14} />
            {event.location}
            <span aria-hidden="true">·</span> {timeLabel(event.starts_at)}
          </span>
          <strong>
            {event.price_nok === 0 ? "Gratis" : `${event.price_nok} kr`}
          </strong>
        </div>
        {summary && (
          <div className="capacity-bar">
            <span
              style={{
                width: `${Math.min(100, (summary.confirmed / event.capacity) * 100)}%`,
              }}
            />
            <small>
              {Math.max(0, event.capacity - summary.confirmed)} ledige plasser
            </small>
          </div>
        )}
      </div>
    </article>
  );
}
