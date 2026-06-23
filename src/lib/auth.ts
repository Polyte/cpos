// JWT Auth Store — replaces Supabase client
// Token is obtained from /login and stored in localStorage

const TOKEN_KEY = 'clintpos_auth_token';
const USER_KEY = 'clintpos_auth_user';

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function getStoredUser(): any | null {
  try {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  } catch { return null; }
}

// Mimics the Supabase auth API surface used by this app
export const supabase = {
  auth: {
    async getSession() {
      const token = getToken();
      const user = getStoredUser();
      return { data: { session: token ? { access_token: token, user } : null } };
    },
    async signOut() {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } catch {}
    },
  },
};
