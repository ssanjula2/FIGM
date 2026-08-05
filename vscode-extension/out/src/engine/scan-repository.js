"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanRepository = void 0;
const repository_factory_1 = require("../storage/repository-factory");
class ScanRepository {
    static get provider() {
        return repository_factory_1.RepositoryFactory.getStorageProvider();
    }
    static createScanRecord(scan) {
        return ScanRepository.provider.createScanRecord(scan);
    }
    static getScanRecordById(id) {
        return ScanRepository.provider.getScanRecordById(id);
    }
    static getScanRecords(options = {}) {
        let records = ScanRepository.provider.getScanRecords(options.userId) || [];
        if (options.projectId) {
            records = records.filter((r) => r.projectId === options.projectId);
        }
        if (options.framework && options.framework !== 'ALL') {
            const fw = options.framework.toLowerCase();
            records = records.filter((r) => {
                const itemFw = r.framework.toLowerCase();
                if (fw.includes('react') && itemFw.includes('react'))
                    return true;
                if (fw.includes('next') && itemFw.includes('next'))
                    return true;
                return itemFw === fw;
            });
        }
        if (options.onlyFavorites) {
            records = records.filter((r) => r.isFavorite === true);
        }
        if (options.minScore !== undefined) {
            records = records.filter((r) => r.qualityScore >= options.minScore);
        }
        if (options.maxScore !== undefined) {
            records = records.filter((r) => r.qualityScore <= options.maxScore);
        }
        if (options.search && options.search.trim() !== '') {
            const q = options.search.toLowerCase().trim();
            records = records.filter((r) => r.fileName.toLowerCase().includes(q) ||
                r.framework.toLowerCase().includes(q) ||
                (r.repositoryUrl && r.repositoryUrl.toLowerCase().includes(q)));
        }
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        records.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
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
    static toggleFavorite(id) {
        return ScanRepository.provider.toggleFavoriteScan(id);
    }
    static deleteScanRecord(id) {
        return ScanRepository.provider.deleteScanRecord(id);
    }
}
exports.ScanRepository = ScanRepository;
//# sourceMappingURL=scan-repository.js.map