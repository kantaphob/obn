import { SYSTEMS } from "@/lib/nav";
import { SystemHome } from "@/components/SystemPages";

// The parent layout verifies the request session and redirects unauthenticated
// visits, so this protected segment cannot be rendered by instant validation.
export const instant = false;

export default function AdminHomePage() {
  return <SystemHome system={SYSTEMS.admin} />;
}
