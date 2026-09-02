import { IStorageProvider } from './storage-provider';
import { JsonStorageProvider } from './json-storage-provider';
import { SupabaseStorageProvider } from './supabase-storage-provider';

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
