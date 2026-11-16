import { onRequest as adminUsersHandler } from './api/admin-users.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/admin-users' || url.pathname === '/api/admin-users/') {
      return adminUsersHandler({ request, env, ctx });
    }
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not Found', { status: 404 });
  }
};
