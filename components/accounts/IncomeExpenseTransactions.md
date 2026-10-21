# IncomeExpenseTransactions

ส่วนรายรับ–รายจ่ายที่ใช้ API บัญชีกลางเดิม พร้อมสรุปยอด ค้นหา ตัวกรอง และฟอร์มบันทึกรายการ

```tsx
import IncomeExpenseTransactions from "@/components/accounts/IncomeExpenseTransactions";

export default function Page() {
  return <IncomeExpenseTransactions system="CONSTRUCTION" />;
}
```

| Prop | ค่าเริ่มต้น | การใช้งาน |
| --- | --- | --- |
| `type` | `INCOME` | ประเภทเริ่มต้น `INCOME` หรือ `EXPENSE` |
| `system` | ไม่กำหนด | จำกัดระบบ `LOAN`, `CONSTRUCTION`, `BUILDIN`, `AGRICULTURE`, `YOUTUBE`, `NETFLIX`; ไม่กำหนดใช้บัญชีกลางตามสิทธิ์ |
| `allowTypeSwitch` | `true` | แสดงตัวสลับรายรับ–รายจ่าย |
| `backHref` | ไม่กำหนด | ลิงก์กลับ |

แสดงเฉพาะรายจ่าย:

```tsx
<IncomeExpenseTransactions type="EXPENSE" system="NETFLIX" allowTypeSwitch={false} />
```

เรียกภายในแอป Next.js ที่มี API `/api/accounts/transactions` และระบบเข้าสู่ระบบของโครงการนี้ การส่ง `system` เป็นตัวกรอง ไม่ใช่การมอบสิทธิ์เข้าถึงเพิ่มเติม

`CentralFinanceTransactions` ยังคงใช้ได้สำหรับหน้าเก่า โดยค่าเริ่มต้นของ `allowTypeSwitch` ยังเป็น `false` ตามเดิม
