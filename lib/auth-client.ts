"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient } from "better-auth/client/plugins";
import { accessControl, authRoles } from "@/lib/auth-roles";

export const authClient = createAuthClient({
  plugins: [adminClient({ ac: accessControl, roles: authRoles }), usernameClient()],
});
