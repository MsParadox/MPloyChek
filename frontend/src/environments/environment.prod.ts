// ============================================================
// MPloyChek v4.0 — Production Environment
// Backend: Render.com
// ⚠️  Update apiUrl & wsUrl to your actual Render service URL
// ============================================================
export const environment = {
  production:   true,
  // Replace with your actual Render URL after deployment:
  apiUrl:       'https://mploychek-api.onrender.com/api',
  wsUrl:        'wss://mploychek-api.onrender.com',
  tokenKey:     'mploychek_token',
  userKey:      'mploychek_user',
  refreshKey:   'mploychek_rt',
  defaultDelay: 0,
};
