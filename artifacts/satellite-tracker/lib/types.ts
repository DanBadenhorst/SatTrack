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
  notify_minutes_before: number;
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
