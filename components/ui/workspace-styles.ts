// Shared Tailwind utilities for the workspace shell and its pages.
// Keep full class names so Tailwind can discover every state and breakpoint.
export const workspaceStyles = {
  frame:
    "[--surface:#d5d6d3] [--text:#272b29] [--muted:#626862] flex gap-4 min-h-[100dvh] p-5 [background:#bfc1be] text-[color:var(--text)] [font-family:Arial,'Noto_Sans_Thai',sans-serif] text-[14px] leading-[1.6] [&_*]:box-border [&_a]:no-underline [&_a]:text-inherit [&_button]:cursor-pointer [&_:is(a,button,input):focus-visible]:[outline:2px_solid_#355a4b] [&_:is(a,button,input):focus-visible]:[outline-offset:4px] max-[1100px]:gap-3 max-[1100px]:p-3.5 max-[760px]:flex-col max-[760px]:p-2.5 max-[760px]:gap-2.5 motion-reduce:[&_*]:[transition:none]! [&_:where(p,h1,h2)]:m-0",
  rail:
    "sticky top-5 flex items-center flex-col w-[72px] h-[calc(100dvh_-_40px)] shrink-0 p-[10px_8px] rounded-[27px] [background:var(--surface)] shadow-[inset_1px_1px_2px_#ffffff70,7px_8px_20px_#62665e23] max-[1100px]:top-3.5 max-[1100px]:h-[calc(100dvh_-_28px)] max-[760px]:static max-[760px]:flex-row max-[760px]:gap-2.5 max-[760px]:w-full max-[760px]:h-auto max-[760px]:p-2 max-[760px]:rounded-[20px]",
  railNav:
    "flex items-center flex-col gap-[13px] w-[56px] flex-1 p-[16px_5px] rounded-[19px] [background:linear-gradient(120deg,#303231,#202221)] text-[#d5d8d4] shadow-[3px_5px_10px_#0003,inset_1px_1px_2px_#ffffff40] max-[760px]:flex-row max-[760px]:justify-around max-[760px]:gap-[3px] max-[760px]:p-[5px] max-[760px]:min-w-0 max-[760px]:rounded-[14px]",
  railLogo:
    "grid place-items-center w-10 pb-[19px] mb-0.5 [border-bottom:1px_solid_#ffffff24] max-[760px]:hidden",
  railLink:
    "grid place-items-center w-11 min-h-[46px] rounded-[12px] [transition:background_.18s,box-shadow_.18s] [&:hover]:[background:#ffffff16] [&[aria-current]]:[background:linear-gradient(140deg,#777b77,#535752)] [&[aria-current]]:shadow-[inset_1px_1px_1px_#ffffff55,2px_4px_7px_#0004] [&[aria-current]]:text-[#fff] max-[760px]:w-10 max-[760px]:min-h-[42px]",
  railCaption:
    "text-[9px] tracking-[2px] [writing-mode:vertical-rl] [transform:rotate(180deg)] p-[24px_0] text-[#636a62] max-[760px]:hidden",
  settings:
    "[background:#292c29] text-[#e4e7e2]! shadow-[3px_4px_9px_#0003] max-[760px]:shrink-0",
  sidebar:
    "sticky top-5 w-[270px] shrink-0 h-[calc(100dvh_-_40px)] overflow-y-auto p-[24px_20px] rounded-[27px] [background:var(--surface)] [border:1px_solid_#ffffff25] shadow-[inset_1px_1px_2px_#ffffff55,9px_10px_25px_#62665e18] [scrollbar-width:thin] min-[1400px]:w-[290px] max-[1100px]:w-[232px] max-[1100px]:p-[22px_14px] max-[1100px]:top-3.5 max-[1100px]:h-[calc(100dvh_-_28px)] max-[760px]:static max-[760px]:w-full max-[760px]:h-auto max-[760px]:p-[16px_18px] max-[760px]:rounded-[20px] max-[760px]:overflow-visible",
  windowBar:
    "flex justify-between items-center text-[#767d75] mb-8 max-[760px]:hidden",
  dots:
    "flex gap-[9px] [&_i]:w-2.5 [&_i]:h-2.5 [&_i]:rounded-[50%] [&_i]:[background:#c79494] [&_i]:shadow-[inset_1px_1px_3px_#fff,1px_2px_3px_#0002] [&_i:nth-child(2)]:[background:#cabe8b] [&_i:nth-child(3)]:[background:#97b7a1]",
  profile:
    "flex items-center gap-3 mb-7.5 [&_strong]:block [&_strong]:text-[15px] [&_div>span]:block [&_div>span]:text-[12px] [&_div>span]:text-[color:var(--muted)] max-[760px]:m-[0] max-[760px]:[&>div]:flex-1",
  avatar:
    "grid place-items-center shrink-0 w-[45px] h-[45px] rounded-[50%] [border:2px_solid_#484e47] [background:linear-gradient(135deg,#f0f1ee,#b3b9b0)] shadow-[3px_4px_7px_#0003]",
  mobileToggle:
    "hidden max-[760px]:grid max-[760px]:place-items-center max-[760px]:w-[42px] max-[760px]:h-[42px] max-[760px]:[border:1px_solid_#fff6] max-[760px]:rounded-[12px] max-[760px]:[background:#d7dcd2] max-[760px]:text-[color:var(--text)] max-[760px]:shadow-[3px_3px_6px_#b4aea044]",
  search:
    "flex items-center gap-2 p-[10px_12px] rounded-[12px] shadow-[inset_2px_2px_4px_#93998e55,inset_-2px_-2px_4px_#ffffff70] text-[color:var(--muted)] [&_input]:min-w-0 [&_input]:w-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:[outline-offset:0]! [&_input]:text-[color:var(--text)] [&_input]:text-[13px] [&_button]:grid [&_button]:place-items-center [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-inherit [&_button]:p-0.5",
  navGroup:
    "p-[19px_0] [border-bottom:1px_solid_#afb5aa65] shadow-[0_1px_#ffffff4d] [&_ul]:list-none [&_ul]:m-[0] [&_ul]:p-[0] [&_ul]:grid [&_ul]:gap-[5px]",
  groupTitle:
    "flex justify-between items-center w-full p-[0_4px_10px] border-0 bg-transparent text-[color:var(--muted)] text-[12px]!",
  menuLink:
    "flex items-center gap-3 p-[11px_12px] min-h-11 [border:1px_solid_transparent] rounded-[11px] text-[13px] [&_svg]:shrink-0 [&:hover]:[background:#ffffff28] [&[aria-current]]:[background:linear-gradient(125deg,#e2e5df,#d0d6ce)] [&[aria-current]]:border-[#eff2eb90] [&[aria-current]]:shadow-[inset_1px_1px_3px_#fff8,4px_5px_10px_#8d978544] [&[aria-current]]:font-semibold",
  selectedDot:
    "ml-auto w-[7px] h-[7px] rounded-[50%] [background:#6a7c66] shadow-[0_0_0_5px_#ffffff38]",
  sidebarNote:
    "mt-10 p-[18px_5px] [&>span]:text-[9px] [&>span]:tracking-[2px] [&>span]:text-[color:var(--muted)] [&_strong]:block [&_strong]:m-[8px_0_4px] [&_strong]:text-[13px] [&_p]:text-[12px] [&_p]:text-[color:var(--muted)] max-[760px]:mt-4",
  noResults:
    "text-[12px] text-[color:var(--muted)] p-[20px_4px]",
  main:
    "min-w-0 flex-1 flex flex-col p-[26px_34px] rounded-[27px] [background:#f5f3ed] [border:1px_solid_#ffffff50] shadow-[inset_1px_1px_2px_#fff8] min-[1400px]:p-[28px_48px] max-[1100px]:p-6 max-[760px]:p-5 max-[760px]:rounded-[20px] max-[760px]:min-h-[70dvh] max-[440px]:p-4.5",
  topline:
    "flex justify-between items-center pb-[23px] [border-bottom:1px_solid_#a9b0a54d] text-[color:var(--muted)] text-[10px] tracking-[1.7px] max-[760px]:text-[9px]",
  badge:
    "p-[5px_12px] [border:1px_solid_#f6f7f180] rounded-[20px] [background:#eeece5] tracking-[0] text-[11px] whitespace-nowrap",
  page:
    "p-[35px_0_45px] max-[760px]:p-[27px_0]",
  pageHeader:
    "mb-7.5 [&_h1]:text-[clamp(24px,2.5vw,36px)] [&_h1]:font-medium [&_h1]:tracking-[-1px] [&_h1]:leading-[1.4] [&_h1]:mb-2.5 [&>p:last-child]:text-[13px] [&>p:last-child]:text-[color:var(--muted)] max-[760px]:[&_h1]:text-[27px]",
  eyebrow:
    "text-[10px] text-[color:var(--muted)] tracking-[1.7px] mb-3!",
  overviewBanner:
    "flex items-center gap-[17px] mb-[34px] p-[21px] [border:1px_solid_#ffffff55] rounded-[17px] [background:linear-gradient(125deg,#faf9f5,#eeece5)] shadow-[inset_1px_1px_3px_#fff9,5px_6px_14px_#b4aea033] [&_strong]:text-[15px] [&_strong]:font-medium [&_p]:text-[12px] [&_p]:text-[color:var(--muted)] [&_p]:mt-1 [&>span:last-child]:ml-auto max-[760px]:p-4 max-[760px]:gap-3 max-[760px]:[&>span:last-child]:hidden",
  sectionTitle:
    "flex justify-between items-center gap-[15px] text-[14px] font-medium mb-4! [&>span]:text-[11px] [&>span]:text-[color:var(--muted)] [&>span]:font-normal max-[760px]:[&>span]:text-[10px]",
  companyGrid:
    "grid grid-cols-2 gap-5 max-[760px]:gap-3.5 max-[440px]:grid-cols-1",
  companyCard:
    "block p-[25px] rounded-[20px] [background:linear-gradient(125deg,#faf9f5,#eeece5)] [border:1px_solid_#f4f6ee80] shadow-[7px_7px_15px_#b4aea044,-4px_-4px_12px_#ffffff55] [transition:transform_.2s,box-shadow_.2s] [&:hover]:[transform:translateY(-3px)] [&:hover]:shadow-[9px_12px_20px_#b4aea066,-4px_-4px_12px_#ffffff70] [&_h2]:text-[18px] [&_h2]:font-medium [&_h2]:mb-2 [&_p]:text-[12px] [&_p]:text-[color:var(--muted)] [&_p]:min-h-10 max-[1100px]:p-5 max-[760px]:p-4.5 max-[440px]:[&_p]:min-h-0 motion-reduce:[&:hover]:[transform:none]",
  cardTop:
    "flex justify-between items-center mb-6 max-[440px]:mb-[17px]",
  cardIcon:
    "grid place-items-center w-[51px] h-[51px] shrink-0 rounded-[14px] [background:linear-gradient(140deg,#ffffff,#e5e2d8)] shadow-[inset_1px_1px_2px_#fff,3px_4px_7px_#aaa39140]",
  cardNumber:
    "text-[11px] text-[color:var(--muted)] tracking-[2px]",
  cardBottom:
    "flex justify-between items-center mt-[23px] pt-[15px] [border-top:1px_solid_#a8b09f55] text-[11px]",
  footer:
    "flex justify-between gap-3 mt-auto pt-5 [border-top:1px_solid_#a9b0a54d] text-[9px] tracking-[1.3px] text-[color:var(--muted)] [&_span]:tracking-[0]",
  stats:
    "grid grid-cols-2 gap-4 mb-[34px] min-[1400px]:grid-cols-4 max-[440px]:gap-2.5",
  stat:
    "p-5 rounded-[16px] shadow-[inset_2px_2px_5px_#b4aea044,inset_-3px_-3px_7px_#ffffff85] [background:#eeece5] [&>span]:block [&>span]:text-[12px] [&>span]:text-[color:var(--muted)] [&_strong]:block [&_strong]:text-[30px] [&_strong]:font-normal [&_strong]:m-[9px_0] [&_small]:text-[10px] [&_small]:text-[color:var(--muted)] max-[440px]:p-[15px]",
  sections:
    "grid gap-7",
  quickGrid:
    "grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1",
  quickLink:
    "flex items-center gap-3 p-[17px] rounded-[13px] [border:1px_solid_#ffffff60] shadow-[3px_4px_8px_#a3aa9b40,-2px_-2px_7px_#ffffff55] text-[12px] [&>span]:flex-1 [&:hover]:[background:#faf9f5]",
  empty:
    "flex flex-col items-center gap-4.5 text-center p-[65px_24px] rounded-[20px] shadow-[inset_2px_2px_6px_#b4aea033,inset_-3px_-3px_8px_#ffffff80] [&_h2]:text-[19px] [&_h2]:font-medium [&_p]:max-w-[400px] [&_p]:text-[13px] [&_p]:text-[color:var(--muted)]",
  backLink:
    "flex gap-3 items-center text-[12px] mt-2.5",
  menu:
    "max-[760px]:pt-5",
  menuOpen:
    "max-[760px]:block",
} as const;
