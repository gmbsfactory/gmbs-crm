"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ============================================================================
// DESIGN SYSTEM - Nexflow CRM Premium Landing
// ============================================================================
// Colors: Sky blue trust (#0EA5E9) + Violet accent (#8B5CF6) + Orange CTA (#F97316)
// Typography: Inter (system font)
// Style: Glassmorphism + Gradient Mesh + Social Proof Focused
// ============================================================================

// ============================================================================
// ANIMATED COUNTER HOOK
// ============================================================================
function useCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!startOnView || !isInView || hasStarted.current) return;
    hasStarted.current = true;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration, isInView, startOnView]);

  return { count, ref };
}

// ============================================================================
// ICONS (Lucide-style SVGs)
// ============================================================================
const Icons = {
  Bolt: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Check: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  ArrowRight: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
  Play: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  Star: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  Menu: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  X: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Users: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  Chart: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  Calendar: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  Euro: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5H5.25m2.25 3H5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Mail: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  Shield: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  Clock: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Building: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  ShoppingCart: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  Briefcase: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  ),
  Home: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  ),
  Sparkles: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  TrendingUp: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h2l3-9 4 18 3-9h10M22 12h-2" />
    </svg>
  ),
};

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }
  }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }
  }
};

// ============================================================================
// ANIMATED GRADIENT BACKGROUND
// ============================================================================
function AnimatedGradientBg() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50 to-violet-50" />

      {/* Animated blobs */}
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 -left-20 w-[500px] h-[500px] bg-gradient-to-br from-sky-400/30 to-cyan-300/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -80, 0],
          y: [0, 100, 0],
          scale: [1.2, 1, 1.2],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 -right-20 w-[600px] h-[600px] bg-gradient-to-br from-violet-400/25 to-purple-300/15 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, 50, 0],
          y: [0, -80, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-gradient-to-br from-orange-300/20 to-amber-200/10 rounded-full blur-3xl"
      />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
    </div>
  );
}

