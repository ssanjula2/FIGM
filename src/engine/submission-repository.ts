import { DBSubmission } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';

/**
 * Thin repository wrapper over IStorageProvider's submission methods, mirroring
 * NotificationRepository's pattern -- app/api/submissions/route.ts goes through this instead of
 * importing UserDB directly, so submissions persist through the same provider abstraction (real
 * Postgres when STORAGE_PROVIDER=supabase, JSON-file fallback otherwise) as every other production
 * data path instead of always landing in the local JSON file regardless of configuration.
 */
export class SubmissionRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static async create(submission: Omit<DBSubmission, 'id' | 'createdAt'>): Promise<DBSubmission> {
    return SubmissionRepository.provider.createSubmission(submission) as Promise<DBSubmission>;
  }

  public static async getByUserId(userId: string): Promise<DBSubmission[]> {
    return ((await SubmissionRepository.provider.getSubmissionsByUserId(userId)) as DBSubmission[]) || [];
  }

  public static async delete(submissionId: string, userId: string): Promise<boolean> {
    return SubmissionRepository.provider.deleteSubmission(submissionId, userId);
  }
}
