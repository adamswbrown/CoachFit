export interface PairRequest {
  code: string;
}

export interface PairResponse {
  success: boolean;
  message: string;
  client_id: string;
  device_token: string;
  coach: {
    id: string;
    name: string | null;
    email: string;
  };
  client: {
    id: string;
    name: string | null;
    email: string;
  };
  paired_at: string;
}

export interface IngestEntryPayload {
  client_id: string;
  date: string;
  weightLbs?: number;
  steps?: number;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  sleepQuality?: number;
  perceivedStress?: number;
  notes?: string;
}

export interface IngestWorkoutsPayload {
  client_id: string;
  workouts: {
    workout_type: string;
    start_time: string;
    end_time: string;
    duration_seconds: number;
    calories_active?: number;
    distance_meters?: number;
    avg_heart_rate?: number;
    max_heart_rate?: number;
    source_device?: string;
    metadata?: Record<string, unknown>;
  }[];
}

export interface IngestSleepPayload {
  client_id: string;
  sleep_records: {
    date: string;
    total_sleep_minutes: number;
    in_bed_minutes?: number;
    awake_minutes?: number;
    asleep_core_minutes?: number;
    asleep_deep_minutes?: number;
    asleep_rem_minutes?: number;
    sleep_start?: string;
    sleep_end?: string;
    source_devices?: string[];
  }[];
}

export interface IngestStepsPayload {
  client_id: string;
  steps: {
    date: string;
    total_steps: number;
    source_devices?: string[];
  }[];
}

export interface IngestProfilePayload {
  client_id: string;
  metrics: {
    metric: 'weight' | 'height' | 'body_fat_percentage' | 'lean_body_mass';
    value: number;
    unit: 'kg' | 'lbs' | 'm' | 'cm' | 'inches' | 'percent';
    measured_at: string;
  }[];
}

export interface IngestResponse {
  success: boolean;
  processed: number;
  total?: number;
  errors?: { index?: number; date?: string; message: string }[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}
