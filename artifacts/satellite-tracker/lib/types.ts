export interface Location {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  is_default: boolean;
  created_at: string;
}

export interface TrackedSatellite {
  id: string;
  user_id: string;
  norad_id: number;
  name: string;
  category: string | null;
  notes: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_code: string;
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
  location_id: string;
  group_id: string | null;
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
