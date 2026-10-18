import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { accessControl, authRoles } from "@/lib/auth-roles";

export const auth = betterAuth({
  appName: "OBNITHI",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  plugins: [
    admin({
      ac: accessControl,
      roles: authRoles,
      defaultRole: "staff",
      adminRoles: ["owner"],
      bannedUserMessage: "บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ",
    }),
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameNormalization: (value) => value.toLowerCase(),
      usernameValidator: (value) => /^[a-zA-Z0-9_]+$/.test(value),
      displayUsername: false,
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
