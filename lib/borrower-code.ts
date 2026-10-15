export function formatBorrowerCode(code: string | null | undefined) {
  return code?.trim().toUpperCase() || "—";
}
