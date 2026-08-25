import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let memoizedClient: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (memoizedClient) return memoizedClient;

  // Retrieve from dynamic window config if available, otherwise fallback to static env
  const dynamicUrl = window.__SUPABASE_CONFIG__?.url;
  const dynamicKey = window.__SUPABASE_CONFIG__?.anonKey;

  const url = dynamicUrl || import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = dynamicKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const safeUrl = url && !url.includes('your_supabase_project_url') ? url : 'https://placeholder-project.supabase.co';
  const safeKey = anonKey && !anonKey.includes('your_supabase_anon_key') ? anonKey : 'placeholder-anon-key';

  memoizedClient = createClient(safeUrl, safeKey);
  return memoizedClient;
};

// Create a Proxy that forwards all properties and methods to the dynamically-initialized client
export const supabase = new Proxy({} as unknown as SupabaseClient, {
  get(target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export const isSupabaseConfigured = (): boolean => {
  const dynamicUrl = window.__SUPABASE_CONFIG__?.url;
  const dynamicKey = window.__SUPABASE_CONFIG__?.anonKey;

  const url = dynamicUrl || import.meta.env.VITE_SUPABASE_URL;
  const anonKey = dynamicKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return false;
  if (url.includes('your_supabase_project_url') || url.includes('your-project') || url.includes('placeholder-project')) return false;
  if (anonKey.includes('your_supabase_anon_key') || anonKey.includes('your-anon-public-key') || anonKey.includes('placeholder-anon-key')) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export default supabase;
