// User-facing Auth errors never echo provider response bodies or credentials.
export function emailAuthError(error: unknown, verifying = false): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  if (
    [
      "over_email_send_rate_limit",
      "over_request_rate_limit",
      "email_rate_limit_exceeded",
    ].includes(String(code))
  )
    return "For mange forsøk. Vent litt før du prøver igjen.";
  if (code === "email_address_invalid")
    return "E-postadressen kan ikke brukes. Kontroller adressen og prøv igjen.";
  if (code === "otp_expired" || code === "otp_disabled")
    return "Lenken eller engangskoden er ugyldig eller utløpt. Be om en ny innloggingslenke.";
  return verifying
    ? "Koden kunne ikke bekreftes. Kontroller koden eller be om en ny innloggingslenke."
    : "Innloggingslenken kunne ikke sendes. Kontroller nettforbindelsen og prøv igjen. Kontakt styret hvis problemet fortsetter.";
}
