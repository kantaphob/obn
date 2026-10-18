CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "role" TEXT DEFAULT 'staff',
  "banned" BOOLEAN DEFAULT false,
  "banReason" TEXT,
  "banExpires" DATETIME
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATETIME NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  "impersonatedBy" TEXT,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE TABLE "Account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATETIME,
  "refreshTokenExpiresAt" DATETIME,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

CREATE TABLE "Verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME
);

CREATE TABLE "Role" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "permissions" TEXT NOT NULL DEFAULT '[]',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

INSERT INTO "Role" ("id", "code", "name", "description", "permissions", "isSystem", "updatedAt") VALUES
('role_owner', 'owner', 'เจ้าของระบบ', 'จัดการทุกส่วนและกำหนดสิทธิ์ผู้ใช้', '["*"]', true, CURRENT_TIMESTAMP),
('role_admin', 'admin', 'ผู้ดูแลระบบ', 'ดูแลและใช้งานข้อมูลทุกส่วน ยกเว้นการจัดการบัญชีและ Role', '["dashboard:read","borrowers:read","borrowers:write","contracts:read","contracts:write","repayments:read","repayments:write","accounting:read","accounting:write","companies:read","companies:write","masterdata:read","masterdata:write","logs:read","integrations:manage"]', true, CURRENT_TIMESTAMP),
('role_manager', 'manager', 'ผู้จัดการ', 'ดูแลข้อมูลการดำเนินงานและรายงาน', '["dashboard:read","borrowers:read","borrowers:write","contracts:read","contracts:write","repayments:read","repayments:write","accounting:read","accounting:write","companies:read","companies:write","masterdata:read"]', true, CURRENT_TIMESTAMP),
('role_staff', 'staff', 'พนักงาน', 'จัดการข้อมูลผู้กู้ สัญญา และการชำระเงิน', '["dashboard:read","borrowers:read","borrowers:write","contracts:read","contracts:write","repayments:read","repayments:write","companies:read"]', true, CURRENT_TIMESTAMP),
('role_viewer', 'viewer', 'ผู้ดูข้อมูล', 'ดูข้อมูลได้โดยไม่แก้ไข', '["dashboard:read","borrowers:read","contracts:read","repayments:read","accounting:read","companies:read","masterdata:read","logs:read"]', true, CURRENT_TIMESTAMP);
