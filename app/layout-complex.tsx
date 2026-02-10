import type React from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Inter } from "next/font/google"
import "./globals.css"
import { SidebarProvider } from "@/components/ui/sidebar"
import SidebarGate from "@/components/layout/sidebar-gate"
import { Toaster } from "@/components/ui/toaster"
import { InterfaceProvider } from "@/contexts/interface-context"
import { UserStatusProvider } from "@/contexts/user-status-context"
import ThemeWrapper from "@/components/layout/theme-wrapper"
import TopbarGate from "@/components/layout/topbar-gate"
import { SettingsProvider } from "@/components/layout/settings-provider"
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider"
import { AuthStateListenerProvider } from "@/providers/AuthStateListenerProvider"
import GlobalShortcuts from "@/components/layout/global-shortcuts"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "GMBS CRM - Dashboard",
  description: "Interface CRM moderne pour GMBS",
    generator: 'v0.app'
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const isAuthed = Boolean(cookieStore.get('sb-access-token')?.value)
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pré-applique le thème avant l'hydratation pour éviter le flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const root = document.documentElement;
    const rawSettings = localStorage.getItem('gmbs:settings');
    let settings = null;
    if (rawSettings) {
      try {
        settings = JSON.parse(rawSettings) || {};
      } catch (_) { /* Silenced: corrupted localStorage data, use defaults */ }
    }
    let storedMode = localStorage.getItem('color-mode');
    if (!storedMode && settings && typeof settings.theme === 'string') storedMode = settings.theme;
    const classEffect = settings && settings.classEffect === false ? false : true;
    const accents = {
      indigo: { light: { h: "228 78% 55%", c: "oklch(0.63 0.20 260)", l: "oklch(0.78 0.14 260)", r: "228 82% 58%", p: "228 78% 55%", pf: "0 0% 100%", af: "0 0% 100%" }, dark: { h: "228 88% 70%", c: "oklch(0.82 0.18 260)", l: "oklch(0.90 0.12 260)", r: "228 90% 72%", p: "228 88% 70%", pf: "222 84% 4.9%", af: "222 84% 4.9%" } },
      emerald: { light: { h: "152 65% 45%", c: "oklch(0.62 0.17 150)", l: "oklch(0.78 0.12 150)", r: "152 70% 48%", p: "152 65% 45%", pf: "0 0% 100%", af: "0 0% 100%" }, dark: { h: "152 55% 62%", c: "oklch(0.78 0.14 150)", l: "oklch(0.86 0.10 150)", r: "152 58% 60%", p: "152 55% 62%", pf: "222 84% 4.9%", af: "222 84% 4.9%" } },
      violet: { light: { h: "270 75% 36%", c: "oklch(0.55 0.21 300)", l: "oklch(0.78 0.18 300)", r: "270 75% 36%", p: "270 75% 36%", pf: "0 0% 100%", af: "0 0% 100%" }, dark: { h: "270 75% 76%", c: "oklch(0.78 0.21 300)", l: "oklch(0.88 0.15 300)", r: "270 75% 72%", p: "270 75% 72%", pf: "222 84% 4.9%", af: "0 0% 12%" } },
      amber: { light: { h: "35 92% 55%", c: "oklch(0.72 0.15 75)", l: "oklch(0.84 0.12 75)", r: "35 95% 58%", p: "35 92% 55%", pf: "0 0% 0%", af: "0 0% 12%" }, dark: { h: "35 90% 68%", c: "oklch(0.86 0.12 75)", l: "oklch(0.92 0.09 75)", r: "35 92% 70%", p: "35 90% 68%", pf: "24 90% 14%", af: "24 90% 10%" } },
      rose: { light: { h: "345 80% 58%", c: "oklch(0.65 0.24 20)", l: "oklch(0.82 0.16 20)", r: "345 82% 60%", p: "345 80% 58%", pf: "0 0% 100%", af: "0 0% 100%" }, dark: { h: "345 82% 72%", c: "oklch(0.84 0.18 20)", l: "oklch(0.90 0.12 20)", r: "345 84% 74%", p: "345 82% 72%", pf: "222 84% 4.9%", af: "222 84% 4.9%" } }
    };
    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }
    function normalizeHex(hex) {
      if (!hex) return null;
      const value = hex.trim();
      const short = /^#([0-9a-f]{3})$/i;
      const full = /^#([0-9a-f]{6})$/i;
      if (full.test(value)) return value.toLowerCase();
      if (short.test(value)) {
        return '#' + value.slice(1).split('').map((c) => c + c).join('').toLowerCase();
      }
      return null;
    }
    function hexToHslParts(hex) {
      const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!match) return [0, 0, 0];
      const r = parseInt(match[1], 16) / 255;
      const g = parseInt(match[2], 16) / 255;
      const b = parseInt(match[3], 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    }
    function pickForeground(l) {
      return l > 55 ? '222 84% 4.9%' : '0 0% 100%';
    }
    function buildCustomAccent(hex) {
      const parts = hexToHslParts(hex);
      const h = parts[0];
      const s = parts[1];
      const l = parts[2];
      const base = h + ' ' + s + '% ' + l + '%';
      const lighter = h + ' ' + clamp(s - 8, 0, 100) + '% ' + clamp(l + 18, 0, 100) + '%';
      const brighter = h + ' ' + clamp(s + 5, 0, 100) + '% ' + clamp(l + 10, 0, 100) + '%';
      return {
        light: { h: base, c: 'hsl(' + base + ')', l: 'hsl(' + lighter + ')', r: base, p: base, pf: pickForeground(l), af: pickForeground(l) },
        dark: { h: brighter, c: 'hsl(' + brighter + ')', l: 'hsl(' + lighter + ')', r: brighter, p: brighter, pf: '222 84% 4.9%', af: '222 84% 4.9%' }
      };
    }
    const rawAccent = localStorage.getItem('ui-accent') || 'indigo';
    const storedCustom = localStorage.getItem('ui-accent-custom');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = storedMode === 'light' || storedMode === 'dark' || storedMode === 'system' ? storedMode : 'system';
    const resolved = classEffect && (mode === 'dark' || (mode === 'system' && prefersDark)) ? 'dark' : 'light';
    if (resolved === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    root.setAttribute('data-theme', resolved);
    let tone;
    if (rawAccent.startsWith('custom:')) {
      const customHex = normalizeHex(rawAccent.slice(7)) || normalizeHex(storedCustom) || '#6366f1';
      const customTone = buildCustomAccent(customHex);
      tone = resolved === 'dark' ? customTone.dark : customTone.light;
    } else if (accents[rawAccent]) {
      const preset = accents[rawAccent];
      tone = resolved === 'dark' ? preset.dark : preset.light;
    } else {
      const preset = accents.indigo;
      tone = resolved === 'dark' ? preset.dark : preset.light;
    }
    root.classList.add('theme-formal');
    root.classList.remove('theme-color');
    root.classList.remove('theme-glass');
    if (tone) {
      root.style.setProperty('--accent-hsl', tone.h);
      root.style.setProperty('--accent', tone.h);
      root.style.setProperty('--accent-color', tone.c);
      root.style.setProperty('--accent-color-light', tone.l);
      root.style.setProperty('--ring', tone.r);
      root.style.setProperty('--accent-foreground', tone.af || '0 0% 100%');
      root.style.setProperty('--primary', tone.p || tone.h);
      root.style.setProperty('--primary-foreground', tone.pf || tone.af || '0 0% 100%');
    }
  } catch (_) { /* Silenced: SSR or DOM not ready for theme application */ }
})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <a href="#main" className="sr-only focus:not-sr-only fixed top-2 left-2 z-[1000] bg-background border rounded px-2 py-1">
          Aller au contenu
        </a>
        <SettingsProvider>
          <ReactQueryProvider>
            <AuthStateListenerProvider>
              <UserStatusProvider>
              <InterfaceProvider>
                <ThemeWrapper>
                  <SidebarProvider>
                    <div className="flex flex-col min-h-screen w-full overflow-hidden">
                      {/* Topbar en haut, couvrant toute la largeur */}
                      <div className="sticky top-0 z-50 w-full">
                        <TopbarGate />
                      </div>
                      {/* Sidebar et contenu principal en dessous */}
                      <div className="flex flex-1 overflow-hidden">
                        <SidebarGate isAuthed={isAuthed} />
                        <main id="main" className="flex flex-1 flex-col overflow-hidden">
                          <GlobalShortcuts />
                          <div className="flex-1 overflow-auto">
                            {children}
                          </div>
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ThemeWrapper>
              </InterfaceProvider>
            </UserStatusProvider>
            </AuthStateListenerProvider>
          </ReactQueryProvider>
        </SettingsProvider>
        <Toaster />
      </body>
    </html>
  )
}
