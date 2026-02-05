"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ============================================================================
// DESIGN SYSTEM - Nexflow CRM Premium Sales Page
// ============================================================================
// Style: Premium SaaS with aggressive conversion optimization
// Colors: Sky blue (#0EA5E9) + Violet accent (#8B5CF6) + Orange CTA (#F97316)
// Pattern: Problem-Agitation-Solution + Social Proof Heavy
// ============================================================================

// ============================================================================
// HOOKS
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

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

// ============================================================================
// ICONS
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
  X: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
  Close: ({ className = "w-6 h-6" }: { className?: string }) => (
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
  Clock: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  TrendingUp: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  AlertTriangle: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  Zap: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  Lock: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  Refresh: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  ChevronDown: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
  Quote: ({ className = "w-8 h-8" }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  ),
};

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }
};

const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } }
};

const slideInRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } }
};

// ============================================================================
// ANIMATED BACKGROUND
// ============================================================================
function AnimatedGradientBg() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50 to-violet-50" />
      <motion.div
        animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 -left-20 w-[500px] h-[500px] bg-gradient-to-br from-sky-400/30 to-cyan-300/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -80, 0], y: [0, 100, 0], scale: [1.2, 1, 1.2] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 -right-20 w-[600px] h-[600px] bg-gradient-to-br from-violet-400/25 to-purple-300/15 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, 50, 0], y: [0, -80, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-gradient-to-br from-orange-300/20 to-amber-200/10 rounded-full blur-3xl"
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
    </div>
  );
}

