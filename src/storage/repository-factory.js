"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryFactory = void 0;
const json_storage_provider_1 = require("./json-storage-provider");
const supabase_storage_provider_1 = require("./supabase-storage-provider");
class RepositoryFactory {
    static instance = null;
    static getStorageProvider() {
        if (!RepositoryFactory.instance) {
            const providerType = (process.env.STORAGE_PROVIDER || '').toLowerCase();
            const hasSupabaseCredentials = Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
                (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
            if (providerType === 'supabase' || (hasSupabaseCredentials && providerType !== 'json')) {
                RepositoryFactory.instance = new supabase_storage_provider_1.SupabaseStorageProvider();
            }
            else {
                RepositoryFactory.instance = new json_storage_provider_1.JsonStorageProvider();
            }
        }
        return RepositoryFactory.instance;
    }
    static setStorageProvider(provider) {
        RepositoryFactory.instance = provider;
    }
    static resetProvider() {
        RepositoryFactory.instance = null;
    }
}
exports.RepositoryFactory = RepositoryFactory;
//# sourceMappingURL=repository-factory.js.map