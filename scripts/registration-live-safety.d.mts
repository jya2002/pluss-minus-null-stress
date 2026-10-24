import type { SupabaseClient } from "@supabase/supabase-js";
export const developmentProject: "gawhbppuhnixqvhnnpnn";
export const developmentOrigin: string;
export type FixtureLabel = "a" | "b" | "c" | "board" | "admin";
export interface FixtureManifest {
  project: string;
  runId: string;
  testTitle: string;
  emailBase: string;
  users: { id: string; email: string; label: FixtureLabel }[];
  events: { id: string; createdBy: string }[];
  cleanupComplete: boolean;
  pendingIds?: string[];
}
export function fixtureEmail(
  emailBase: string,
  runId: string,
  label: FixtureLabel,
): string;
export function validateConfiguration(
  env: Record<string, string | undefined>,
): { url: string; key: string; serviceKey: string; emailBase: string };
export function pinnedFetch(
  signal?: AbortSignal,
  transport?: typeof globalThis.fetch,
): typeof globalThis.fetch;
export function cleanupFixtures(
  service: SupabaseClient,
  manifest: FixtureManifest,
): Promise<{ complete: boolean; failures: string[] }>;