// ============================================================================
// FLOATING GLASS CARD
// ============================================================================
function FloatingCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
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
// LIVE NOTIFICATION POPUP
// ============================================================================
function LiveNotification() {
  const [show, setShow] = useState(false);
  const [notification, setNotification] = useState({ name: "", action: "", time: "" });

  const notifications = [
    { name: "Marie L.", action: "vient de démarrer son essai gratuit", time: "Il y a 12 secondes" },
    { name: "Jean-Pierre D.", action: "a converti 3 leads aujourd'hui", time: "Il y a 45 secondes" },
    { name: "Sophie M.", action: "a créé son premier pipeline", time: "Il y a 2 minutes" },
    { name: "Thomas B.", action: "vient de s'inscrire depuis Lyon", time: "Il y a 3 minutes" },
    { name: "Claire R.", action: "a automatisé ses relances", time: "Il y a 5 minutes" },
  ];

  useEffect(() => {
    const showNotification = () => {
      const randomNotif = notifications[Math.floor(Math.random() * notifications.length)];
      setNotification(randomNotif);
      setShow(true);
      setTimeout(() => setShow(false), 4000);
    };

    const initialTimeout = setTimeout(showNotification, 5000);
    const interval = setInterval(showNotification, 15000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: -100, y: 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: -100 }}
          className="fixed bottom-6 left-6 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 max-w-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {notification.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <p className="text-sm text-slate-900">
                <span className="font-semibold">{notification.name}</span> {notification.action}
              </p>
              <p className="text-xs text-slate-500 mt-1">{notification.time}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
    <motion.nav
      className="fixed top-4 left-4 right-4 z-50 rounded-2xl transition-shadow"
      style={{
        backgroundColor: useTransform(bgOpacity, (v) => `rgba(255, 255, 255, ${v * 0.95})`),
        backdropFilter: useTransform(blur, (v) => `blur(${v}px)`),
        boxShadow: useTransform(bgOpacity, (v) => v > 0.5 ? `0 4px 30px rgba(0, 0, 0, ${v * 0.1})` : 'none'),
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-500/25 group-hover:shadow-sky-500/40 transition-shadow">
              <Icons.Bolt className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold">
              <span className="text-slate-900">Nex</span>
              <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">flow</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {["Fonctionnalités", "Témoignages", "Tarifs", "FAQ"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`} className="text-slate-600 hover:text-sky-600 font-medium transition-colors cursor-pointer">
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a href="#" className="px-4 py-2 text-slate-600 hover:text-sky-600 font-medium transition-colors cursor-pointer">
              Connexion
            </a>
            <a href="#cta" className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
              Essai gratuit
            </a>
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 text-slate-600 hover:text-sky-600 cursor-pointer" aria-label="Menu">
            {isOpen ? <Icons.Close /> : <Icons.Menu />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 rounded-b-2xl overflow-hidden"
          >
            <div className="px-4 py-4 space-y-3">
              {["Fonctionnalités", "Témoignages", "Tarifs", "FAQ"].map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setIsOpen(false)} className="block py-2 text-slate-600 hover:text-sky-600 font-medium cursor-pointer">
                  {item}
                </a>
              ))}
              <hr className="border-slate-200" />
              <a href="#cta" onClick={() => setIsOpen(false)} className="block py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl text-center cursor-pointer">
                Essai gratuit
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ============================================================================
// HERO SECTION - Premium with Video CTA
// ============================================================================
function HeroSection() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  // Countdown to end of month
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);
  const timeLeft = useCountdown(endOfMonth);

  return (
    <section className="relative min-h-screen flex items-center pt-24 overflow-hidden">
      <AnimatedGradientBg />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div style={{ y, opacity }} className="text-center lg:text-left">
            <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
              {/* Urgency Banner */}
              <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-200 rounded-full mb-6">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                </span>
                <span className="text-sm font-semibold text-orange-700">
                  Offre limitée : -50% ce mois-ci
                </span>
              </motion.div>

              <motion.h1 variants={fadeInUp} className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-6">
                Arrêtez de{" "}
                <span className="relative">
                  <span className="line-through text-slate-400">perdre</span>
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 1, duration: 0.5 }}
                    className="absolute left-0 top-1/2 h-1 bg-red-500/30"
                  />
                </span>{" "}
                des clients.
                <br />
                <span className="bg-gradient-to-r from-sky-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">
                  Convertissez-les.
                </span>
              </motion.h1>

              <motion.p variants={fadeInUp} className="text-lg sm:text-xl text-slate-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                <span className="font-semibold text-slate-800">87% des PME</span> perdent des opportunités par manque d&apos;organisation.
                Nexflow transforme votre chaos commercial en machine à vendre prévisible.
              </motion.p>

              {/* Countdown Timer */}
              <motion.div variants={fadeInUp} className="flex items-center justify-center lg:justify-start gap-4 mb-8">
                <span className="text-sm font-medium text-slate-500">Offre expire dans :</span>
                <div className="flex gap-2">
                  {[
                    { value: timeLeft.days, label: "j" },
                    { value: timeLeft.hours, label: "h" },
                    { value: timeLeft.minutes, label: "m" },
                    { value: timeLeft.seconds, label: "s" },
                  ].map((unit, i) => (
                    <div key={i} className="bg-slate-900 text-white px-3 py-2 rounded-lg text-center min-w-[50px]">
                      <span className="text-xl font-bold">{unit.value.toString().padStart(2, "0")}</span>
                      <span className="text-xs text-slate-400">{unit.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <a href="#cta" className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer text-lg">
                  Démarrer mon essai gratuit
                  <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <button className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/80 backdrop-blur-sm text-slate-700 font-semibold rounded-2xl border-2 border-slate-200 hover:border-sky-300 hover:text-sky-600 transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center">
                    <Icons.Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                  Voir la démo (2 min)
                </button>
              </motion.div>

              {/* Trust Signals */}
              <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Icons.Shield className="w-5 h-5 text-emerald-500" />
                  <span className="text-slate-600">Sans carte bancaire</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icons.Clock className="w-5 h-5 text-sky-500" />
                  <span className="text-slate-600">Configuration en 5 min</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icons.Refresh className="w-5 h-5 text-violet-500" />
                  <span className="text-slate-600">Annulation à tout moment</span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Hero Visual - Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <FloatingCard className="p-5 sm:p-6" delay={0.2}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center">
                    <Icons.Chart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Performance ce mois</h3>
                    <p className="text-sm text-slate-500">vs. mois dernier</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-bold rounded-full flex items-center gap-1.5">
                  <Icons.TrendingUp className="w-4 h-4" />
                  +47%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: "Chiffre d'affaires", value: "247.8k€", change: "+47%", trend: "up" },
                  { label: "Nouveaux clients", value: "186", change: "+32%", trend: "up" },
                  { label: "Taux de closing", value: "68%", change: "+12pts", trend: "up" },
                  { label: "Temps moyen closing", value: "4.2j", change: "-38%", trend: "down" },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className={`p-4 rounded-xl border ${i === 0 ? "bg-gradient-to-br from-sky-50 to-white border-sky-100" : "bg-white border-slate-100"}`}
                  >
                    <p className="text-sm text-slate-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <span className={`text-xs font-semibold flex items-center gap-1 ${stat.trend === "up" ? "text-emerald-600" : "text-sky-600"}`}>
                      <svg className={`w-3 h-3 ${stat.trend === "down" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      {stat.change}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Mini Chart */}
              <div className="h-32 bg-gradient-to-br from-slate-50 to-white rounded-xl flex items-end justify-around p-4 gap-2">
                {[35, 45, 40, 60, 55, 75, 85, 70, 90, 85, 95, 100].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.8, delay: 0.8 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className={`w-full max-w-[24px] rounded-t-md ${i >= 10 ? "bg-gradient-to-t from-emerald-500 to-emerald-400" : i >= 6 ? "bg-gradient-to-t from-sky-500 to-sky-400" : "bg-gradient-to-t from-slate-300 to-slate-200"}`}
                  />
                ))}
              </div>
            </FloatingCard>

            {/* Floating Notification - New Lead */}
            <motion.div
              initial={{ opacity: 0, y: 20, x: -20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 max-w-[220px]"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Icons.Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Nouveau lead chaud</p>
                  <p className="text-xs text-slate-500">Il y a 30 secondes</p>
                </div>
              </div>
              <p className="text-xs text-slate-600">Pierre Martin - Budget 15k€</p>
              <div className="mt-2 flex gap-2">
                <button className="flex-1 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer">Appeler</button>
                <button className="flex-1 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer">Qualifier</button>
              </div>
            </motion.div>

            {/* Floating Notification - Deal Won */}
            <motion.div
              initial={{ opacity: 0, y: -20, x: 20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ duration: 0.6, delay: 1.4 }}
              className="absolute -top-2 -right-2 bg-white rounded-2xl shadow-xl border border-emerald-100 p-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <Icons.Check className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Affaire conclue !</p>
                  <p className="text-xs text-emerald-600 font-bold">+24 500€</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Social Proof Bar */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-16 pt-12 border-t border-slate-200"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`w-10 h-10 rounded-full border-2 border-white shadow-sm bg-gradient-to-br ${
                    i === 1 ? "from-sky-400 to-sky-600" :
                    i === 2 ? "from-violet-400 to-violet-600" :
                    i === 3 ? "from-emerald-400 to-emerald-600" :
                    i === 4 ? "from-amber-400 to-amber-600" :
                    "from-rose-400 to-rose-600"
                  }`} />
                ))}
                <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-slate-800 flex items-center justify-center text-white text-xs font-bold">
                  +5k
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-900">+5 000 entreprises</p>
                <p className="text-sm text-slate-500">nous font confiance</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icons.Star key={i} className="w-6 h-6" />
                ))}
              </div>
              <span className="text-slate-900 font-semibold">4.9/5</span>
              <span className="text-slate-500">sur 847 avis</span>
            </div>

            <div className="flex items-center gap-6 text-slate-400 text-sm font-medium">
              <span>Vu sur:</span>
              <span className="text-slate-600 font-bold">Les Échos</span>
              <span className="text-slate-600 font-bold">BFM Business</span>
              <span className="text-slate-600 font-bold">Forbes</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// PROBLEM SECTION - Pain Points
// ============================================================================
function ProblemSection() {
  const problems = [
    {
      icon: Icons.AlertTriangle,
      title: "Leads qui disparaissent",
      description: "Vos prospects tombent dans l'oubli. Pas de suivi, pas de relance. Résultat : ils signent ailleurs.",
      stat: "67%",
      statLabel: "des leads jamais recontactés"
    },
    {
      icon: Icons.Clock,
      title: "Temps perdu en admin",
      description: "Excel, post-its, emails... Vous passez plus de temps à chercher qu'à vendre.",
      stat: "15h",
      statLabel: "perdues par semaine"
    },
    {
      icon: Icons.Chart,
      title: "Zéro visibilité",
      description: "Impossible de savoir où en sont vos commerciaux. Les prévisions ? Au doigt mouillé.",
      stat: "3x",
      statLabel: "plus d'erreurs de prévision"
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.1),transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/20 text-red-400 text-sm font-semibold rounded-full mb-4">
            <Icons.AlertTriangle className="w-4 h-4" />
            Le problème
          </motion.span>
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Chaque jour sans CRM vous coûte{" "}
            <span className="text-red-400">de l&apos;argent</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-slate-400">
            Vos concurrents utilisent déjà des outils pour convertir plus vite. Pendant ce temps, vous perdez des deals.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8"
        >
          {problems.map((problem, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className="relative p-8 bg-white/5 backdrop-blur-sm rounded-3xl border border-red-500/20 hover:border-red-500/40 transition-colors group"
            >
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-colors" />

              <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mb-6">
                <problem.icon className="w-7 h-7 text-red-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-3">{problem.title}</h3>
              <p className="text-slate-400 mb-6">{problem.description}</p>

              <div className="pt-6 border-t border-slate-700">
                <span className="text-4xl font-bold text-red-400">{problem.stat}</span>
                <p className="text-sm text-slate-500 mt-1">{problem.statLabel}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-slate-400 text-lg">
            <span className="text-white font-semibold">La bonne nouvelle ?</span> Ces problèmes ont une solution simple.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// SOLUTION SECTION - Before/After
// ============================================================================
function SolutionSection() {
  const [activeTab, setActiveTab] = useState<"before" | "after">("after");

  const comparisons = [
    { before: "Leads éparpillés dans 5 outils", after: "Tous vos contacts en un clic" },
    { before: "Relances manuelles oubliées", after: "Automatisations intelligentes" },
    { before: "Reporting Excel chaque vendredi", after: "Dashboard temps réel 24/7" },
    { before: "Prévisions approximatives", after: "Pipeline prévisible à 95%" },
    { before: "Équipe en mode pompier", after: "Process commerciaux fluides" },
  ];

  return (
    <section className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-full mb-4">
            <Icons.Sparkles className="w-4 h-4" />
            La solution
          </motion.span>
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Passez de <span className="text-red-500">chaos</span> à{" "}
            <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">contrôle total</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-slate-600">
            Nexflow centralise tout. Vos équipes vendent plus, vous dormez mieux.
          </motion.p>
        </motion.div>

        {/* Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center mb-12"
        >
          <div className="inline-flex items-center bg-slate-100 rounded-full p-1">
            <button
              onClick={() => setActiveTab("before")}
              className={`px-6 py-3 rounded-full font-semibold transition-all cursor-pointer ${
                activeTab === "before"
                  ? "bg-red-500 text-white shadow-lg"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Avant Nexflow
            </button>
            <button
              onClick={() => setActiveTab("after")}
              className={`px-6 py-3 rounded-full font-semibold transition-all cursor-pointer ${
                activeTab === "after"
                  ? "bg-gradient-to-r from-sky-500 to-violet-600 text-white shadow-lg"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Avec Nexflow
            </button>
          </div>
        </motion.div>

        {/* Comparison Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          {comparisons.map((item, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className={`p-6 rounded-2xl transition-all duration-500 ${
                activeTab === "before"
                  ? "bg-red-50 border-2 border-red-200"
                  : "bg-gradient-to-br from-sky-50 to-violet-50 border-2 border-sky-200"
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${
                activeTab === "before" ? "bg-red-100" : "bg-emerald-100"
              }`}>
                {activeTab === "before" ? (
                  <Icons.X className="w-5 h-5 text-red-500" />
                ) : (
                  <Icons.Check className="w-5 h-5 text-emerald-500" />
                )}
              </div>
              <p className={`font-medium ${activeTab === "before" ? "text-red-700" : "text-slate-900"}`}>
                {activeTab === "before" ? item.before : item.after}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <a
            href="#cta"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-sky-500 to-violet-600 text-white font-bold rounded-2xl shadow-xl shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          >
            Transformer mon business maintenant
            <Icons.ArrowRight className="w-5 h-5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// HOW IT WORKS SECTION
// ============================================================================
function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Importez vos données",
      description: "Connectez votre email, importez votre Excel ou démarrez de zéro. Notre IA nettoie et organise tout automatiquement.",
      icon: Icons.Users,
      duration: "5 minutes",
    },
    {
      number: "02",
      title: "Configurez votre pipeline",
      description: "Choisissez parmi nos templates sectoriels ou créez le vôtre. Glissez-déposez vos étapes de vente.",
      icon: Icons.Chart,
      duration: "10 minutes",
    },
    {
      number: "03",
      title: "Vendez plus, stressez moins",
      description: "Nexflow vous dit qui appeler, quand relancer, et automatise le reste. Concentrez-vous sur ce qui compte.",
      icon: Icons.TrendingUp,
      duration: "∞ en mode autopilote",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-slate-50 relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span variants={fadeInUp} className="inline-block px-4 py-1.5 bg-sky-100 text-sky-700 text-sm font-semibold rounded-full mb-4">
            Comment ça marche
          </motion.span>
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Opérationnel en{" "}
            <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">15 minutes</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-slate-600">
            Pas besoin de formation. Pas besoin de consultant. Juste vous et Nexflow.
          </motion.p>
        </motion.div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-sky-200 via-violet-200 to-sky-200 -translate-y-1/2" />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid lg:grid-cols-3 gap-8 lg:gap-12"
          >
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="relative bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100"
              >
                {/* Step Number */}
                <div className="absolute -top-6 left-8 w-12 h-12 bg-gradient-to-br from-sky-500 to-violet-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {step.number}
                </div>

                <div className="pt-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-100 to-violet-100 flex items-center justify-center mb-6">
                    <step.icon className="w-7 h-7 text-sky-600" />
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600 mb-4">{step.description}</p>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                    <Icons.Clock className="w-4 h-4" />
                    {step.duration}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
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
      title: "Contacts 360°",
      description: "Historique complet, scoring automatique, segmentation intelligente. Connaissez vos clients mieux qu'eux-mêmes.",
      highlights: ["Import/Export en 1 clic", "Déduplication auto", "Timeline d'activité"],
      gradient: "from-sky-500 to-sky-600",
      stats: "32% de conversion en plus"
    },
    {
      icon: Icons.Chart,
      title: "Pipeline visuel",
      description: "Drag & drop intuitif. Voyez où en est chaque deal en temps réel. Ne laissez plus rien passer entre les mailles.",
      highlights: ["Vue Kanban", "Prévisions IA", "Alertes intelligentes"],
      gradient: "from-violet-500 to-violet-600",
      stats: "2x plus de deals closés"
    },
    {
      icon: Icons.Zap,
      title: "Automatisations",
      description: "Relances automatiques, emails personnalisés, tâches créées seules. Vous dormez, Nexflow travaille.",
      highlights: ["Workflows sans code", "Templates illimités", "Triggers personnalisés"],
      gradient: "from-amber-500 to-amber-600",
      stats: "15h/semaine économisées"
    },
    {
      icon: Icons.Calendar,
      title: "Planning intelligent",
      description: "Calendrier synchronisé, rappels automatiques, optimisation des tournées. Vos équipes sur le terrain en mode GPS.",
      highlights: ["Sync Google/Outlook", "SMS de rappel", "Géolocalisation"],
      gradient: "from-emerald-500 to-emerald-600",
      stats: "40% de RDV en plus"
    },
    {
      icon: Icons.Euro,
      title: "Devis & Factures",
      description: "Du devis à l'encaissement en quelques clics. Templates pro, signature électronique, relances auto.",
      highlights: ["Signature en ligne", "Paiement intégré", "Compta synchronisée"],
      gradient: "from-rose-500 to-rose-600",
      stats: "Payé 2x plus vite"
    },
    {
      icon: Icons.Shield,
      title: "Analytics puissants",
      description: "Dashboards personnalisables. Comprenez ce qui marche. Prenez les bonnes décisions, au bon moment.",
      highlights: ["Rapports automatiques", "Export PDF/Excel", "Alertes seuils"],
      gradient: "from-cyan-500 to-cyan-600",
      stats: "ROI visible en 30 jours"
    },
  ];

  return (
    <section id="fonctionnalites" className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span variants={fadeInUp} className="inline-block px-4 py-1.5 bg-sky-100 text-sky-700 text-sm font-semibold rounded-full mb-4">
            Fonctionnalités
          </motion.span>
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Tout ce qu&apos;il faut pour{" "}
            <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">dominer votre marché</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-slate-600">
            Des outils puissants, une interface simple. Pas de superflu, que de l&apos;efficace.
          </motion.p>
        </motion.div>

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

              <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 mb-4">{feature.description}</p>

              <ul className="space-y-2 mb-6">
                {feature.highlights.map((highlight, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-500">
                    <Icons.Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {highlight}
                  </li>
                ))}
              </ul>

              <div className="pt-4 border-t border-slate-100">
                <span className="text-sm font-semibold text-emerald-600">{feature.stats}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// INTEGRATIONS SECTION
// ============================================================================
function IntegrationsSection() {
  const integrations = [
    { name: "Google Workspace", category: "Productivité" },
    { name: "Microsoft 365", category: "Productivité" },
    { name: "Slack", category: "Communication" },
    { name: "Zapier", category: "Automation" },
    { name: "Stripe", category: "Paiement" },
    { name: "QuickBooks", category: "Comptabilité" },
    { name: "Mailchimp", category: "Marketing" },
    { name: "Calendly", category: "Planification" },
  ];

  return (
    <section className="py-20 bg-slate-50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="text-center mb-12"
        >
          <motion.h3 variants={fadeInUp} className="text-2xl font-bold text-slate-900 mb-4">
            Se connecte à vos outils favoris
          </motion.h3>
          <motion.p variants={fadeInUp} className="text-slate-600">
            +50 intégrations natives pour centraliser votre stack
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          {integrations.map((integration, index) => (
            <motion.div
              key={index}
              variants={fadeIn}
              whileHover={{ scale: 1.05, y: -2 }}
              className="px-6 py-3 bg-white rounded-xl border border-slate-200 hover:border-sky-200 hover:shadow-lg transition-all cursor-pointer"
            >
              <span className="font-medium text-slate-700">{integration.name}</span>
            </motion.div>
          ))}
          <motion.div
            variants={fadeIn}
            className="px-6 py-3 bg-gradient-to-r from-sky-500 to-violet-600 rounded-xl text-white font-semibold cursor-pointer hover:shadow-lg transition-shadow"
          >
            +50 autres
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// TESTIMONIALS SECTION - Case Studies
// ============================================================================
function TestimonialsSection() {
  const testimonials = [
    {
      quote: "En 3 mois, on est passé de 12 à 47 deals closés par mois. L'équipe est transformée. On ne reviendrait en arrière pour rien au monde.",
      author: "Marie Leroy",
      role: "Directrice Commerciale",
      company: "TechSolutions",
      avatar: "ML",
      metrics: [
        { label: "Deals/mois", before: "12", after: "47", change: "+292%" },
        { label: "Temps closing", before: "18 jours", after: "7 jours", change: "-61%" },
      ],
      gradient: "from-sky-400 to-sky-600"
    },
    {
      quote: "J'étais sceptique sur les CRM. Trop compliqués, trop chers. Nexflow m'a prouvé le contraire. Configuré en 20 minutes, ROI en 2 semaines.",
      author: "Thomas Dubois",
      role: "Gérant",
      company: "Dubois Rénovation",
      avatar: "TD",
      metrics: [
        { label: "CA mensuel", before: "45k€", after: "78k€", change: "+73%" },
        { label: "Leads perdus", before: "~40%", after: "<5%", change: "-87%" },
      ],
      gradient: "from-emerald-400 to-emerald-600"
    },
    {
      quote: "Notre équipe de 15 commerciaux a adopté Nexflow en une journée. Le meilleur investissement de l'année. Et de loin.",
      author: "Sophie Martin",
      role: "CEO",
      company: "GrowthAgency",
      avatar: "SM",
      metrics: [
        { label: "Productivité", before: "Base", after: "+40%", change: "+40%" },
        { label: "Satisfaction équipe", before: "6/10", after: "9.2/10", change: "+53%" },
      ],
      gradient: "from-violet-400 to-violet-600"
    },
  ];

  return (
    <section id="temoignages" className="py-20 md:py-32 bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.15),transparent_50%)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span variants={fadeInUp} className="inline-block px-4 py-1.5 bg-white/10 text-sky-300 text-sm font-semibold rounded-full mb-4">
            Résultats prouvés
          </motion.span>
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ils ont transformé leur business.{" "}
            <span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">À votre tour.</span>
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid lg:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8 hover:border-sky-500/30 transition-colors"
            >
              {/* Quote */}
              <div className="mb-6">
                <Icons.Quote className="w-10 h-10 text-sky-500/30 mb-4" />
                <p className="text-white text-lg leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center text-white font-bold`}>
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-white">{testimonial.author}</p>
                  <p className="text-sm text-slate-400">{testimonial.role}, {testimonial.company}</p>
                </div>
              </div>

              {/* Metrics */}
              <div className="space-y-4">
                {testimonial.metrics.map((metric, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{metric.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500 line-through">{metric.before}</span>
                      <Icons.ArrowRight className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-bold text-white">{metric.after}</span>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        {metric.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {[
            { value: "5,247", label: "Entreprises actives" },
            { value: "2.4M", label: "Deals gérés" },
            { value: "98%", label: "Satisfaction client" },
            { value: "4.9/5", label: "Note moyenne" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
            </div>
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
      description: "Pour démarrer et tester",
      price: isAnnual ? 19 : 29,
      originalPrice: isAnnual ? 39 : 49,
      features: [
        "3 utilisateurs",
        "1 000 contacts",
        "Pipeline de ventes",
        "Email intégré",
        "Support email",
      ],
      notIncluded: ["Automatisations", "API", "SSO"],
      cta: "Commencer gratuitement",
      popular: false,
    },
    {
      name: "Pro",
      description: "Le plus populaire",
      price: isAnnual ? 49 : 69,
      originalPrice: isAnnual ? 99 : 129,
      features: [
        "15 utilisateurs",
        "Contacts illimités",
        "Automatisations avancées",
        "Intégrations API",
        "Support prioritaire 24/7",
        "Rapports personnalisés",
      ],
      notIncluded: ["SSO", "SLA garanti"],
      cta: "Essayer 14 jours gratuit",
      popular: true,
    },
    {
      name: "Enterprise",
      description: "Pour les grandes équipes",
      price: null,
      features: [
        "Utilisateurs illimités",
        "Tout Pro inclus",
        "SSO & sécurité avancée",
        "Account manager dédié",
        "SLA garanti 99.9%",
        "Formation sur site",
      ],
      notIncluded: [],
      cta: "Contacter les ventes",
      popular: false,
    },
  ];

  return (
    <section id="tarifs" className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <motion.span variants={fadeInUp} className="inline-block px-4 py-1.5 bg-sky-100 text-sky-700 text-sm font-semibold rounded-full mb-4">
            Tarifs simples
          </motion.span>
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">-50% ce mois-ci</span>
            <br />Prix qui évolue avec vous
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-slate-600">
            Pas de surprise. Essai gratuit 14 jours, sans carte bancaire.
          </motion.p>
        </motion.div>

        {/* Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <span className={`font-medium transition-colors ${!isAnnual ? "text-slate-900" : "text-slate-500"}`}>
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
          <span className={`font-medium transition-colors ${isAnnual ? "text-slate-900" : "text-slate-500"}`}>
            Annuel{" "}
            <span className="text-emerald-600 text-sm font-bold bg-emerald-100 px-2 py-1 rounded-full ml-1">
              -30% en plus
            </span>
          </span>
        </motion.div>

        {/* Plans */}
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
              className={`relative p-8 rounded-3xl transition-all duration-300 ${
                plan.popular
                  ? "bg-gradient-to-b from-sky-500 to-violet-600 text-white shadow-2xl shadow-sky-500/30 scale-105"
                  : "bg-white border border-slate-200 hover:shadow-xl"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 text-white text-sm font-bold rounded-full">
                  Le plus populaire
                </div>
              )}

              <div className="mb-8">
                <h3 className={`text-xl font-bold mb-2 ${plan.popular ? "text-white" : "text-slate-900"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.popular ? "text-sky-100" : "text-slate-500"}`}>
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-2">
                  {plan.price ? (
                    <>
                      {plan.originalPrice && (
                        <span className={`text-2xl line-through ${plan.popular ? "text-sky-200" : "text-slate-400"}`}>
                          {plan.originalPrice}€
                        </span>
                      )}
                      <span className={`text-5xl font-bold ${plan.popular ? "text-white" : "text-slate-900"}`}>
                        {plan.price}€
                      </span>
                      <span className={plan.popular ? "text-sky-100" : "text-slate-500"}>/mois</span>
                    </>
                  ) : (
                    <span className={`text-3xl font-bold ${plan.popular ? "text-white" : "text-slate-900"}`}>
                      Sur mesure
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className={`flex items-start gap-3 ${plan.popular ? "text-white" : "text-slate-600"}`}>
                    <Icons.Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${plan.popular ? "text-emerald-300" : "text-emerald-500"}`} />
                    {feature}
                  </li>
                ))}
                {plan.notIncluded.map((feature, i) => (
                  <li key={i} className={`flex items-start gap-3 ${plan.popular ? "text-sky-200/50" : "text-slate-400"}`}>
                    <Icons.X className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-50" />
                    <span className="line-through">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#cta"
                className={`block w-full py-4 px-6 text-center font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                  plan.popular
                    ? "bg-white text-sky-600 hover:bg-sky-50 shadow-lg"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </motion.div>

        {/* Guarantee */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <Icons.Shield className="w-6 h-6 text-emerald-600" />
            <span className="text-emerald-800 font-medium">
              Garantie satisfait ou remboursé 30 jours. Pas de questions.
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FAQ SECTION
// ============================================================================
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Est-ce que l'essai gratuit est vraiment gratuit ?",
      answer: "Oui, 100% gratuit. 14 jours complets, toutes les fonctionnalités Pro. Pas de carte bancaire demandée. Si vous n'êtes pas convaincu, vous ne payez rien. Simple."
    },
    {
      question: "Combien de temps pour configurer Nexflow ?",
      answer: "La plupart de nos clients sont opérationnels en moins de 15 minutes. Import de contacts, configuration du pipeline, première automatisation... Notre assistant vous guide pas à pas. Et si vous bloquez, notre support répond en moins de 5 minutes."
    },
    {
      question: "Puis-je importer mes données existantes ?",
      answer: "Absolument. Excel, CSV, ou directement depuis votre ancien CRM (Salesforce, HubSpot, Pipedrive...). Notre IA détecte automatiquement les colonnes, déduplique les contacts et nettoie les données. Migration zéro stress."
    },
    {
      question: "Est-ce adapté à mon secteur ?",
      answer: "Nexflow est utilisé par +5000 entreprises dans tous les secteurs : BTP, commerce, services, immobilier, consulting... Nous avons des templates pré-configurés pour chaque métier. Votre pipeline est prêt en 2 clics."
    },
    {
      question: "Mes données sont-elles sécurisées ?",
      answer: "Sécurité maximale. Hébergement en France, chiffrement de bout en bout, conformité RGPD native, backups quotidiens, SSO disponible. Vos données restent vos données."
    },
    {
      question: "Puis-je annuler à tout moment ?",
      answer: "Oui, sans préavis. Un clic dans vos paramètres et c'est fait. Vous pouvez exporter toutes vos données à tout moment. Pas d'engagement, pas de surprise."
    },
  ];

  return (
    <section id="faq" className="py-20 md:py-32 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center mb-12"
        >
          <motion.span variants={fadeInUp} className="inline-block px-4 py-1.5 bg-sky-100 text-sky-700 text-sm font-semibold rounded-full mb-4">
            FAQ
          </motion.span>
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
            Questions fréquentes
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="space-y-4"
        >
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer"
              >
                <span className="font-semibold text-slate-900">{faq.question}</span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icons.ChevronDown className="w-5 h-5 text-slate-500" />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-slate-600 leading-relaxed">{faq.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FINAL CTA SECTION
// ============================================================================
function CTASection() {
  return (
    <section id="cta" className="py-20 md:py-32 bg-gradient-to-br from-sky-600 via-sky-500 to-violet-600 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Floating Elements */}
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
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
          <motion.div variants={scaleIn} className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            <span className="text-white font-semibold">127 personnes regardent cette page</span>
          </motion.div>

          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Arrêtez de perdre des ventes.
            <br />
            <span className="text-sky-200">Commencez aujourd&apos;hui.</span>
          </motion.h2>

          <motion.p variants={fadeInUp} className="text-lg text-sky-100 mb-10 max-w-2xl mx-auto">
            Rejoignez les 5 000+ entreprises qui ont transformé leur business avec Nexflow.
            <span className="block mt-2 font-semibold text-white">
              14 jours gratuits. Sans carte bancaire. Sans engagement.
            </span>
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a
              href="#"
              className="group inline-flex items-center justify-center gap-2 px-10 py-5 bg-white text-sky-600 font-bold text-lg rounded-2xl shadow-2xl hover:shadow-white/25 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              Démarrer mon essai gratuit
              <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>

          <motion.div variants={fadeIn} className="flex flex-wrap items-center justify-center gap-6 text-sm text-sky-200">
            <div className="flex items-center gap-2">
              <Icons.Shield className="w-5 h-5" />
              Sans carte bancaire
            </div>
            <div className="flex items-center gap-2">
              <Icons.Clock className="w-5 h-5" />
              Configuration 5 min
            </div>
            <div className="flex items-center gap-2">
              <Icons.Refresh className="w-5 h-5" />
              Annulation facile
            </div>
          </motion.div>
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
    Produit: ["Fonctionnalités", "Tarifs", "Intégrations", "API", "Changelog"],
    Entreprise: ["À propos", "Blog", "Carrières", "Presse", "Contact"],
    Ressources: ["Documentation", "Guides", "Webinaires", "Templates", "Statut"],
    Légal: ["Confidentialité", "CGU", "Cookies", "RGPD", "Sécurité"],
  };

  return (
    <footer className="bg-slate-900 text-slate-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4 cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center">
                <Icons.Bolt className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Nexflow</span>
            </Link>
            <p className="text-sm mb-4">Le CRM qui transforme votre chaos commercial en machine à vendre prévisible.</p>
            <div className="flex items-center gap-2">
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icons.Star key={i} className="w-4 h-4" />
                ))}
              </div>
              <span className="text-sm">4.9/5 sur 847 avis</span>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-4">{category}</h4>
              <ul className="space-y-2 text-sm">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="hover:text-white transition-colors cursor-pointer">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <p>&copy; {new Date().getFullYear()} Nexflow. Tous droits réservés.</p>
            <span className="hidden md:inline text-slate-700">|</span>
            <span>Fait avec passion en France</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer" aria-label="LinkedIn">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer" aria-label="Twitter">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
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
      <LiveNotification />
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <FeaturesSection />
      <IntegrationsSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  );
}
