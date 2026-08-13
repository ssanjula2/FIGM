import { DBScanRecord } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';

export interface ScanFilterOptions {
  userId?: string;
  projectId?: string;
  search?: string;
  framework?: string;
  minScore?: number;
  maxScore?: number;
  onlyFavorites?: boolean;
  sortBy?: 'createdAt' | 'qualityScore' | 'scanTimeMs' | 'memoryUsageMb' | 'ruleCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedScanResult {
  records: DBScanRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ScanRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static async createScanRecord(scan: Omit<DBScanRecord, 'id' | 'createdAt'>): Promise<DBScanRecord> {
    return ScanRepository.provider.createScanRecord(scan) as Promise<DBScanRecord>;
  }

  public static async getScanRecordById(id: string): Promise<DBScanRecord | undefined> {
    return ScanRepository.provider.getScanRecordById(id) as Promise<DBScanRecord | undefined>;
  }

  public static async getScanRecords(options: ScanFilterOptions = {}): Promise<PaginatedScanResult> {
    let records = ((await ScanRepository.provider.getScanRecords(options.userId)) as DBScanRecord[]) || [];

    if (options.projectId) {
      records = records.filter((r) => r.projectId === options.projectId);
    }

    if (options.framework && options.framework !== 'ALL') {
      const fw = options.framework.toLowerCase();
      records = records.filter((r) => {
        const itemFw = r.framework.toLowerCase();
        if (fw.includes('react') && itemFw.includes('react')) return true;
        if (fw.includes('next') && itemFw.includes('next')) return true;
        return itemFw === fw;
      });
    }

    if (options.onlyFavorites) {
      records = records.filter((r) => r.isFavorite === true);
    }

    if (options.minScore !== undefined) {
      records = records.filter((r) => r.qualityScore >= options.minScore!);
    }

    if (options.maxScore !== undefined) {
      records = records.filter((r) => r.qualityScore <= options.maxScore!);
    }

    if (options.search && options.search.trim() !== '') {
      const q = options.search.toLowerCase().trim();
      records = records.filter(
        (r) =>
          r.fileName.toLowerCase().includes(q) ||
          r.framework.toLowerCase().includes(q) ||
          (r.repositoryUrl && r.repositoryUrl.toLowerCase().includes(q))
      );
    }

    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    records.sort((a, b) => {
      let valA: any = (a as any)[sortBy];
      let valB: any = (b as any)[sortBy];

      valA = valA ? new Date(valA).getTime() || valA : 0;
      valB = valB ? new Date(valB).getTime() || valB : 0;

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const total = records.length;
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const startIndex = (page - 1) * pageSize;
    const paginatedRecords = records.slice(startIndex, startIndex + pageSize);

    return {
      records: paginatedRecords,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  public static async toggleFavorite(id: string): Promise<DBScanRecord | undefined> {
    return ScanRepository.provider.toggleFavoriteScan(id) as Promise<DBScanRecord | undefined>;
  }

  public static async deleteScanRecord(id: string): Promise<boolean> {
    return ScanRepository.provider.deleteScanRecord(id) as Promise<boolean>;
  }
}
