export function dateLabel(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "numeric",
    month: "long",
    ...options,
  }).format(new Date(value));
}
export function timeLabel(value: string) {
  return dateLabel(value, {
    day: undefined,
    month: undefined,
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function osloInput(value: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
  return parts.replace(" ", "T");
}
// Convert an Oslo wall clock using the IANA rules; reject DST gaps and ambiguous hours.
export function fromOsloInput(value: string): string {
  const approximate = Date.parse(`${value}Z`);
  if (!Number.isFinite(approximate))
    throw new Error("Ugyldig dato og klokkeslett.");
  const candidates = [1, 2]
    .map((offset) => new Date(approximate - offset * 3600000))
    .filter((date) => osloInput(date.toISOString()) === value);
  if (candidates.length !== 1)
    throw new Error(
      "Klokkeslettet er ugyldig eller tvetydig ved overgang til sommer-/vintertid. Velg et annet tidspunkt.",
    );
  return candidates[0].toISOString();
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Noe gikk galt. Prøv igjen.";
}
