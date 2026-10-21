import IncomeExpenseTransactions from '@/components/accounts/IncomeExpenseTransactions';

export default function BuildInLedgerPage() {
  return <IncomeExpenseTransactions type="INCOME" system="BUILDIN" allowTypeSwitch />;
}
