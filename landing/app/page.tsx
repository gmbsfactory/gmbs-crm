"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ============================================================================
// NEXFLOW - PREMIUM LANDING PAGE
// ============================================================================
// Style: Exaggerated Minimalism + Trust & Authority
// Colors: Zinc (black/white) + Emerald accent (#059669)
// Typography: Geist/Inter - oversized headings, generous spacing
// ============================================================================

// ============================================================================
// ICONS - Stroke style, minimal
// ============================================================================
const Icons = {
  Logo: ({ className = "w-8 h-8" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <path
        d="M8 8L16 4L24 8V16L16 28L8 16V8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 12V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  ArrowRight: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
  Check: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
  Zap: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  Calendar: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  Shield: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  Mail: ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  ChevronDown: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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
};

// ============================================================================
// ANIMATION VARIANTS - Subtle, professional
// ============================================================================
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const } }
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

// ============================================================================
// NAVBAR - Clean, minimal
// ============================================================================
function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-50/80 backdrop-blur-sm border-b border-zinc-200/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 cursor-pointer group">
            <Icons.Logo className="w-8 h-8 text-emerald-600" />
            <span className="text-xl font-semibold text-zinc-950 tracking-tight">
              Nexflow
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {["Fonctionnalités", "Tarifs", "FAQ"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
                className="text-zinc-600 hover:text-zinc-950 text-sm font-medium transition-colors cursor-pointer"
              >
                {item}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-4">
            <a href="#" className="text-zinc-600 hover:text-zinc-950 text-sm font-medium transition-colors cursor-pointer">
              Connexion
            </a>
            <a
              href="#cta"
              className="px-4 py-2 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Essai gratuit
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-zinc-600 hover:text-zinc-950 cursor-pointer"
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
            className="md:hidden bg-zinc-50 border-t border-zinc-200"
          >
            <div className="px-6 py-4 space-y-3">
              {["Fonctionnalités", "Tarifs", "FAQ"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setIsOpen(false)}
                  className="block py-2 text-zinc-600 hover:text-zinc-950 font-medium cursor-pointer"
                >
                  {item}
                </a>
              ))}
              <hr className="border-zinc-200" />
              <a
                href="#cta"
                onClick={() => setIsOpen(false)}
                className="block py-3 bg-zinc-950 text-white font-medium rounded-lg text-center cursor-pointer"
              >
                Essai gratuit
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ============================================================================
// HERO SECTION - Bold, minimal
// ============================================================================
function HeroSection() {
  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-32 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-4xl"
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-8">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              14 jours d&apos;essai gratuit
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeInUp}
            className="text-[clamp(2.5rem,8vw,5rem)] font-bold text-zinc-950 leading-[1.1] tracking-tight mb-6"
          >
            Transformez chaque lead en client.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeInUp}
            className="text-xl md:text-2xl text-zinc-600 leading-relaxed mb-10 max-w-2xl"
          >
            Le CRM qui simplifie votre processus commercial.
            Pipeline visuel, automatisations intelligentes, résultats mesurables.
          </motion.p>

          {/* CTA */}
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4">
            <a
              href="#cta"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Commencer gratuitement
              <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-zinc-700 font-semibold rounded-xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all cursor-pointer"
            >
              Voir la démo
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            variants={fadeInUp}
            className="mt-12 pt-12 border-t border-zinc-200"
          >
            <p className="text-sm text-zinc-500 mb-4">Ils nous font confiance</p>
            {/* Client logos placeholder - ready for real logos */}
            <div className="flex flex-wrap items-center gap-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-8 w-24 bg-zinc-200 rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                  title={`Logo client ${i}`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// METRICS SECTION - Simple stats
