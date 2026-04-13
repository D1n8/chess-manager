export interface AppUser {
  id: string;
  email: string;
  role: string;
}

export interface Tournament {
  id: string;
  title: string;
  organizer_id: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  table_number: number;
  player_white: string;
  player_black: string;
  result: string | null;
}

export interface Participant {
  id: string;
  tournament_id: string;
  player_id: string;
}