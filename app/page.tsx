"use client";

import React, { useState, MouseEvent, useRef, useEffect } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";

import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  Eye,
  Home,
  PenTool,
  Wrench,
  MapPin,
  Phone,
  Mail,
  Menu,
  X,
} from "lucide-react";

// --- Types ---
type Category = "all" | "construction" | "renovation" | "design";

interface Project {
  id: number;
  title: string;
  category: Category;
  categoryLabel: string;
  img: string;
  alt: string;
}

// --- Data ---
const projects: Project[] = [
  {
    id: 1,
    title: "Modern Luxury Villa",
    category: "construction",
    categoryLabel: "ก่อสร้างใหม่",
    img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop&grayscale=true",
    alt: "",
  },
  {
    id: 2,
    title: "Loft Space Extension",
    category: "renovation",
    categoryLabel: "ต่อเติม & รีโนเวท",
    img: "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=2069&auto=format&fit=crop&grayscale=true",
    alt: "",
  },
  {
    id: 3,
    title: "Minimalist Interior",
    category: "design",
    categoryLabel: "ออกแบบ",
    img: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=2070&auto=format&fit=crop&grayscale=true",
    alt: "",
  },
  {
    id: 4,
    title: "Commercial HQ",
    category: "construction",
    categoryLabel: "ก่อสร้างใหม่",
    img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop&grayscale=true",
    alt: "",
  },
  {
    id: 5,
    title: "Kitchen Renovation",
    category: "renovation",
    categoryLabel: "ต่อเติม & รีโนเวท",
    img: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=2070&auto=format&fit=crop&grayscale=true",
    alt: "",
  },
  {
    id: 6,
    title: "Architectural Blueprint",
    category: "design",
    categoryLabel: "ออกแบบ",
    img: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2071&auto=format&fit=crop&grayscale=true",
    alt: "",
  },
];

const navLinks = [
  { href: "#info", label: "หน้าหลัก" },
  { href: "#about", label: "เกี่ยวกับเรา" },
  { href: "#vision", label: "วิสัยทัศน์" },
  { href: "#service", label: "บริการ" },
  { href: "#portfolio", label: "ผลงาน" },
];

const menuVariants = {
  open: { opacity: 1, backdropFilter: "blur(8px)" },
  closed: { opacity: 0, backdropFilter: "blur(0px)" },
};

function Button({
  variant: _variant,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return <button type="button" {...props} />;
}

function LeadForm() {
  const [prepared, setPrepared] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = `ชื่อ: ${data.get("name")}\nโทรศัพท์: ${data.get("phone")}\nอีเมล: ${data.get("email")}\nบริการ: ${data.get("service")}\n\n${data.get("message")}`;
    window.location.href = `mailto:info@obnithi.co.th?subject=${encodeURIComponent(`ปรึกษาโครงการ — ${data.get("service")}`)}&body=${encodeURIComponent(body)}`;
    setPrepared(true);
  }

  return (
    <form onSubmit={submit} className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
      <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-zinc-400">TELL US ABOUT YOUR PROJECT</p>
      <h3 className="mb-2 text-2xl font-semibold text-white">เริ่มต้นโปรเจกต์ของคุณ</h3>
      <p className="mb-6 text-sm leading-6 text-zinc-400">เล่าความต้องการเบื้องต้น แล้วมาคุยถึงความเป็นไปได้ด้วยกัน</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-zinc-300">ชื่อผู้ติดต่อ *<input name="name" autoComplete="name" placeholder="ชื่อ–นามสกุล" required maxLength={120} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-600" /></label>
        <label className="grid gap-2 text-sm text-zinc-300">เบอร์โทรศัพท์ *<input name="phone" type="tel" autoComplete="tel" placeholder="เบอร์ที่สะดวกให้ติดต่อ" required maxLength={30} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-600" /></label>
      </div>
      <label className="mt-4 grid gap-2 text-sm text-zinc-300">อีเมล<input name="email" type="email" autoComplete="email" placeholder="you@example.com" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-600" /></label>
      <label className="mt-4 grid gap-2 text-sm text-zinc-300">บริการที่สนใจ *<select name="service" defaultValue="" required className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"><option value="" disabled>เลือกบริการ</option><option>ก่อสร้างใหม่</option><option>ต่อเติม & รีโนเวท</option><option>ออกแบบ</option></select></label>
      <label className="mt-4 grid gap-2 text-sm text-zinc-300">รายละเอียดโครงการ *<textarea name="message" rows={4} required maxLength={2000} placeholder="ประเภทพื้นที่ ขนาดโดยประมาณ หรือไอเดียที่คุณมี..." className="resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-600" /></label>
      <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200">เตรียมอีเมลปรึกษาโครงการ <ArrowUpRight size={18} /></button>
      <p className="mt-3 text-xs leading-5 text-zinc-500">เปิดแอปอีเมลของคุณเพื่อทบทวนและส่งข้อความถึงทีมงาน</p>
      {prepared && <p role="status" className="mt-3 flex items-start gap-2 text-sm text-emerald-300"><Check size={16} /> เตรียมข้อความแล้ว กรุณากดส่งในแอปอีเมล หากแอปไม่เปิด โทร 061-636-6225 ได้เลย</p>}
    </form>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 px-6 py-8 text-zinc-400">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a href="#info" className="font-bold tracking-tight text-white">OBNITHI <span className="font-light text-zinc-400">CON</span></a>
        <p className="m-0 text-xs tracking-[0.16em]">DESIGN · BUILD · RENOVATE</p>
        <a href="#info" className="text-sm hover:text-white">กลับสู่ด้านบน ↑</a>
      </div>
    </footer>
  );
}

