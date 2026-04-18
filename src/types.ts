export interface AppUser {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  age?: number;
  rating?: number;
}

export interface Tournament {
  id: string;
  title: string;
  organizer_id: string;
  start_date: string;
  start_time: string;
  end_datetime: string;
  city: string;
  time_control: string;
  total_spots: number;
  total_rounds: number;
  status: string;
}

export interface Participant {
  id: string;
  tournament_id: string;
  player_id: string;
  status: string;
  app_users?: {
    full_name: string;
    rating: number;
  };
}

export interface Match {
  id: string;
  tournament_id: string;
  round_number: number;
  table_number: number;
  player_white: string;
  player_black: string;
  result: string | null;
}