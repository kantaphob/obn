'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { Eye, FileText, Pencil, Printer, X } from 'lucide-react';

export type DocumentSigner = { role: string; name: string; signature?: string };
type DocumentTextKey = 'loanText' | 'guaranteeText' | 'collateralAgreementText';
type TypographyKey = 'documentFont' | 'documentFontSize' | 'documentHeadingSize';
const fontOptions = [
  { value: 'TH Sarabun New', family: '"TH Sarabun New", "Contract Sarabun", serif' },
  { value: 'Sarabun', family: '"Contract Sarabun", Sarabun, serif' },
  { value: 'Tahoma', family: 'Tahoma, "Contract Sarabun", sans-serif' },
  { value: 'Arial', family: 'Arial, "Contract Sarabun", sans-serif' },
  { value: 'Times New Roman', family: '"Times New Roman", "Contract Sarabun", serif' },
];
const fontSizes = [12, 14, 16, 18, 20, 22, 24, 26, 28];
type Props = {
  font?: string;
  fontSize?: string;
  headingSize?: string;
  onTypographyChange?: (key: TypographyKey, value: string) => void;
  loanText: string;
  guaranteeText?: string;
  collateralAgreementText?: string;
  signers: DocumentSigner[];
  attachments?: { url: string; name: string }[];
  draft?: boolean;
  onTextChange?: (key: DocumentTextKey, value: string) => void;
  onClose: () => void;
};