// ============================================================================
// FLOATING GLASS CARD
// ============================================================================
function FloatingCard({
  children,
  className = "",
  delay = 0
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl shadow-slate-900/5 rounded-2xl ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// NAVBAR
// ============================================================================
function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { scrollY } = useScroll();

  const bgOpacity = useTransform(scrollY, [0, 100], [0, 1]);
  const blur = useTransform(scrollY, [0, 100], [0, 20]);

  return (
    <>
      <motion.nav
        className="fixed top-4 left-4 right-4 z-50 rounded-2xl transition-shadow"
        style={{
          backgroundColor: useTransform(bgOpacity, (v) => `rgba(255, 255, 255, ${v * 0.9})`),
          backdropFilter: useTransform(blur, (v) => `blur(${v}px)`),
          boxShadow: useTransform(bgOpacity, (v) =>
            v > 0.5 ? `0 4px 30px rgba(0, 0, 0, ${v * 0.1})` : 'none'
          ),
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-500/25 group-hover:shadow-sky-500/40 transition-shadow">
                <Icons.Bolt className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold">
                <span className="text-slate-900">Nex</span>
                <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">flow</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {["Fonctionnalités", "Secteurs", "Tarifs", "Témoignages"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
                  className="text-slate-600 hover:text-sky-600 font-medium transition-colors cursor-pointer"
                >
                  {item}
                </a>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-slate-600 hover:text-sky-600 font-medium transition-colors cursor-pointer"
              >
                Connexion
              </Link>
              <Link
                href="#cta"
                className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
              >
                Essai gratuit
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-sky-600 cursor-pointer"
              aria-label="Menu"
            >
              {isOpen ? <Icons.X /> : <Icons.Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 rounded-b-2xl overflow-hidden"
            >
              <div className="px-4 py-4 space-y-3">
                {["Fonctionnalités", "Secteurs", "Tarifs", "Témoignages"].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-slate-600 hover:text-sky-600 font-medium cursor-pointer"
                  >
                    {item}
                  </a>
                ))}
                <hr className="border-slate-200" />
                <Link href="/login" className="block py-2 text-slate-600 font-medium cursor-pointer">
                  Connexion
                </Link>
                <Link
                  href="#cta"
                  onClick={() => setIsOpen(false)}
                  className="block py-3 bg-gradient-to-r from-sky-500 to-violet-600 text-white font-semibold rounded-xl text-center cursor-pointer"
                >
                  Essai gratuit
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </>
  );
}

// ============================================================================
// HERO SECTION
// ============================================================================
function HeroSection() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <section className="relative min-h-screen flex items-center pt-24 overflow-hidden">
      <AnimatedGradientBg />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            style={{ y, opacity }}
            className="text-center lg:text-left"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              {/* Badge */}
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-sky-100 shadow-sm mb-6"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-sm font-medium text-slate-600">
                  +5 000 entreprises nous font confiance
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-6"
              >
                Le CRM qui{" "}
                <span className="bg-gradient-to-r from-sky-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">
                  propulse
                </span>
                <br />votre croissance
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                variants={fadeInUp}
                className="text-lg sm:text-xl text-slate-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed"
              >
                Nexflow centralise vos clients, ventes et interventions dans une plateforme intuitive.{" "}
                <span className="font-semibold text-slate-800">
                  BTP, commerce, services
                </span>{" "}
                — tous les secteurs, une seule solution.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10"
              >
                <Link
                  href="#cta"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-sky-500 to-violet-600 text-white font-semibold rounded-2xl shadow-xl shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                  Démarrer gratuitement
                  <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/80 backdrop-blur-sm text-slate-700 font-semibold rounded-2xl border-2 border-slate-200 hover:border-sky-300 hover:text-sky-600 transition-all cursor-pointer">
                  <Icons.Play className="w-5 h-5" />
                  Voir la démo
                </button>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                variants={fadeInUp}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[
                      "bg-gradient-to-br from-sky-400 to-sky-600",
                      "bg-gradient-to-br from-violet-400 to-violet-600",
                      "bg-gradient-to-br from-amber-400 to-amber-600",
                      "bg-gradient-to-br from-emerald-400 to-emerald-600",
                    ].map((bg, i) => (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-full ${bg} border-2 border-white shadow-sm`}
                      />
                    ))}
                  </div>
                  <span className="text-slate-600">+5 000 utilisateurs</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex text-amber-400">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Icons.Star key={i} className="w-5 h-5" />
                    ))}
                  </div>
                  <span className="text-slate-600 ml-1">4.9/5 sur 500+ avis</span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Right Content - Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Main Dashboard Card */}
            <FloatingCard className="p-5 sm:p-6" delay={0.2}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center">
                    <Icons.Chart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Tableau de bord</h3>
                    <p className="text-sm text-slate-500">Temps réel</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Live
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: "Chiffre d'affaires", value: "127.5k€", change: "+24%", color: "sky" },
                  { label: "Nouveaux clients", value: "342", change: "+18%", color: "violet" },
                  { label: "Taux conversion", value: "32%", change: "+5pts", color: "emerald" },
                  { label: "Satisfaction", value: "98%", change: "Stable", color: "amber" },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border ${
                      i < 2
                        ? `bg-gradient-to-br from-${stat.color}-50 to-white border-${stat.color}-100`
                        : "bg-white border-slate-100"
                    }`}
                  >
                    <p className="text-sm text-slate-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <span className={`text-xs font-semibold ${
                      stat.change.includes('+') || stat.change === 'Stable'
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    } flex items-center gap-1`}>
                      {stat.change.includes('+') && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      )}
                      {stat.change}
                    </span>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="h-32 bg-gradient-to-br from-slate-50 to-white rounded-xl flex items-end justify-around p-4 gap-2">
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.8, delay: 0.8 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className={`w-8 rounded-lg ${
                      i % 2 === 0
                        ? "bg-gradient-to-t from-sky-500 to-sky-300"
                        : "bg-gradient-to-t from-violet-500 to-violet-300"
                    }`}
                  />
                ))}
              </div>
            </FloatingCard>

            {/* Floating Card - New Lead */}
            <motion.div
              initial={{ opacity: 0, y: 20, x: -20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 max-w-[200px]"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Icons.Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Nouveau lead</p>
                  <p className="text-xs text-slate-500">Il y a 2 min</p>
                </div>
              </div>
              <p className="text-xs text-slate-600">Sophie Martin - Demande devis</p>
            </motion.div>

            {/* Floating Card - Deal Won */}
            <motion.div
              initial={{ opacity: 0, y: -20, x: 20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="absolute -top-2 -right-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <Icons.Check className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Affaire conclue</p>
                  <p className="text-xs text-emerald-600 font-medium">+12 500€</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// LOGOS SECTION
// ============================================================================
function LogosSection() {
  const logos = ["TechCorp", "BuildMax", "RetailPro", "ServiceHub", "GrowthCo"];

  return (
    <section className="py-12 bg-slate-50/80 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-sm font-medium text-slate-500 mb-8"
        >
          Ils nous font confiance
        </motion.p>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="flex flex-wrap items-center justify-center gap-8 md:gap-16"
        >
          {logos.map((logo, i) => (
            <motion.div
              key={logo}
              variants={fadeIn}
              className="text-2xl font-bold text-slate-300 hover:text-slate-400 transition-colors cursor-pointer"
            >
              {logo}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FEATURES SECTION
// ============================================================================
function FeaturesSection() {
  const features = [
    {
      icon: Icons.Users,
      title: "Gestion des contacts",
      description: "Base de données clients et prospects centralisée. Historique complet des interactions et segmentation intelligente.",
      highlights: ["Import/Export CSV", "Tags personnalisés", "Recherche avancée"],
      gradient: "from-sky-500 to-sky-600",
    },
    {
      icon: Icons.Chart,
      title: "Pipeline de ventes",
      description: "Visualisez vos opportunités en Kanban. Suivez chaque étape du cycle de vente et identifiez les blocages.",
      highlights: ["Vue Kanban drag & drop", "Prévisions automatiques", "Alertes personnalisées"],
      gradient: "from-violet-500 to-violet-600",
    },
    {
      icon: Icons.Calendar,
      title: "Planning & Interventions",
      description: "Planifiez vos rendez-vous et interventions. Assignez vos équipes et suivez l'avancement en temps réel.",
      highlights: ["Calendrier partagé", "Notifications SMS/Email", "Géolocalisation"],
      gradient: "from-emerald-500 to-emerald-600",
    },
    {
      icon: Icons.Euro,
      title: "Devis & Facturation",
      description: "Créez des devis professionnels en quelques clics. Transformez-les en factures et suivez vos paiements.",
      highlights: ["Templates personnalisables", "Signature électronique", "Relances automatiques"],
      gradient: "from-amber-500 to-amber-600",
    },
    {
      icon: Icons.Mail,
      title: "Email & Communication",
      description: "Envoyez des emails et SMS directement depuis le CRM. Templates, séquences automatisées et tracking.",
      highlights: ["Templates illimités", "Tracking ouvertures", "Automatisations"],
      gradient: "from-rose-500 to-rose-600",
    },
    {
      icon: Icons.Shield,
      title: "Rapports & Analytics",
      description: "Tableaux de bord personnalisables. Analysez vos performances et prenez des décisions éclairées.",
      highlights: ["Dashboards custom", "Export PDF/Excel", "Rapports automatiques"],
      gradient: "from-cyan-500 to-cyan-600",
    },
  ];

  return (
    <section id="fonctionnalites" className="py-20 md:py-32 bg-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span
            variants={fadeInUp}
            className="inline-block px-4 py-1.5 bg-sky-100 text-sky-700 text-sm font-semibold rounded-full mb-4"
          >
            Fonctionnalités
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6"
          >
            Tout ce dont vous avez besoin,{" "}
            <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">
              rien de superflu
            </span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-slate-600">
            Une plateforme complète qui s&apos;adapte à votre métier et simplifie votre quotidien.
          </motion.p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="group p-6 lg:p-8 bg-white rounded-3xl border border-slate-100 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-500/5 transition-all duration-300 cursor-pointer"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 mb-4">{feature.description}</p>
              <ul className="space-y-2">
                {feature.highlights.map((highlight, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-500">
                    <Icons.Check className="w-4 h-4 text-emerald-500" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// STAT COUNTER COMPONENT
// ============================================================================
function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { count, ref } = useCounter(value);
  return (
    <motion.div variants={scaleIn} ref={ref} className="text-center">
      <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent mb-2">
        {count}{suffix}
      </div>
      <div className="text-sm text-slate-400">{label}</div>
    </motion.div>
  );
}

// ============================================================================
// INDUSTRIES SECTION
// ============================================================================
function IndustriesSection() {
  const industries = [
    { icon: Icons.Building, name: "BTP & Construction", desc: "Gestion chantiers, devis, interventions, sous-traitants", gradient: "from-amber-500 to-orange-500" },
    { icon: Icons.ShoppingCart, name: "Commerce & Retail", desc: "Gestion stocks, clients, programmes fidélité, analytics", gradient: "from-emerald-500 to-teal-500" },
    { icon: Icons.Briefcase, name: "Services & Consulting", desc: "Gestion projets, temps passé, facturation, reporting", gradient: "from-sky-500 to-indigo-500" },
    { icon: Icons.Home, name: "Immobilier", desc: "Gestion biens, mandats, visites, transactions", gradient: "from-violet-500 to-purple-500" },
  ];

  const stats = [
    { value: 98, suffix: "%", label: "Satisfaction client" },
    { value: 5, suffix: "k+", label: "Entreprises" },
    { value: 2, suffix: "M+", label: "Contacts gérés" },
    { value: 24, suffix: "/7", label: "Support technique" },
  ];

  return (
    <section id="secteurs" className="py-20 md:py-32 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.15),transparent_50%)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span
            variants={fadeInUp}
            className="inline-block px-4 py-1.5 bg-white/10 text-sky-300 text-sm font-semibold rounded-full mb-4"
          >
            Multi-secteurs
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"
          >
            Un CRM adapté à{" "}
            <span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
              votre métier
            </span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-slate-400">
            Nexflow s&apos;adapte aux spécificités de chaque secteur avec des fonctionnalités dédiées.
          </motion.p>
        </motion.div>

        {/* Industries Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {industries.map((industry, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              whileHover={{ y: -5, borderColor: "rgba(14, 165, 233, 0.5)" }}
              className="group p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 transition-all duration-300 cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${industry.gradient} flex items-center justify-center text-white mb-4`}>
                <industry.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{industry.name}</h3>
              <p className="text-sm text-slate-400">{industry.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {stats.map((stat, index) => (
            <StatCounter key={index} value={stat.value} suffix={stat.suffix} label={stat.label} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// PRICING SECTION
// ============================================================================
function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Starter",
      description: "Pour les indépendants et petites équipes",
      price: isAnnual ? 23 : 29,
      features: ["Jusqu'à 3 utilisateurs", "1 000 contacts", "Pipeline de ventes", "Support email"],
      popular: false,
    },
    {
      name: "Pro",
      description: "Pour les PME en croissance",
      price: isAnnual ? 63 : 79,
      features: ["Jusqu'à 15 utilisateurs", "Contacts illimités", "Automatisations avancées", "Intégrations API", "Support prioritaire"],
      popular: true,
    },
    {
      name: "Enterprise",
      description: "Pour les grandes organisations",
      price: null,
      features: ["Utilisateurs illimités", "SSO & sécurité avancée", "Account manager dédié", "SLA garanti 99.9%"],
      popular: false,
    },
  ];

  return (
    <section id="tarifs" className="py-20 md:py-32 bg-slate-50 relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <motion.span
            variants={fadeInUp}
            className="inline-block px-4 py-1.5 bg-sky-100 text-sky-700 text-sm font-semibold rounded-full mb-4"
          >
            Tarifs transparents
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6"
          >
            Un prix adapté à{" "}
            <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">
              votre croissance
            </span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-slate-600">
            Pas de surprise. Essai gratuit 14 jours sur tous les plans, sans carte bancaire.
          </motion.p>
        </motion.div>

        {/* Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <span className={`font-medium transition-colors ${!isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
            Mensuel
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-14 h-8 bg-gradient-to-r from-sky-500 to-violet-600 rounded-full transition-colors cursor-pointer"
          >
            <motion.span
              animate={{ x: isAnnual ? 24 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
            />
          </button>
          <span className={`font-medium transition-colors ${isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
            Annuel{" "}
            <span className="text-emerald-600 text-sm font-semibold">-20%</span>
          </span>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              whileHover={{ y: -5 }}
              className={`relative p-8 rounded-3xl transition-all duration-300 ${
                plan.popular
                  ? "bg-white border-2 border-sky-500 shadow-xl shadow-sky-500/10"
                  : "bg-white border border-slate-200 hover:shadow-xl"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-sky-500 to-violet-600 text-white text-sm font-semibold rounded-full">
                  Le plus populaire
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  {plan.price ? (
                    <>
                      <span className="text-5xl font-bold text-slate-900">{plan.price}€</span>
                      <span className="text-slate-500">/mois</span>
                    </>
                  ) : (
                    <span className="text-4xl font-bold text-slate-900">Sur mesure</span>
                  )}
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-600">
                    <Icons.Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="#cta"
                className={`block w-full py-3 px-6 text-center font-semibold rounded-xl transition-all duration-300 cursor-pointer ${
                  plan.popular
                    ? "bg-gradient-to-r from-sky-500 to-violet-600 text-white shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {plan.price ? "Commencer" : "Nous contacter"}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// TESTIMONIALS SECTION
// ============================================================================
function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Nexflow a révolutionné notre gestion commerciale. Nous avons augmenté notre taux de conversion de 35% en 3 mois. L'interface est intuitive et l'équipe support exceptionnelle.",
      author: "Marie Leroy",
      role: "Directrice Commerciale, TechSolutions",
    },
    {
      quote: "En tant qu'artisan, je cherchais un outil simple pour gérer mes chantiers. Nexflow est parfait : planning, devis, facturation... tout est centralisé et accessible depuis mon téléphone.",
      author: "Thomas Dubois",
      role: "Gérant, Dubois Rénovation",
    },
    {
      quote: "Notre équipe de 12 commerciaux utilise Nexflow au quotidien. Les rapports automatisés nous font gagner des heures chaque semaine. ROI atteint en moins de 2 mois !",
      author: "Sophie Martin",
      role: "CEO, GrowthAgency",
    },
  ];

  return (
    <section id="temoignages" className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span
            variants={fadeInUp}
            className="inline-block px-4 py-1.5 bg-sky-100 text-sky-700 text-sm font-semibold rounded-full mb-4"
          >
            Témoignages
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6"
          >
            Ce que nos clients{" "}
            <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">
              disent de nous
            </span>
          </motion.h2>
        </motion.div>

        {/* Testimonials Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              whileHover={{ y: -5 }}
              className="p-8 bg-slate-50 rounded-3xl border border-slate-100 hover:shadow-lg transition-all duration-300 cursor-pointer"
            >
              {/* Stars */}
              <div className="flex items-center gap-1 text-amber-400 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icons.Star key={i} />
                ))}
              </div>

              {/* Quote */}
              <p className="text-slate-700 mb-6 leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold">
                  {testimonial.author.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.author}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// CTA SECTION
// ============================================================================
function CTASection() {
  return (
    <section id="cta" className="py-20 md:py-32 bg-gradient-to-br from-sky-600 via-sky-500 to-violet-600 relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Floating elements */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-[10%] w-20 h-20 bg-white/10 rounded-2xl backdrop-blur-sm"
      />
      <motion.div
        animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 right-[15%] w-16 h-16 bg-white/10 rounded-full backdrop-blur-sm"
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div
            variants={scaleIn}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6"
          >
            <Icons.Sparkles className="w-5 h-5 text-white" />
            <span className="text-white font-medium">Offre de lancement</span>
          </motion.div>

          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"
          >
            Prêt à booster votre croissance ?
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="text-lg text-sky-100 mb-10 max-w-2xl mx-auto"
          >
            Rejoignez plus de 5 000 entreprises qui font confiance à Nexflow.
            Essai gratuit 14 jours, sans engagement, sans carte bancaire.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
          >
            <Link
              href="#"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-sky-600 font-semibold rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              Démarrer gratuitement
              <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer"
            >
              Planifier une démo
            </Link>
          </motion.div>

          <motion.p variants={fadeIn} className="text-sm text-sky-200">
            Configuration en 5 minutes • Import de données assisté • Support 7j/7
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================
function Footer() {
  const footerLinks = {
    Produit: ["Fonctionnalités", "Tarifs", "Intégrations", "API"],
    Entreprise: ["À propos", "Blog", "Carrières", "Contact"],
    Ressources: ["Documentation", "Guides", "Webinaires", "Statut"],
    Légal: ["Confidentialité", "CGU", "Cookies", "RGPD"],
  };

  return (
    <footer className="bg-slate-900 text-slate-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center">
                <Icons.Bolt className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Nexflow</span>
            </Link>
            <p className="text-sm">Le CRM qui propulse votre croissance. Simple, puissant, abordable.</p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-4">{category}</h4>
              <ul className="space-y-2 text-sm">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="hover:text-white transition-colors cursor-pointer">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm">&copy; {new Date().getFullYear()} Nexflow. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            {/* LinkedIn */}
            <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer" aria-label="LinkedIn">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            {/* Twitter/X */}
            <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer" aria-label="Twitter">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* YouTube */}
            <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer" aria-label="YouTube">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN LANDING PAGE
// ============================================================================
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white antialiased">
      <Navbar />
      <HeroSection />
      <LogosSection />
      <FeaturesSection />
      <IndustriesSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
