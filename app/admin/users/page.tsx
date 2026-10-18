import UsersPageClient from "./UsersPageClient";

// The parent admin layout performs a request-time session check and may
// redirect before rendering this page, so this route cannot be validated as
// an instant navigation segment.
export const instant = false;

export default function UsersPage() {
  return <UsersPageClient />;
}