// ============================================================================
function MetricsSection() {
  const metrics = [
    { value: "5,000+", label: "Entreprises actives" },
    { value: "2.4M", label: "Deals gérés" },
    { value: "98%", label: "Satisfaction client" },
    { value: "15min", label: "Temps de setup" },
  ];

  return (
    <section className="py-16 bg-white border-y border-zinc-200">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {metrics.map((metric, i) => (
            <motion.div key={i} variants={fadeIn} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-zinc-950 mb-1">
                {metric.value}
              </p>
              <p className="text-sm text-zinc-500">{metric.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FEATURES SECTION - Bento grid
// ============================================================================
function FeaturesSection() {
  const features = [
    {
      icon: Icons.Users,
      title: "Contacts centralisés",
      description: "Historique complet, scoring automatique, segmentation intelligente. Une vue 360° de chaque relation.",
    },
    {
      icon: Icons.Chart,
      title: "Pipeline visuel",
      description: "Visualisez chaque deal en temps réel. Drag & drop intuitif, prévisions précises.",
    },
    {
      icon: Icons.Zap,
      title: "Automatisations",
      description: "Relances automatiques, workflows personnalisés. Vous dormez, Nexflow travaille.",
    },
    {
      icon: Icons.Calendar,
      title: "Planning intelligent",
      description: "Synchronisation calendrier, rappels automatiques, optimisation des rendez-vous.",
    },
    {
      icon: Icons.Mail,
      title: "Email intégré",
      description: "Templates, tracking d'ouverture, séquences automatisées. Tout dans une interface.",
    },
    {
      icon: Icons.Shield,
      title: "Sécurité & RGPD",
      description: "Hébergement France, chiffrement bout en bout, conformité RGPD native.",
    },
  ];

  return (
    <section id="fonctionnalites" className="py-20 md:py-32 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="mb-16"
        >
          <motion.p variants={fadeInUp} className="text-emerald-600 font-medium mb-3">
            Fonctionnalités
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl md:text-4xl font-bold text-zinc-950 tracking-tight mb-4"
          >
            Tout ce qu&apos;il faut pour vendre plus.
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-zinc-600 max-w-2xl">
            Des outils puissants, une interface simple. Concentrez-vous sur vos clients, pas sur votre logiciel.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className="group p-8 bg-white rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-900/5 transition-all duration-200 cursor-pointer"
            >
              <feature.icon className="w-6 h-6 text-emerald-600 mb-4" />
              <h3 className="text-lg font-semibold text-zinc-950 mb-2">
                {feature.title}
              </h3>
              <p className="text-zinc-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// TESTIMONIAL SECTION - Single powerful quote
// ============================================================================
function TestimonialSection() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center"
        >
          <motion.div variants={fadeIn} className="mb-8">
            {/* Client logo placeholder */}
            <div className="inline-block h-10 w-32 bg-zinc-200 rounded mb-6" />
          </motion.div>

          <motion.blockquote
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-medium text-zinc-950 leading-relaxed mb-8"
          >
            &ldquo;En 3 mois, on est passé de 12 à 47 deals closés par mois.
            Nexflow a transformé notre façon de vendre.&rdquo;
          </motion.blockquote>

          <motion.div variants={fadeInUp} className="flex items-center justify-center gap-4">
            {/* Avatar placeholder */}
            <div className="w-12 h-12 rounded-full bg-zinc-200" />
            <div className="text-left">
              <p className="font-semibold text-zinc-950">Marie Leroy</p>
              <p className="text-sm text-zinc-500">Directrice Commerciale, TechSolutions</p>
            </div>
          </motion.div>

          {/* Metrics */}
          <motion.div
            variants={fadeInUp}
            className="mt-12 pt-12 border-t border-zinc-200 grid grid-cols-3 gap-8"
          >
            {[
              { value: "+292%", label: "Deals/mois" },
              { value: "-61%", label: "Temps de closing" },
              { value: "+73%", label: "CA mensuel" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{stat.value}</p>
                <p className="text-sm text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// PRICING SECTION - Clean, horizontal
// ============================================================================
function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Starter",
      description: "Pour les petites équipes",
      price: isAnnual ? 29 : 39,
      features: ["3 utilisateurs", "1 000 contacts", "Pipeline de ventes", "Support email"],
      cta: "Commencer",
      highlighted: false,
    },
    {
      name: "Pro",
      description: "Pour les équipes en croissance",
      price: isAnnual ? 79 : 99,
      features: ["15 utilisateurs", "Contacts illimités", "Automatisations", "Support prioritaire", "Intégrations API"],
      cta: "Essai gratuit",
      highlighted: true,
    },
    {
      name: "Enterprise",
      description: "Pour les grandes organisations",
      price: null,
      features: ["Utilisateurs illimités", "SSO & sécurité avancée", "Account manager dédié", "SLA garanti"],
      cta: "Nous contacter",
      highlighted: false,
    },
  ];

  return (
    <section id="tarifs" className="py-20 md:py-32 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center mb-12"
        >
          <motion.p variants={fadeInUp} className="text-emerald-600 font-medium mb-3">
            Tarifs
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl md:text-4xl font-bold text-zinc-950 tracking-tight mb-4"
          >
            Simple et transparent.
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-lg text-zinc-600">
            14 jours d&apos;essai gratuit sur tous les plans. Sans carte bancaire.
          </motion.p>
        </motion.div>

        {/* Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <span className={`text-sm font-medium ${!isAnnual ? "text-zinc-950" : "text-zinc-500"}`}>
            Mensuel
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-12 h-6 bg-zinc-200 rounded-full transition-colors cursor-pointer"
            style={{ backgroundColor: isAnnual ? "#059669" : "#e4e4e7" }}
          >
            <motion.span
              animate={{ x: isAnnual ? 24 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
            />
          </button>
          <span className={`text-sm font-medium ${isAnnual ? "text-zinc-950" : "text-zinc-500"}`}>
            Annuel
            <span className="ml-2 text-emerald-600 text-xs font-semibold">-25%</span>
          </span>
        </motion.div>

        {/* Plans */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-6"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className={`p-8 rounded-2xl transition-all duration-200 ${
                plan.highlighted
                  ? "bg-zinc-950 text-white ring-2 ring-zinc-950"
                  : "bg-white border border-zinc-200"
              }`}
            >
              <div className="mb-6">
                <h3 className={`text-lg font-semibold mb-1 ${plan.highlighted ? "text-white" : "text-zinc-950"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm ${plan.highlighted ? "text-zinc-400" : "text-zinc-500"}`}>
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                {plan.price ? (
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${plan.highlighted ? "text-white" : "text-zinc-950"}`}>
                      {plan.price}€
                    </span>
                    <span className={plan.highlighted ? "text-zinc-400" : "text-zinc-500"}>/mois</span>
                  </div>
                ) : (
                  <span className={`text-2xl font-bold ${plan.highlighted ? "text-white" : "text-zinc-950"}`}>
                    Sur mesure
                  </span>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className={`flex items-start gap-3 text-sm ${plan.highlighted ? "text-zinc-300" : "text-zinc-600"}`}>
                    <Icons.Check className={`w-5 h-5 flex-shrink-0 ${plan.highlighted ? "text-emerald-400" : "text-emerald-600"}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href="#cta"
                className={`block w-full py-3 text-center font-semibold rounded-lg transition-colors cursor-pointer ${
                  plan.highlighted
                    ? "bg-white text-zinc-950 hover:bg-zinc-100"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FAQ SECTION - Accordion
// ============================================================================
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "L'essai gratuit est-il vraiment gratuit ?",
      answer: "Oui, 14 jours complets avec toutes les fonctionnalités. Aucune carte bancaire requise. Si vous n'êtes pas convaincu, vous ne payez rien."
    },
    {
      question: "Combien de temps pour être opérationnel ?",
      answer: "La plupart de nos clients sont opérationnels en moins de 15 minutes. Import de contacts, configuration du pipeline, première automatisation - notre assistant vous guide pas à pas."
    },
    {
      question: "Puis-je importer mes données existantes ?",
      answer: "Absolument. Excel, CSV, ou directement depuis votre ancien CRM. Notre système détecte automatiquement les colonnes et nettoie les données."
    },
    {
      question: "Mes données sont-elles sécurisées ?",
      answer: "Hébergement en France, chiffrement de bout en bout, conformité RGPD native, backups quotidiens. Vos données restent vos données."
    },
    {
      question: "Puis-je annuler à tout moment ?",
      answer: "Oui, sans préavis. Un clic dans vos paramètres. Vous pouvez exporter toutes vos données à tout moment."
    },
  ];

  return (
    <section id="faq" className="py-20 md:py-32 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="text-center mb-12"
        >
          <motion.p variants={fadeInUp} className="text-emerald-600 font-medium mb-3">
            FAQ
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl md:text-4xl font-bold text-zinc-950 tracking-tight"
          >
            Questions fréquentes
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="space-y-3"
        >
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className="bg-zinc-50 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer"
              >
                <span className="font-medium text-zinc-950">{faq.question}</span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icons.ChevronDown className="w-5 h-5 text-zinc-500" />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-zinc-600 leading-relaxed">
                      {faq.answer}
                    </p>
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
// CTA SECTION - Simple, focused
// ============================================================================
function CTASection() {
  return (
    <section id="cta" className="py-20 md:py-32 bg-zinc-950">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.h2
            variants={fadeInUp}
            className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6"
          >
            Prêt à transformer votre business ?
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto"
          >
            Rejoignez les 5 000+ entreprises qui utilisent Nexflow.
            14 jours gratuits, sans engagement.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Démarrer gratuitement
              <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </motion.div>

          <motion.p variants={fadeIn} className="mt-6 text-sm text-zinc-500">
            Sans carte bancaire · Configuration en 5 min · Annulation facile
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER - Minimal
// ============================================================================
function Footer() {
  return (
    <footer className="py-12 bg-zinc-50 border-t border-zinc-200">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Icons.Logo className="w-6 h-6 text-emerald-600" />
            <span className="font-semibold text-zinc-950">Nexflow</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            {["Fonctionnalités", "Tarifs", "FAQ", "Contact", "Confidentialité", "CGU"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
              >
                {link}
              </a>
            ))}
          </div>

          {/* Copyright */}
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} Nexflow
          </p>
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
    <main className="min-h-screen bg-zinc-50 antialiased">
      <Navbar />
      <HeroSection />
      <MetricsSection />
      <FeaturesSection />
      <TestimonialSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  );
}
