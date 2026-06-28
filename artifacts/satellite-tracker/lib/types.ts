export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_code: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  created_at: string;
}

export interface TrackedSatellite {
  id: string;
  group_id: string;
  norad_id: number;
  name: string;
  category: string | null;
  notes: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
}

export interface AlertSubscription {
  id: string;
  user_id: string;
  satellite_norad_id: number;
  group_id: string;
  min_elevation: number;
  pass_mode: "visible" | "all";
  /** @deprecated No longer used — alerts now send a daily 13:00 digest. Column remains in DB. */
  notify_minutes_before?: number;
  // Weekdays the alert may fire on, as JS getDay() indices (0=Sun … 6=Sat).
  // Empty array = every day. Evaluated in `timezone` (the observer's local zone).
  days_of_week: number[];
  timezone: string | null;
  /** How many days ahead each digest lists passes (1–10). Defaults to 1 if unset. */
  look_ahead_days?: number;
  email: string;
  active: boolean;
  created_at: string;
}

export interface SentAlert {
  id: string;
  subscription_id: string;
  satellite_norad_id: number;
  pass_start_utc: number;
  sent_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  author_email: string;
  body: string;
  created_at: string;
}

export interface GroupFeedSubscription {
  id: string;
  group_id: string;
  user_id: string;
  email: string;
  active: boolean;
  created_at: string;
}
