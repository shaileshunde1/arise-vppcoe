import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rlqlvvdhvoklyxxhdqhv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJscWx2dmRodm9rbHl4eGhkcWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTYxNTYsImV4cCI6MjA4OTY3MjE1Nn0.7LT1H9NWpPpfN9bBBnbDg1wqBW8CJEz81R5HVPnsvoU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Profile = {
  id: string;
  name: string;
  institution: string;
  year: string;
  stream: string;
  role: 'student' | 'teacher';
  email: string;
};

export type JournalEntryDB = {
  id: string;
  user_id: string;
  experiment_id: string;
  lab: string;
  date: string;
  time_seconds: number;
  score: number;
  observations: any[];
  completed_steps: number[];
  created_at: string;
};