function ContactFloating() {
  return (
    <a href="tel:+66616366225" aria-label="โทรปรึกษาโครงการ 061-636-6225" className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-black shadow-xl transition hover:scale-105 hover:bg-zinc-200">
      <Phone size={18} /> <span>ปรึกษาเรา</span>
    </a>
  );
}

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState<Category>("all");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [navTheme, setNavTheme] = useState<"light" | "dark">("light");

  // --- Framer Motion Setup ---
  const scrollRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  const yHero = useTransform(scrollY, [0, 800], [0, 250]);
  const opacityHero = useTransform(scrollY, [0, 500], [1, 0]);

  // อัปเดตสถานะการ Scroll เพื่อเปลี่ยน ธีม Navbar
  useEffect(() => {
    const handleScrollTheme = (latest: number) => {
      setIsScrolled(latest > 50);
      if (typeof window !== "undefined") {
        // เปลี่ยนเป็นธีมสว่าง (dark theme nav) เมื่อเลื่อนพ้นหน้า Info
        setNavTheme(latest > window.innerHeight * 0.8 ? "dark" : "light");
      }
    };
    const unsubscribe = scrollY.on("change", handleScrollTheme);
    return () => unsubscribe();
  }, [scrollY]);

  // --- Profile Data for Hero Section ---
  const profile = {
    hero: {
      videoUrl: "/preview/file.mp4",
      title: "OBNITHI.",
      description:
        "ยกระดับที่อยู่อาศัยและอาคารพาณิชย์ของคุณ ด้วยทีมงานรับเหมาก่อสร้างและรีโนเวทมืออาชีพ",
    },
  };

  // กรองผลงานตามหมวดหมู่
  const filteredProjects = projects.filter((project) =>
    activeFilter === "all" ? true : project.category === activeFilter,
  );

  // ฟังก์ชันจัดการการคลิกเมนูแล้วเลื่อนแบบ Smooth
  const handleScrollTo = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false); // ปิดเมนูมือถือเมื่อคลิก

    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="font-sans text-zinc-300 bg-black selection:bg-white selection:text-black min-h-screen">
      {/* Ambient Background Glows (สร้างมิติแสงสะท้อนให้ Liquid Glass) */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-700/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-800/30 rounded-full blur-[120px]"></div>
        <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] bg-white/5 rounded-full blur-[100px]"></div>
      </div>

      {/* Header / Navigation (Framer Motion Animated) */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "circOut" }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          isScrolled ? "py-2" : "py-6"
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 relative">
          <nav
            className={`mx-auto max-w-7xl flex items-center justify-between px-6 py-4 rounded-full transition-all duration-500 border relative z-50
                    ${
                      isMobileMenuOpen
                        ? "bg-white border-transparent shadow-none"
                        : isScrolled
                          ? navTheme === "dark"
                            ? "bg-white/80 backdrop-blur-md border-black/5 shadow-lg"
                            : "bg-black/60 backdrop-blur-md border-white/10 shadow-lg"
                          : "bg-transparent border-transparent"
                    }
                    `}
          >
            {/* Logo */}
            <a
              href="#info"
              onClick={(e) => handleScrollTo(e, "info")}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500
                        ${isMobileMenuOpen ? "bg-black text-white" : navTheme === "dark" ? "bg-black text-white" : "bg-white text-black"}
                        `}
              >
                <span className="font-black text-xl">O</span>
              </div>
              <span
                className={`font-black tracking-tighter text-lg transition-colors duration-500
                        ${isMobileMenuOpen ? "text-black" : navTheme === "dark" ? "text-black" : "text-white"}
                        `}
              >
                OBNITHI <span className="font-light opacity-60">CON</span>
              </span>
            </a>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleScrollTo(e, link.href.substring(1))}
                  className={`px-5 py-2.5 text-sm font-medium transition-all rounded-full relative group overflow-hidden duration-500
                            ${
                              navTheme === "dark"
                                ? "text-gray-600 hover:text-black hover:bg-black/5"
                                : "text-gray-300 hover:text-white hover:bg-white/10"
                            }
                        `}
                >
                  <span className="relative z-10">{link.label}</span>
                </a>
              ))}

              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="#contact"
                onClick={(e) => handleScrollTo(e, "contact")}
                className={`px-6 py-2.5 text-sm font-bold rounded-full transition-colors duration-500
                        ${
                          navTheme === "dark"
                            ? "bg-black text-white hover:bg-gray-800"
                            : "bg-white text-black hover:bg-gray-200"
                        }
                        `}
              >
                ติดต่อเรา
              </motion.a>
            </div>

            {/* Mobile Menu Button */}
            <Button variant="unstyled" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`relative z-[70] md:hidden p-2 rounded-full transition-colors duration-500
                        ${isMobileMenuOpen ? "text-black hover:bg-black/5" : navTheme === "dark" ? "text-black hover:bg-black/5" : "text-white hover:bg-white/10"}
                    `}>
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </nav>

          {/* --- MOBILE MENU OVERLAY --- */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial="closed"
                animate="open"
                exit="closed"
                variants={menuVariants}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center touch-none"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md mt-24 mx-4 bg-white rounded-3xl shadow-2xl pt-10 px-6 pb-10"
                >
                  <div className="flex flex-col gap-3">
                    {navLinks.map((link, index) => (
                      <motion.a
                        key={link.href}
                        href={link.href}
                        onClick={(e) =>
                          handleScrollTo(e, link.href.substring(1))
                        }
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 + index * 0.06 }}
                        className="text-2xl font-bold text-black hover:text-gray-600 transition-colors py-3 border-b border-gray-100"
                      >
                        {link.label}
                      </motion.a>
                    ))}

                    <motion.a
                      href="#contact"
                      onClick={(e) => handleScrollTo(e, "contact")}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="px-6 py-4 text-lg font-semibold bg-black text-white text-center rounded-2xl hover:bg-gray-800 transition-all shadow-lg"
                    >
                      ติดต่อเรา
                    </motion.a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      {/* Main Scroll Container */}
      <main
        ref={scrollRef}
        className="h-screen overflow-y-auto snap-y snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative z-10"
      >
        {/* 1. Info Section (Framer Motion Hero) */}
        <section
          id="info"
          className="snap-start relative h-screen w-full flex items-center justify-center overflow-hidden bg-black"
        >
          <div className="absolute inset-0 w-full h-full bg-black/50 z-[1]" />
          <motion.div
            style={{ y: yHero, opacity: opacityHero }}
            className="absolute inset-0 w-full h-full"
          >
            {profile?.hero.videoUrl && (
              <video
                className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale scale-110"
                src={profile.hero.videoUrl}
                autoPlay
                muted
                loop
                playsInline
              />
            )}
          </motion.div>

          <div className="relative z-10 container max-w-7xl mx-auto px-6 text-center lg:text-left pt-20">
            <motion.h1
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white mb-8 mix-blend-overlay"
            >
              {profile?.hero.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
              className="text-xl md:text-2xl text-gray-300 font-light max-w-2xl leading-relaxed mb-12"
            >
              {profile?.hero.description}
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start"
            >
              <Button variant="unstyled" onClick={() =>
                  document
                    .getElementById("portfolio")
                    ?.scrollIntoView({ behavior: "smooth" })
                } className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-all text-center">
                ผลงานของเรา
              </Button>
            </motion.div>
          </div>

          {/* ลูกศรชี้ลงเพื่อให้รู้ว่ามีเนื้อหาถัดไป */}
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce text-zinc-400 z-20">
            <ChevronDown className="w-8 h-8 font-light" />
          </div>
        </section>

        {/* 2. About Section (Minimal Dark) */}
        <section
          id="about"
          className="min-h-screen snap-start relative flex items-center justify-center py-24 md:py-32"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1 relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-3xl z-10"></div>
                <Image
                  src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2071&auto=format&fit=crop&grayscale=true"
                  alt=""
                  width={2071}
                  height={2071}
                  className="rounded-3xl shadow-2xl object-cover h-[400px] md:h-[500px] w-full border border-white/5"
                />
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-xs font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4 flex items-center gap-4">
                  <span className="w-8 h-[1px] bg-zinc-500"></span>
                  เกี่ยวกับเรา
                </h2>
                <h3 className="text-4xl md:text-5xl font-light text-white mb-8 leading-tight">
                  Crafting Solid
                  <br />
                  <span className="font-bold">Foundations.</span>
                </h3>
                <p className="text-zinc-400 text-lg mb-10 font-light leading-relaxed">
                  เราคือบริษัทรับเหมาก่อสร้างที่ใส่ใจในทุกรายละเอียด
                  ตั้งแต่งานโครงสร้างไปจนถึงสถาปัตยกรรมภายใน
                  ทุกขั้นตอนถูกควบคุมโดยวิศวกรและช่างผู้ชำนาญการ
                  เพื่อส่งมอบผลงานที่แข็งแรง ทนทาน และงดงาม
                </p>

                {/* Glass Stats */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
                    <h4 className="text-4xl font-bold text-white mb-2">10+</h4>
                    <p className="text-zinc-500 text-sm tracking-wider uppercase">
                      Years Experience
                    </p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
                    <h4 className="text-4xl font-bold text-white mb-2">200+</h4>
                    <p className="text-zinc-500 text-sm tracking-wider uppercase">
                      Projects Done
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Vision Section (Parallax Black/White) */}
        <section
          id="vision"
          className="h-screen snap-start relative flex items-center justify-center text-center bg-[url('https://images.unsplash.com/photo-1541888081-309117604128?q=80&w=2071&auto=format&fit=crop')] bg-fixed bg-center bg-cover"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"></div>
          <div className="relative z-10 px-8 py-20 max-w-4xl mx-auto text-white bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl">
            <Eye className="w-12 h-12 mx-auto mb-8 text-zinc-400 font-light" />
            <h2 className="text-xs font-bold text-zinc-500 tracking-[0.3em] uppercase mb-6">
              วิสัยทัศน์ของเรา
            </h2>
            <h3 className="text-3xl md:text-5xl font-light mb-8 leading-tight">
              &ldquo;Building your dreams
              <br />
              <span className="font-bold">into lasting reality.&rdquo;</span>
            </h3>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto font-light">
              เปลี่ยนความฝันและแบบแปลนให้กลายเป็นพื้นที่จริงที่สัมผัสได้
              ด้วยรากฐานที่มั่นคงและดีไซน์ที่ยั่งยืน
            </p>
          </div>
        </section>

        {/* 4. Service Section (Liquid Cards) */}
        <section
          id="service"
          className="min-h-screen snap-start relative flex items-center justify-center py-24 md:py-32"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 mt-10 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
              <div>
                <h2 className="text-xs font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4 flex items-center gap-4">
                  <span className="w-8 h-[1px] bg-zinc-500"></span>
                  บริการของเรา
                </h2>
                <h3 className="text-4xl md:text-5xl font-light text-white">
                  Premium <span className="font-bold">Solutions.</span>
                </h3>
              </div>
              <p className="text-zinc-400 max-w-md text-sm md:text-base font-light">
                บริการรับเหมาก่อสร้างและต่อเติมแบบครบวงจร (Turnkey)
                ดำเนินงานอย่างมีมาตรฐานและตรงต่อเวลา
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Service 1 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-3xl hover:bg-white/10 hover:-translate-y-2 transition-all duration-500 group">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white group-hover:text-black transition-all duration-500">
                  <Home className="w-8 h-8 text-white group-hover:text-black transition-colors" />
                </div>
                <h4 className="text-2xl font-light text-white mb-4">
                  Building <br />
                  <span className="font-bold">Construction</span>
                </h4>
                <p className="text-zinc-400 font-light leading-relaxed">
                  รับเหมาก่อสร้างบ้าน อาคารพาณิชย์ และโรงงาน
                  ควบคุมงานโดยวิศวกรผู้เชี่ยวชาญทุกขั้นตอน
                </p>
              </div>

              {/* Service 2 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-3xl hover:bg-white/10 hover:-translate-y-2 transition-all duration-500 group">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white group-hover:text-black transition-all duration-500">
                  <Wrench className="w-8 h-8 text-white group-hover:text-black transition-colors" />
                </div>
                <h4 className="text-2xl font-light text-white mb-4">
                  Renovation & <br />
                  <span className="font-bold">Extension</span>
                </h4>
                <p className="text-zinc-400 font-light leading-relaxed">
                  บริการรีโนเวท ปรับปรุง และต่อเติมพื้นที่เดิมให้สวยงาม ทันสมัย
                  และตอบโจทย์การใช้งานใหม่
                </p>
              </div>

              {/* Service 3 */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-3xl hover:bg-white/10 hover:-translate-y-2 transition-all duration-500 group">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white group-hover:text-black transition-all duration-500">
                  <PenTool className="w-8 h-8 text-white group-hover:text-black transition-colors" />
                </div>
                <h4 className="text-2xl font-light text-white mb-4">
                  Interior & <br />
                  <span className="font-bold">Architecture</span>
                </h4>
                <p className="text-zinc-400 font-light leading-relaxed">
                  ออกแบบสถาปัตยกรรมและตกแต่งภายใน
                  สร้างสรรค์สเปซที่สะท้อนตัวตนและไลฟ์สไตล์ของคุณ
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Portfolio Section */}
        <section
          id="portfolio"
          className="min-h-screen snap-start relative flex flex-col items-center justify-center py-24 md:py-32"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 mt-10 md:mt-0">
            <div className="text-center mb-12">
              <h2 className="text-xs font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4 flex justify-center items-center gap-4">
                <span className="w-8 h-[1px] bg-zinc-500"></span>
                ผลงานของเรา
                <span className="w-8 h-[1px] bg-zinc-500"></span>
              </h2>
              <h3 className="text-4xl md:text-5xl font-light text-white">
                Selected <span className="font-bold">Works.</span>
              </h3>
            </div>

            {/* Liquid Filter Buttons */}
            <div className="flex flex-wrap justify-center gap-3 mb-16">
              {(
                ["all", "construction", "renovation", "design"] as Category[]
              ).map((cat) => (
                <Button variant="unstyled" key={cat} onClick={() => setActiveFilter(cat)} className={`px-8 py-3 rounded-full border backdrop-blur-md transition-all duration-300 text-sm tracking-wider uppercase ${
                    activeFilter === cat
                      ? "bg-white text-black border-white"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}>
                  {cat === "all"
                    ? "All"
                    : cat === "construction"
                      ? "ก่อสร้างใหม่"
                      : cat === "renovation"
                        ? "รีโนเวท & ต่อเติม"
                        : "ออกแบบ"}
                </Button>
              ))}
            </div>

            {/* Portfolio Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="group relative overflow-hidden rounded-3xl bg-zinc-900 border border-white/5 transition-all duration-700 hover:border-white/20"
                >
                  <Image
                    src={project.img}
                    alt={project.alt}
                    width={800}
                    height={600}
                    className="w-full h-72 md:h-96 object-cover transform group-hover:scale-105 transition-transform duration-1000 opacity-80 group-hover:opacity-100"
                  />
                  {/* Glass Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
                  <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col justify-end translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                    <p className="text-xs text-zinc-400 tracking-[0.2em] uppercase mb-2">
                      {project.categoryLabel}
                    </p>
                    <h4 className="text-2xl font-light text-white">
                      {project.title}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Contact & Form Section (Glassmorphism Form) */}
        <section
          id="contact"
          className="min-h-screen snap-start relative flex flex-col justify-center py-24 md:py-32 bg-black overflow-hidden"
        >
          {/* --- Ambient Background Decor (Liquid Glass Effect) --- */}
          <div className="absolute top-1/4 -right-20 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 -left-20 w-[400px] h-[400px] bg-white/[0.02] rounded-full blur-[100px] pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-10 md:mt-0 flex-grow flex items-center relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 w-full items-center">
              {/* --- Contact Info (Left Column) --- */}
              <div className="flex flex-col justify-center">
                <h2 className="text-[10px] font-bold text-zinc-500 tracking-[0.4em] uppercase mb-6 flex items-center gap-4">
                  <span className="w-12 h-[1px] bg-zinc-700"></span>
                  สถานที่ติดต่อ
                </h2>
                <h3 className="text-4xl md:text-5xl font-light text-white mb-8 leading-tight tracking-tight">
                  Let&apos;s build something
                  <br />
                  <span className="font-bold">extraordinary.</span>
                </h3>
                <p className="text-zinc-400 mb-12 text-base md:text-lg font-light leading-relaxed max-w-md">
                  เริ่มต้นโปรเจกต์ของคุณด้วยดีไซน์ที่แตกต่าง
                  ติดต่อเราเพื่อพูดคุยถึงความเป็นไปได้ใหม่ๆ
                </p>

                <div className="space-y-8">
                  {/* Office */}
                  <div className="flex items-start space-x-6 group">
                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-white group-hover:text-black transition-all duration-500 shadow-lg">
                      <MapPin className="w-5 h-5 text-zinc-400 group-hover:text-black transition-colors" />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                        Office
                      </h5>
                      <p className="text-zinc-300 font-light leading-relaxed">
                        989 Moo 9 Ban Dongjen, TumBol PhoKarmyaw,
                        <br />
                        AumPho Meang, Phauyao
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start space-x-6 group">
                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-white group-hover:text-black transition-all duration-500 shadow-lg">
                      <Mail className="w-5 h-5 text-zinc-400 group-hover:text-black transition-colors" />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                        Email
                      </h5>
                      <p className="text-zinc-300 font-light">
                        info@obnithi.co.th
                      </p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start space-x-6 group">
                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-white group-hover:text-black transition-all duration-500 shadow-lg">
                      <Phone className="w-5 h-5 text-zinc-400 group-hover:text-black transition-colors" />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                        Phone
                      </h5>
                      <p className="text-zinc-300 font-light text-lg mb-1">
                        061-636-6225{" "}
                        <span className="text-zinc-600 text-sm ml-2">
                          (OHMz)
                        </span>
                      </p>
                      <p className="text-zinc-300 font-light text-lg">
                        099-8875-076{" "}
                        <span className="text-zinc-600 text-sm ml-2">
                          (OBz)
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Location Map (Redesigned) */}
                  <div className="pt-6 mt-6 border-t border-white/10">
                    <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <MapPin className="w-3 h-3" /> Location Map
                    </h5>
                    <div className="w-full h-48 rounded-2xl overflow-hidden border border-white/10 relative group shadow-2xl">
                      {/* Black overlay effect that disappears on hover */}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all duration-500 pointer-events-none z-10"></div>
                      <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3875.040246925047!2d100.5768939758643!3d13.72694859250046!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30e29b8c7c8c8c8c%3A0x8c8c8c8c8c8c8c8c!2sObnithicon%20Co.%2C%20Ltd.!5e0!3m2!1sen!2sth!4v1679999999999"
                        className="w-full h-full border-0 filter grayscale hover:grayscale-0 transition-all duration-700 relative z-0"
                        loading="lazy"
                        title="Office Location Map"
                      ></iframe>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Contact Form (Right Column - Liquid Glass) --- */}
              <div className="relative">
                {/* Form Container */}
                <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 p-6 sm:p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] relative z-10">
                  <LeadForm />
                </div>
                {/* Subtle glow behind the form container */}
                <div className="absolute -inset-4 bg-gradient-to-tr from-white/5 to-transparent blur-2xl -z-10 opacity-50 rounded-[3rem]"></div>
              </div>
            </div>
          </div>

          <Footer />
        </section>

        <ContactFloating />
      </main>
    </div>
  );
}
