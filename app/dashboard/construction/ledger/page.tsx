import IncomeExpenseTransactions from '@/components/accounts/IncomeExpenseTransactions';

export default function ConstructionLedgerPage() {
  return <IncomeExpenseTransactions type="INCOME" system="CONSTRUCTION" allowTypeSwitch />;
}
