const money = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(value / 100);

export function CapitalWaterfall({ invested, withdrawn }: { invested: number; withdrawn: number }) {
  const net = invested - withdrawn;
  const high = Math.max(invested, net, 100);
  const low = Math.min(net, 0);
  const y = (value: number) => 165 - (value - low) / (high - low) * 115;
  const bars = [
    { label: "ทุนจริงที่ใส่เข้า", value: invested, top: invested, bottom: 0, color: "#26b59e", x: 38 },
    { label: "ทุนที่ถอนออกไปแล้ว", value: withdrawn, top: invested, bottom: net, color: "#dbac92", x: 177 },
    { label: "ทุนสุทธิคงเหลือ", value: net, top: Math.max(net, 0), bottom: Math.min(net, 0), color: net < 0 ? "#bd8278" : "#4d8caa", x: 316 },
  ];
  return <svg className="loan-capital-waterfall" viewBox="0 0 430 205" role="img" aria-label={`ทุนใส่เข้า ${money(invested)} หักถอนทุน ${money(withdrawn)} เหลือทุนสุทธิ ${money(net)}`}>
    <line x1="24" x2="406" y1={y(0)} y2={y(0)} stroke="#dbe9e2" />
    <line x1="114" x2="177" y1={y(invested)} y2={y(invested)} stroke="#b2d2c6" strokeDasharray="4 4" />
    <line x1="253" x2="316" y1={y(net)} y2={y(net)} stroke="#b2d2c6" strokeDasharray="4 4" />
    {bars.map(bar => <g key={bar.label}><rect x={bar.x} y={y(bar.top)} width="76" height={Math.max(0, y(bar.bottom) - y(bar.top))} rx="7" fill={bar.color} fillOpacity=".85"><title>{`${bar.label} ${money(bar.value)}`}</title></rect><text x={bar.x + 38} y={Math.max(24, y(bar.top) - 11)} textAnchor="middle" className="loan-waterfall-value">{money(bar.value)}</text><text x={bar.x + 38} y="192" textAnchor="middle" className="loan-waterfall-label">{bar.label}</text></g>)}
  </svg>;
}

export function InterestComparison({ received, withheld, pending, year }: { received: number; withheld: number; pending: number; year: number }) {
  const max = Math.max(received, withheld, pending, 1);
  const rows = [
    { label: `ดอกเบี้ยรับชำระแล้ว ปี ${year}`, value: received, color: "#26b59e", note: "เงินรับชำระที่แยกเป็นดอกเบี้ย" },
    { label: `ดอกเบี้ยหักล่วงหน้า ปี ${year}`, value: withheld, color: "#a78fcb", note: "หักจากเงินจ่ายของสัญญาที่จ่ายแล้ว" },
    { label: "ดอกเบี้ยรอรับ ณ วันนี้", value: pending, color: "#d8ac87", note: "ดอกเบี้ยที่เกิดแล้ว ยังไม่รับ รวมทุกปี" },
  ];
  return <div className="loan-interest-comparison" role="group" aria-label="เปรียบเทียบดอกเบี้ยรับแล้ว หักล่วงหน้า และรอรับ">
    {rows.map(row => <div className="loan-interest-comparison-row" key={row.label}><div><span><i style={{ background: row.color }} />{row.label}</span><strong>{money(row.value)}</strong></div><svg viewBox="0 0 300 8" preserveAspectRatio="none" role="img" aria-label={`${row.label} ${money(row.value)}`}><rect width="300" height="8" rx="4" fill="#e4eee8" /><rect width={row.value / max * 300} height="8" rx="4" fill={row.color} /></svg><small>{row.note}</small></div>)}
  </div>;
}

export function FinanceSparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const points = values.map((value, index) => `${5 + index / Math.max(1, values.length - 1) * 100},${35 - (value - low) / (high - low) * 28}`).join(" ");
  return <svg className="loan-finance-sparkline" viewBox="0 0 110 42" role="img" aria-label={`แนวโน้ม${label}รายเดือนถึงเดือนปัจจุบัน`}><line x1="5" x2="105" y1="37" y2="37" stroke="#dce9e2" /><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function AmountShare({ amount, total, color = "#39ac97" }: { amount: number; total: number; color?: string }) {
  const percent = total > 0 ? Math.max(0, Math.min(1, amount / total)) : 0;
  return <svg className="loan-amount-share" viewBox="0 0 80 4" role="img" aria-label={`สัดส่วนยอดรายการนี้ ${(percent * 100).toFixed(1)}% ของยอดในกลุ่ม`}><rect width="80" height="4" rx="2" fill="#e1ede6" /><rect width={percent * 80} height="4" rx="2" fill={color} /></svg>;
}
