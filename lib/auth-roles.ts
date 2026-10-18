import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

const statements = {
  ...defaultStatements,
  workspace: ["read", "write"],
} as const;

export const accessControl = createAccessControl(statements);

export const authRoles = {
  owner: accessControl.newRole({
    ...adminAc.statements,
    workspace: ["read", "write"],
  }),
  admin: accessControl.newRole({
    user: ["list", "get"],
    session: ["list"],
    workspace: ["read", "write"],
  }),
  manager: accessControl.newRole({
    user: [],
    session: [],
    workspace: ["read", "write"],
  }),
  staff: accessControl.newRole({
    user: [],
    session: [],
    workspace: ["read"],
  }),
  viewer: accessControl.newRole({
    user: [],
    session: [],
    workspace: ["read"],
  }),
};

export const rolePermissionChoices = [
  { key: "dashboard:read", label: "ดูภาพรวม" },
  { key: "borrowers:read", label: "ดูข้อมูลผู้กู้" },
  { key: "borrowers:write", label: "เพิ่มและแก้ไขข้อมูลผู้กู้" },
  { key: "contracts:read", label: "ดูสัญญา" },
  { key: "contracts:write", label: "สร้างและแก้ไขสัญญา" },
  { key: "repayments:read", label: "ดูการชำระเงิน" },
  { key: "repayments:write", label: "บันทึกการชำระเงิน" },
  { key: "accounting:read", label: "ดูบัญชีและรายงาน" },
  { key: "accounting:write", label: "แก้ไขรายการบัญชี" },
  { key: "companies:read", label: "ดูบริษัทและสาขา" },
  { key: "companies:write", label: "แก้ไขบริษัทและสาขา" },
  { key: "masterdata:read", label: "ดูข้อมูลหลัก" },
  { key: "masterdata:write", label: "แก้ไขข้อมูลหลัก" },
  { key: "logs:read", label: "ดูประวัติการใช้งาน" },
  { key: "integrations:manage", label: "จัดการการเชื่อมต่อระบบ" },
  { key: "roles:manage", label: "จัดการ Role และสิทธิ์" },
  { key: "users:manage", label: "จัดการบัญชีผู้ใช้" },
] as const;

export type AppPermission = (typeof rolePermissionChoices)[number]["key"];
