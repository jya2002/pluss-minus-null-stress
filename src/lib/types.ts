export const categories = [
  "Quiz",
  "Vors",
  "Spillkveld",
  "Karaoke",
  "Filmkveld",
  "Hyttetur",
  "Sosialt",
  "Faglig-sosialt",
  "Andre aktiviteter",
] as const;
export type Category = (typeof categories)[number];
export type Role = "student" | "board" | "admin";
export type EventStatus = "draft" | "published" | "cancelled";
export interface Event {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  starts_at: string;
  ends_at: string;
  location: string;
  map_url: string | null;
  image_path: string | null;
  category: Category;
  capacity: number;
  deadline: string;
  registration_open: boolean;
  waitlist_enabled: boolean;
  price_nok: number;
  organizer: string;
  min_age: number | null;
  accessibility: string;
  external_url: string | null;
  status: EventStatus;
  registration_mode: "individual" | "team";
  max_team_size: number;
  audience: "everyone" | "members" | "groups";
  alcohol_info: string | null;
  alcohol_approved: boolean;
  is_demo: boolean;
  created_at: string;
}
export interface EventSummary {
  event_id: string;
  confirmed: number;
  waitlisted: number;
}
export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  status: "confirmed" | "waitlisted" | "cancelled";
  team_id: string | null;
  dietary: string | null;
  attended: boolean;
  created_at: string;
}
export interface Team {
  id: string;
  name: string;
  members: number;
}
export const suggestionStatuses = {
  proposed: "Foreslått",
  reviewing: "Under vurdering",
  planned: "Planlagt",
  completed: "Gjennomført",
  rejected: "Avslått",
} as const;
export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: Category;
  preferred_date: string | null;
  budget_nok: number | null;
  image_path: string | null;
  author_name: string;
  status: keyof typeof suggestionStatuses;
  created_at: string;
  votes: number;
  my_vote: boolean;
}
export interface Poll {
  id: string;
  question: string;
  opens_at: string;
  closes_at: string;
  hide_results: boolean;
  published: boolean;
  audience: "everyone" | "members";
}
export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
}
export interface Profile {
  id: string;
  display_name: string;
  study_programme: string | null;
  study_year: number | null;
  avatar_path: string | null;
  created_at: string;
}
export interface Membership {
  user_id: string;
  status: "pending" | "approved" | "rejected" | "inactive";
  joined_at: string;
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  published: boolean;
  is_demo: boolean;
  created_at: string;
}
export interface Settings {
  id: boolean;
  about: string;
  contact_email: string;
  instagram_url: string;
  facebook_url: string;
  membership_approval: boolean;
}
export interface Notification {
  id: string;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
}
