import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export interface JournalEntry {
  id: string;
  experimentId: string;
  lab: string;
  date: string;
  timeSeconds: number;
  score: number;
  observations: any[];
  completedSteps: number[];
}

interface LabStoreState {
  observationData: Record<string, any[]>;
  completedSteps: Record<string, number[]>;
  validationError: { title: string; reason: string; nextStep: string } | null;
  hasAdjustedSlider: Record<string, boolean>;
  journalEntries: JournalEntry[];
  journalLoading: boolean;

  addObservation: (experimentId: string, dataPoint: any) => void;
  clearObservations: (experimentId: string) => void;
  markStepComplete: (experimentId: string, stepIndex: number) => void;
  resetLabProgress: (experimentId: string) => void;
  setValidationError: (title: string, reason: string, nextStep: string) => void;
  clearValidationError: () => void;
  setHasAdjustedSlider: (experimentId: string, value: boolean) => void;
  saveToJournal: (entry: Omit<JournalEntry, 'id'>) => Promise<void>;
  loadJournalFromDB: () => Promise<void>;
  clearJournal: () => void;
}

export const useLabStore = create<LabStoreState>((set, get) => ({
  observationData: {},
  completedSteps: {},
  validationError: null,
  hasAdjustedSlider: {},
  journalEntries: [],
  journalLoading: false,

  setValidationError: (title, reason, nextStep) =>
    set({ validationError: { title, reason, nextStep } }),
  clearValidationError: () => set({ validationError: null }),

  setHasAdjustedSlider: (experimentId, value) =>
    set(state => ({
      hasAdjustedSlider: { ...state.hasAdjustedSlider, [experimentId]: value },
    })),

  addObservation: (experimentId, dataPoint) =>
    set(state => ({
      observationData: {
        ...state.observationData,
        [experimentId]: [...(state.observationData[experimentId] || []), dataPoint],
      },
    })),

  clearObservations: (experimentId) =>
    set(state => ({
      observationData: { ...state.observationData, [experimentId]: [] },
    })),

  markStepComplete: (experimentId, stepIndex) =>
    set(state => {
      const current = state.completedSteps[experimentId] || [];
      if (current.includes(stepIndex)) return state;
      return {
        completedSteps: {
          ...state.completedSteps,
          [experimentId]: [...current, stepIndex],
        },
      };
    }),

  resetLabProgress: (experimentId) =>
    set(state => ({
      observationData: { ...state.observationData, [experimentId]: [] },
      completedSteps: { ...state.completedSteps, [experimentId]: [] },
      hasAdjustedSlider: { ...state.hasAdjustedSlider, [experimentId]: false },
    })),

  // Save to Supabase + local state
  saveToJournal: async (entry) => {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Save to Supabase
      const { data, error } = await supabase.from('journal_entries').insert({
        user_id: user.id,
        experiment_id: entry.experimentId,
        lab: entry.lab,
        date: entry.date,
        time_seconds: entry.timeSeconds,
        score: entry.score,
        observations: entry.observations,
        completed_steps: entry.completedSteps,
      }).select().single();

      if (!error && data) {
        const newEntry: JournalEntry = {
          id: data.id,
          experimentId: data.experiment_id,
          lab: data.lab,
          date: data.date,
          timeSeconds: data.time_seconds,
          score: data.score,
          observations: data.observations,
          completedSteps: data.completed_steps,
        };
        set(state => ({
          journalEntries: [newEntry, ...state.journalEntries],
        }));
        return;
      }
    }

    // Fallback: save locally if not authenticated
    const localEntry: JournalEntry = {
      ...entry,
      id: `${entry.experimentId}-${Date.now()}`,
    };
    set(state => ({
      journalEntries: [localEntry, ...state.journalEntries],
    }));
  },

  // Load journal entries from Supabase
  loadJournalFromDB: async () => {
    set({ journalLoading: true });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ journalLoading: false }); return; }

    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const entries: JournalEntry[] = data.map(row => ({
        id: row.id,
        experimentId: row.experiment_id,
        lab: row.lab,
        date: row.date,
        timeSeconds: row.time_seconds,
        score: row.score,
        observations: row.observations,
        completedSteps: row.completed_steps,
      }));
      set({ journalEntries: entries });
    }
    set({ journalLoading: false });
  },

  clearJournal: () => set({ journalEntries: [] }),
}));