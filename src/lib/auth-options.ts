// This opt-in only affects the local Vite development server. Production builds
// never render the development password form, even if the flag is set.
export function developmentPasswordEnabled() {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_DEV_PASSWORD_LOGIN === "true"
  );
}
