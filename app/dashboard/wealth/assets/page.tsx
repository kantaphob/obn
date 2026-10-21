import WealthAssets from "@/components/wealth/WealthAssets";
import WealthNetWorth from "@/components/wealth/WealthNetWorth";

export default function WealthAssetsPage() {
  return <main className="min-h-screen bg-slate-50/70"><WealthAssets /><div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6"><WealthNetWorth /></div></main>;
}
