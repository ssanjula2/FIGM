import { IStorageProvider } from './storage-provider';
import { JsonStorageProvider } from './json-storage-provider';
import { SupabaseStorageProvider } from './supabase-storage-provider';
import { isInsecureFallbackAllowed } from '../auth/auth-service';

export class RepositoryFactory {
  private static instance: IStorageProvider | null = null;

  public static getStorageProvider(): IStorageProvider {
    if (!RepositoryFactory.instance) {
      const providerType = (process.env.STORAGE_PROVIDER || '').toLowerCase();
      const isServer = typeof window === 'undefined';
      const hasSupabaseCredentials = Boolean(
        (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (isServer && process.env.SUPABASE_SERVICE_ROLE_KEY))
      );

      if (providerType === 'supabase' || (hasSupabaseCredentials && providerType !== 'json')) {
        RepositoryFactory.instance = new SupabaseStorageProvider();
      } else {
        // Stage 7B hardening: this used to fall back to the JSON-file-backed provider completely
        // silently whenever Supabase credentials were missing/misconfigured -- the app would start,
        // every request would succeed, and every write would go to a local file. On Vercel that file
        // lives on an ephemeral, per-invocation filesystem: it looks healthy in every response and
        // then the data is gone, with no error anywhere. Same allow-list as
        // isInsecureFallbackAllowed() (auth-service.ts) for consistency: only development/test may
        // silently take this path. Anywhere else, an operator must either configure real Supabase
        // credentials or explicitly opt in with STORAGE_PROVIDER=json (logged loudly, never silent).
        if (!isInsecureFallbackAllowed() && providerType !== 'json') {
          throw new Error(
            'FATAL: no Supabase credentials configured (SUPABASE_URL/SUPABASE_ANON_KEY or ' +
            'NEXT_PUBLIC_ equivalents) and STORAGE_PROVIDER is not explicitly set to "json". ' +
            'Refusing to silently fall back to the JSON-file storage provider outside local ' +
            'development/test -- on a serverless deployment (Vercel) that provider\'s writes do ' +
            'not persist across invocations, so the app would appear to work while silently ' +
            'losing every write. Set the Supabase env vars, or set STORAGE_PROVIDER=json to ' +
            'explicitly accept this (not recommended for any deployed environment).'
          );
        }
        if (!isInsecureFallbackAllowed()) {
          // eslint-disable-next-line no-console
          console.error(
            '[RepositoryFactory] WARNING: using the JSON-file storage provider outside local ' +
            'development/test (STORAGE_PROVIDER=json was explicitly set). Writes do not persist ' +
            'across invocations on a serverless deployment such as Vercel.' +
            (process.env.VERCEL ? ' Detected VERCEL=1 -- this is almost certainly a misconfiguration.' : '')
          );
        }
        RepositoryFactory.instance = new JsonStorageProvider();
      }
    }
    return RepositoryFactory.instance;
  }

  public static setStorageProvider(provider: IStorageProvider): void {
    RepositoryFactory.instance = provider;
  }

  public static resetProvider(): void {
    RepositoryFactory.instance = null;
  }
}
