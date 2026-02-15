import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			status: {
  				demanded: 'hsl(var(--status-demanded))',
  				quote: 'hsl(var(--status-quote))',
  				accepted: 'hsl(var(--status-accepted))',
  				inprogress: 'hsl(var(--status-inprogress))',
  				techvisit: 'hsl(var(--status-techvisit))',
  				done: 'hsl(var(--status-done))',
  				cancelled: 'hsl(var(--status-cancelled))',
  				refused: 'hsl(var(--status-refused))',
  				standby: 'hsl(var(--status-standby))',
  				sav: 'hsl(var(--status-sav))'
  			},
  			gold: {
  				DEFAULT: 'hsl(var(--gold))',
  				glow: 'hsl(var(--gold-glow))'
  			},
  			silver: {
  				DEFAULT: 'hsl(var(--silver))',
  				glow: 'hsl(var(--silver-glow))'
  			},
  			bronze: {
  				DEFAULT: 'hsl(var(--bronze))',
  				glow: 'hsl(var(--bronze-glow))'
  			},
  			cold: {
  				DEFAULT: 'hsl(var(--cold))',
  				glow: 'hsl(var(--cold-glow))'
  			}
  		},
  		borderRadius: {
  			xl: 'var(--radius-xl)',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			card: 'var(--card-shadow)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'slide-in-right': {
  				'0%, 100%': {
  					transform: 'translateX(100%)',
  					opacity: '0'
  				},
  				'20%, 80%': {
  					transform: 'translateX(0)',
  					opacity: '1'
  				}
  			},
  			'fade-in': {
  				'0%, 100%': {
  					opacity: '0.2'
  				},
  				'20%, 80%': {
  					opacity: '1'
  				}
  			},
  			'scale-in': {
  				'0%, 100%': {
  					transform: 'scale(0.85)',
  					opacity: '0.7'
  				},
  				'20%, 80%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			},
  			'fullscreen-expand': {
  				'0%, 100%': {
  					transform: 'scale(0.98)',
  					opacity: '0.8'
  				},
  				'20%, 80%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			},
  			'caret-blink': {
  				'0%,70%,100%': {
  					opacity: '1'
  				},
  				'20%,50%': {
  					opacity: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'caret-blink': 'caret-blink 1.25s ease-out infinite'
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};

export default config;
