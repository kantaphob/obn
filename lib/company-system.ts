export type BusinessSystem = "LOAN" | "CONSTRUCTION" | "BUILDIN" | "AGRICULTURE" | "YOUTUBE" | "NETFLIX";

const systemNamePatterns: Record<BusinessSystem, RegExp> = {
  LOAN: /loan|โลน|สินเชื่อ/i,
  CONSTRUCTION: /construction|ก่อสร้าง/i,
  BUILDIN: /build\s*[- ]?in|บิ้ว\s*อิน|บิวท์\s*อิน|ตกแต่ง/i,
  AGRICULTURE: /agriculture|เกษตร/i,
  YOUTUBE: /youtube|ytube|yture|ยูทูบ/i,
  NETFLIX: /netflix|nf\s*co/i,
};

export function matchesBusinessSystem(system: BusinessSystem, nameTH: string | null | undefined, nameEN: string | null | undefined) {
  return systemNamePatterns[system].test(`${nameTH ?? ""} ${nameEN ?? ""}`);
}

export type BusinessSystemCompany = { companycode: string; nameTH: string | null; nameEN: string | null };
export type BusinessSystemBranch = { companycode: string; branchcode: string; nameTH: string | null; nameEN: string | null };

/**
 * Resolve both standalone legal companies and business units represented as
 * named branches under a shared legal company (the current OBN data model).
 */
export function resolveBusinessSystemScope(
  system: BusinessSystem,
  companies: readonly BusinessSystemCompany[],
  branches: readonly BusinessSystemBranch[],
) {
  const directCompanyCodes = new Set(companies.filter((company) => matchesBusinessSystem(system, company.nameTH, company.nameEN)).map((company) => company.companycode));
  const matchedBranches = branches.filter((branch) => matchesBusinessSystem(system, branch.nameTH, branch.nameEN));
  const branchCodesByCompany = new Map<string, Set<string>>();
  for (const branch of matchedBranches) {
    const codes = branchCodesByCompany.get(branch.companycode) ?? new Set<string>();
    codes.add(branch.branchcode);
    branchCodesByCompany.set(branch.companycode, codes);
  }
  const companyCodes = new Set([...directCompanyCodes, ...branchCodesByCompany.keys()]);
  const visibleBranches = branches.filter((branch) => {
    const scopedBranchCodes = branchCodesByCompany.get(branch.companycode);
    return scopedBranchCodes ? scopedBranchCodes.has(branch.branchcode) : directCompanyCodes.has(branch.companycode);
  });
  return {
    companyCodes,
    directCompanyCodes,
    branchCodesByCompany,
    visibleBranches,
    allowsLocation(companyCode: string | null, branchCode: string | null) {
      if (!companyCode || !companyCodes.has(companyCode)) return false;
      const scopedBranchCodes = branchCodesByCompany.get(companyCode);
      return scopedBranchCodes ? Boolean(branchCode && scopedBranchCodes.has(branchCode)) : directCompanyCodes.has(companyCode);
    },
  };
}
