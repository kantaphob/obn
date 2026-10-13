import { SYSTEMS } from "@/lib/nav";
import { SystemHome } from "@/components/SystemPages";

export default function AdminHomePage() {
  return <SystemHome system={SYSTEMS.admin} />;
}
