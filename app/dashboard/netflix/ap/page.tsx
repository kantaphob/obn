import IncomeExpenseTransactions from "@/components/accounts/IncomeExpenseTransactions";

export default function NetflixAPPage() {
  return <IncomeExpenseTransactions
    key="netflix-ap"
    type="EXPENSE"
    system="NETFLIX"
    allowTypeSwitch={false}
    pageTitle="เจ้าหนี้ (AP) · Netflix"
    pageDescription="ติดตามค่าสมาชิกและค่าใช้จ่ายที่รออนุมัติหรือรอจ่าย พร้อมบันทึกการจ่ายเงินจริง"
  />;
}
