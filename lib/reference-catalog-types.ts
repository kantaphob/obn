export type CatalogKind = 'units' | 'materials' | 'classifiers';

export type CatalogItem = {
  code: string;
  nameTh: string;
  nameEn: string;
  category: string;
  symbol?: string;
  standard?: string;
  examples?: string;
  recommendedUnit?: { code: string; nameTh: string; symbol: string } | null;
  sourceUrl: string;
  sourceVersion: string;
  sourceDate: string;
};

export type CatalogResult = {
  items: CatalogItem[];
  categories: string[];
  total: number;
  totalRecords: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
