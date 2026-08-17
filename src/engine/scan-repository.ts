import { DBScanRecord, DBScanRecordSummary, ScanRecordInput } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';
import { ScanListQuery } from '../storage/storage-provider';

export interface ScanFilterOptions {
  userId?: string;
  projectId?: string;
  search?: string;
  framework?: string;
  minScore?: number;
  maxScore?: number;
  onlyFavorites?: boolean;
  /** Inclusive lower bound on createdAt, as an ISO-8601 string. */
  from?: string;
  /** Inclusive upper bound on createdAt, as an ISO-8601 string. */
  to?: string;
  sortBy?: 'createdAt' | 'qualityScore' | 'scanTimeMs' | 'memoryUsageMb' | 'ruleCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedScanResult {
  records: DBScanRecordSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 100;

export class ScanRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static async createScanRecord(scan: ScanRecordInput): Promise<DBScanRecord> {
    return ScanRepository.provider.createScanRecord(scan) as Promise<DBScanRecord>;
  }

  public static async getScanRecordById(id: string): Promise<DBScanRecord | undefined> {
    return ScanRepository.provider.getScanRecordById(id) as Promise<DBScanRecord | undefined>;
  }

  /**
   * The scan-history LIST query. Filtering, sorting, and pagination are pushed all the way down
   * to the storage provider (a real WHERE/ORDER BY/LIMIT/OFFSET query against Postgres in
   * production) rather than loading every one of a user's scan records into memory and slicing
   * them here -- the previous implementation fetched the caller's ENTIRE scan history, including
   * every row's full `diagnostics` JSON blob, on every single page load. `pageSize` is clamped
   * server-side (MAX_PAGE_SIZE) regardless of what a caller requests, so this can never become an
   * unbounded query no matter what a client sends.
   */
  public static async getScanRecords(options: ScanFilterOptions = {}): Promise<PaginatedScanResult> {
    const page = options.page && options.page > 0 ? Math.floor(options.page) : 1;
    const pageSize = options.pageSize && options.pageSize > 0
      ? Math.min(Math.floor(options.pageSize), MAX_PAGE_SIZE)
      : 10;

    const query: ScanListQuery = {
      userId: options.userId,
      projectId: options.projectId,
      search: options.search,
      framework: options.framework,
      minScore: options.minScore,
      maxScore: options.maxScore,
      onlyFavorites: options.onlyFavorites,
      from: options.from,
      to: options.to,
      sortBy: options.sortBy || 'createdAt',
      sortOrder: options.sortOrder || 'desc',
      page,
      pageSize,
    };

    const { records, total } = await ScanRepository.provider.queryScanRecords(query);
    const totalPages = Math.ceil(total / pageSize) || 1;

    return { records, total, page, pageSize, totalPages };
  }

  public static async toggleFavorite(id: string): Promise<DBScanRecord | undefined> {
    return ScanRepository.provider.toggleFavoriteScan(id) as Promise<DBScanRecord | undefined>;
  }

  public static async deleteScanRecord(id: string): Promise<boolean> {
    return ScanRepository.provider.deleteScanRecord(id) as Promise<boolean>;
  }
}
