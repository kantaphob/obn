import IncomeExpenseTransactions from "@/components/accounts/IncomeExpenseTransactions";

export default function NetflixARPage() {
  return <IncomeExpenseTransactions
    key="netflix-ar"
    type="INCOME"
    system="NETFLIX"
    allowTypeSwitch={false}
    pageTitle="ลูกหนี้ (AR) · Netflix"
    pageDescription="ติดตามรายการเรียกเก็บจากสมาชิก ยอดค้างรับ และบันทึกเมื่อได้รับเงินจริง"
  />;
}
