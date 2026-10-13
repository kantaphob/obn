export type LocationOption = { id: number; nameTh: string; nameEn: string };
export type PostcodeResult = {
  items: {
    id: number;
    nameTh: string;
    nameEn: string;
    postcode: string | null;
    latitude: number | null;
    longitude: number | null;
    district: LocationOption & { province: LocationOption };
  }[];
  provinces: LocationOption[];
  districts: LocationOption[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