export default function ContractDocumentPreview({ loanText, guaranteeText, collateralAgreementText, signers, attachments = [], draft = true, font = 'TH Sarabun New', fontSize = '14', headingSize = '14', onTypographyChange, onTextChange, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const [editing, setEditing] = useState(false);
  const [localTypography, setLocalTypography] = useState({documentFont:font,documentFontSize:fontSize,documentHeadingSize:headingSize});
  const typography = onTypographyChange ? {documentFont:font,documentFontSize:fontSize,documentHeadingSize:headingSize} : localTypography;
  const selectedFont = fontOptions.find(option=>option.value===typography.documentFont) || fontOptions[0];
  const bodySize = fontSizes.includes(Number(typography.documentFontSize)) ? Number(typography.documentFontSize) : 14;
  const titleSize = fontSizes.includes(Number(typography.documentHeadingSize)) ? Number(typography.documentHeadingSize) : 14;
  function changeTypography(key:TypographyKey,value:string) {
    if(onTypographyChange) onTypographyChange(key,value);
    else setLocalTypography(current=>({...current,[key]:value}));
  }
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); printFrameRef.current?.remove(); };
  }, []);

  async function printDocument() {
    const pack = ref.current?.querySelector('.contract-a4-pack');
    if (!pack || printing) return;
    setPrinting(true);
    setPrintError('');
    printFrameRef.current?.remove();
    const frame = document.createElement('iframe');
    frame.title = 'พิมพ์เอกสารสัญญา A4';
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, {position:'fixed',left:'-10000px',top:'0',width:'210mm',height:'297mm',border:'0'});
    document.body.appendChild(frame);
    printFrameRef.current = frame;
    try {
      const printDocument = frame.contentDocument;
      const printWindow = frame.contentWindow;
      if (!printDocument || !printWindow) throw new Error('เปิดเอกสารพิมพ์ไม่สำเร็จ');
      printDocument.title = 'เอกสารสัญญา';
      const styles = printDocument.createElement('style');
      styles.textContent = `
        @font-face { font-family:"TH Sarabun New";src:url("${new URL('/fonts/th-sarabun/THSarabunNew-Regular.woff',window.location.origin).href}") format("woff");font-weight:400; }
        @font-face { font-family:"TH Sarabun New";src:url("${new URL('/fonts/th-sarabun/THSarabunNew-Bold.woff',window.location.origin).href}") format("woff");font-weight:700; }
        @font-face { font-family:"Contract Sarabun";src:url("${new URL('/fonts/sarabun/Sarabun-Regular.ttf',window.location.origin).href}") format("truetype");font-weight:400; }
        @font-face { font-family:"Contract Sarabun";src:url("${new URL('/fonts/sarabun/Sarabun-Bold.ttf',window.location.origin).href}") format("truetype");font-weight:700; }
        @page { size:A4 portrait; margin:25mm 20mm 20mm 30mm; }
        * { box-sizing:border-box; }
        html,body { margin:0;padding:0;width:auto;height:auto;background:white;color:#111; }
        .contract-a4-pack { display:block;position:static;width:100%;margin:0;padding:0; }
        .contract-a4-document { display:block;position:static;width:100%;max-width:none;min-height:0;height:auto;margin:0;padding:0;box-shadow:none;break-after:page; }
        .contract-a4-document:last-child { break-after:auto; }
        p { margin:0 0 4mm;line-height:inherit;orphans:3;widows:3; }
        .contract-a4-content p { overflow-wrap:break-word; }
        .contract-a4-signers { break-inside:auto; }
        .contract-a4-signers>div { break-inside:avoid; }
        .contract-a4-signers img { display:block;margin:0 auto 2mm;max-width:100%;height:18mm;object-fit:contain; }
        .contract-a4-footnote { font-size:10pt;color:#666;margin-top:6mm; }
      `;
      printDocument.head.appendChild(styles);
      const copy = pack.cloneNode(true) as HTMLElement;
      copy.classList.remove('is-editing');
      printDocument.body.appendChild(copy);
      await printDocument.fonts.load(`${bodySize}pt "${selectedFont.value === 'Sarabun' ? 'Contract Sarabun' : selectedFont.value}"`);
      await Promise.all(Array.from(printDocument.images).map(async image => { try { await image.decode(); } catch { /* Missing signatures must not block printing. */ } }));
      await printDocument.fonts.ready;
      await new Promise<void>(resolve => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(() => resolve())));
      printWindow.addEventListener('afterprint',()=>{frame.remove();if(printFrameRef.current===frame)printFrameRef.current=null;},{once:true});
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      frame.remove();
      if(printFrameRef.current===frame)printFrameRef.current=null;
      console.error('Print document failed',error);
      setPrintError('เตรียมเอกสารพิมพ์ไม่สำเร็จ กรุณากดพิมพ์อีกครั้ง');
    } finally {
      setPrinting(false);
    }
  }

  const documents: { key: DocumentTextKey; text: string; label: string }[] = [
    { key: 'loanText', text: loanText, label: 'สัญญากู้ยืมเงิน' },
    ...(guaranteeText ? [{ key: 'guaranteeText' as const, text: guaranteeText, label: 'สัญญาค้ำประกัน' }] : []),
    ...(collateralAgreementText ? [{ key: 'collateralAgreementText' as const, text: collateralAgreementText, label: 'สัญญาหลักประกัน' }] : []),
  ];

  return createPortal(
    <dialog ref={ref} className="contract-document-dialog" aria-label="ตรวจและแก้ไขเอกสารสัญญา A4" onCancel={event => { event.preventDefault(); onClose(); }}>
      <header style={{display:'block',padding:'20px 24px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}><span className="contract-preview-title-icon"><FileText size={22} aria-hidden="true"/></span><div><h2>เอกสารสัญญา A4</h2><p>ตรวจสอบข้อความและช่องลงนามก่อนพิมพ์</p></div></div>
          <button type="button" className="contract-preview-close" aria-label="ปิดหน้าดูเอกสาร" onClick={onClose}><X size={20} aria-hidden="true"/></button>
        </div>
        <div className="contract-preview-toolbar" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:16,marginTop:18}}>
          <div className="contract-preview-font-controls" style={{display:'flex',flexWrap:'wrap',alignItems:'flex-end',gap:10,minWidth:0,flex:'1 1 340px'}}>
            <label style={{display:'grid',gap:6,flex:'1 1 160px',minWidth:0}}>ฟอนต์<select aria-label="ฟอนต์เอกสาร" value={selectedFont.value} onChange={event=>changeTypography('documentFont',event.target.value)}>{fontOptions.map(option=><option key={option.value} value={option.value}>{option.value}</option>)}</select></label>
            <label style={{display:'grid',gap:6,flex:'0 1 90px'}}>เนื้อหา (pt)<select aria-label="ขนาดตัวอักษรเนื้อหา" value={bodySize} onChange={event=>changeTypography('documentFontSize',event.target.value)}>{fontSizes.map(size=><option key={size} value={size}>{size}</option>)}</select></label>
            <label style={{display:'grid',gap:6,flex:'0 1 90px'}}>หัวเรื่อง (pt)<select aria-label="ขนาดตัวอักษรหัวเรื่อง" value={titleSize} onChange={event=>changeTypography('documentHeadingSize',event.target.value)}>{fontSizes.map(size=><option key={size} value={size}>{size}</option>)}</select></label>
          </div>
          <div className="contract-preview-actions" style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {onTextChange && <button type="button" aria-pressed={editing} onClick={() => setEditing(value => !value)}>{editing ? <Eye size={16} aria-hidden="true"/> : <Pencil size={16} aria-hidden="true"/>}{editing ? 'ดูเอกสาร' : 'แก้ไขข้อความ'}</button>}
            <button type="button" className="contract-preview-print" disabled={printing} onClick={()=>void printDocument()}><Printer size={16} aria-hidden="true"/> {printing ? 'กำลังเตรียมเอกสาร…' : 'พิมพ์ / บันทึก PDF'}</button>
          </div>
        </div>
      </header>
      {printError && <p role="alert" style={{padding:'12px 24px',color:'#b3261e'}}>{printError}</p>}
      {editing && onTextChange && <section className="contract-preview-editor" aria-label="แก้ไขข้อความเอกสาร"><p>ข้อความที่แก้ไขจะแสดงในเอกสารและบันทึกพร้อมสัญญา</p>{documents.map(doc => <label key={doc.key}><span>{doc.label}</span><textarea rows={18} value={doc.text} onChange={event => onTextChange(doc.key, event.target.value)} /></label>)}</section>}
      <div className={`contract-a4-pack${editing ? ' is-editing' : ''}`}>
        {documents.map(doc => {
          const [title, ...lines] = doc.text.split('\n');
          const pageSigners = doc.key === 'loanText'
            ? [...signers.filter(person => ['ผู้ให้กู้', 'ผู้กู้', 'พยานคนที่ 1', 'พยานคนที่ 2'].includes(person.role)), { role: 'ผู้เขียนและพยาน', name: '' }]
            : doc.key === 'guaranteeText'
              ? signers.filter(person => ['ผู้ให้กู้', 'ผู้ค้ำประกัน', 'พยานคนที่ 1', 'พยานคนที่ 2'].includes(person.role))
              : signers;
          const documentSigners = lines.some(line => /^ลงชื่อ.*คู่สมรสผู้ให้ความยินยอม/.test(line))
            ? [...pageSigners, { role: 'คู่สมรสผู้ให้ความยินยอม', name: '' }]
            : pageSigners;
          const bodyLines = lines.filter(line => !/^\s*ลง(?:ชื่อ|ลายมือชื่อ)\s/.test(line));
          return <article className="contract-a4-document" key={doc.key} style={{fontFamily:selectedFont.family,fontSize:`${bodySize}pt`,lineHeight:1.5}}>
            <h1 style={{textAlign:'center',fontFamily:'inherit',fontSize:`${titleSize}pt`,fontWeight:700,margin:'0 0 10mm'}}>{title}</h1>
            <div className="contract-a4-content">{bodyLines.join('\n').split(/\n\n+/).filter(part => part.trim()).map((part, index) => {
              const content = part.trim();
              const isClause = /^(ข้อ\s*[0-9๐-๙]|[0-9]+\.)/.test(content);
              const isPlace = /^(ทำที่|วันที่)/.test(content);
              const isReference = /^(ลำดับที่|เลขที่สัญญา|รหัสผู้กู้|อ้างอิงสัญญา|ครอบคลุม)/.test(content);
              if (isPlace) return <div className="contract-a4-dateline" key={index} style={{width:'72%',margin:'6mm 0 8mm auto'}}>{content.split('\n').filter(Boolean).map((line,lineIndex)=><p key={lineIndex} style={{textAlign:'left',textIndent:0,whiteSpace:'normal',margin:'0 0 2mm'}}>{line}</p>)}</div>;
              if (isReference) return <p key={index} style={{textAlign:'left',textIndent:0,whiteSpace:'pre-line',margin:'0 0 5mm'}}>{content}</p>;
              return <p className={isClause ? 'contract-a4-paragraph' : undefined} key={index} style={{textIndent:'2.5cm',textAlign:'justify',textAlignLast:'left',whiteSpace:'normal',margin:'0 0 4mm',overflowWrap:'break-word',orphans:3,widows:3}}>{content.replace(/\n+/g,' ')}</p>;
            })}</div>
            <footer className="contract-a4-signers" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',columnGap:'8mm',rowGap:'8mm',marginTop:'10mm'}}>{documentSigners.map(person => <div key={person.role} style={{minWidth:0,textAlign:'center',breakInside:'avoid',paddingTop:'6mm'}}>
              {person.signature && <Image src={person.signature} width={220} height={75} unoptimized alt={`ลายเซ็น${person.role}`} />}
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:'2mm',marginBottom:'2mm'}}><span style={{whiteSpace:'nowrap'}}>ลงชื่อ</span><span style={{display:'block',flex:'0 1 40mm',minWidth:0,borderBottom:'1px dotted currentColor',height:'1em'}} aria-hidden="true"/></div>
              <p style={{margin:'0 0 1mm',overflowWrap:'anywhere'}}>({person.name || '................................'})</p>
              <p style={{margin:0,whiteSpace:'nowrap'}}>{person.role}</p>
            </div>)}</footer>
            {draft && <p className="contract-a4-footnote">ร่างเพื่อการตรวจสอบข้อมูลและข้อตกลงก่อนลงนาม</p>}
          </article>;
        })}
      </div>
      {attachments.length > 0 && <section className="contract-preview-attachments"><h3>เอกสารแนบ</h3>{attachments.filter(file => file.url.startsWith('/api/contracts/attachments/')).map(file => <p key={file.url}><a href={file.url} target="_blank" rel="noreferrer">{file.name}</a></p>)}</section>}
    </dialog>, document.body,
  );
}
