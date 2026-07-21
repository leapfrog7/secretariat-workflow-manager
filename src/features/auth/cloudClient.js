import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';
import { cloudConfigured, cloudUrls } from './authConfig';

export { cloudConfigured } from './authConfig';

export const cloudClient = cloudConfigured
  ? createClient({
      auth: {
        adapter: BetterAuthReactAdapter(),
        url: cloudUrls.authUrl,
      },
      dataApi: {
        url: cloudUrls.dataApiUrl,
      },
    })
  : null;
