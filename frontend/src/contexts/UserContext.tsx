import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  institution: string;
  year: string;
  stream: string;
  class_division: string;
  role: 'student' | 'teacher';
}

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

// Retry loading profile a few times with a delay.
// Needed for Google OAuth: AuthCallback inserts the profile row,
// but SIGNED_IN fires before that insert completes.
async function loadProfileWithRetry(userId: string, retries = 4, delayMs = 600): Promise<UserProfile | null> {
  for (let i = 0; i < retries; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) return data as UserProfile;

    // Profile row not found yet — wait and retry
    if (i < retries - 1) {
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
  return null;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const data = await loadProfileWithRetry(user.id);

    if (data) {
      setProfile(data);
      localStorage.setItem('arise-name', data.name || '');
      window.dispatchEvent(new Event('storage'));
    } else {
      // Profile still doesn't exist after retries (shouldn't normally happen)
      // Set a minimal profile from auth user so app doesn't break
      const fallback: UserProfile = {
        id: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student',
        email: user.email || '',
        institution: '',
        year: '',
        stream: 'PCM',
        class_division: 'Unassigned',
        role: 'student',
      };
      setProfile(fallback);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // Delay slightly to allow AuthCallback's profile insert to complete
        // before we attempt to load it
        setTimeout(() => loadProfile(), 800);
      }
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
        localStorage.removeItem('arise-name');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ profile, loading, refreshProfile: loadProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);