
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				// Cinzas e violeta por variável: a Sinfy troca os valores dentro do app (src/index.css, html.se-sinfy)
				gray: { 50: 'rgb(var(--c-gray-50) / <alpha-value>)', 100: 'rgb(var(--c-gray-100) / <alpha-value>)', 200: 'rgb(var(--c-gray-200) / <alpha-value>)', 300: 'rgb(var(--c-gray-300) / <alpha-value>)', 400: 'rgb(var(--c-gray-400) / <alpha-value>)', 500: 'rgb(var(--c-gray-500) / <alpha-value>)', 600: 'rgb(var(--c-gray-600) / <alpha-value>)', 700: 'rgb(var(--c-gray-700) / <alpha-value>)', 800: 'rgb(var(--c-gray-800) / <alpha-value>)', 900: 'rgb(var(--c-gray-900) / <alpha-value>)', 950: 'rgb(var(--c-gray-950) / <alpha-value>)' },
				zinc: { 50: 'rgb(var(--c-zinc-50) / <alpha-value>)', 100: 'rgb(var(--c-zinc-100) / <alpha-value>)', 200: 'rgb(var(--c-zinc-200) / <alpha-value>)', 300: 'rgb(var(--c-zinc-300) / <alpha-value>)', 400: 'rgb(var(--c-zinc-400) / <alpha-value>)', 500: 'rgb(var(--c-zinc-500) / <alpha-value>)', 600: 'rgb(var(--c-zinc-600) / <alpha-value>)', 700: 'rgb(var(--c-zinc-700) / <alpha-value>)', 800: 'rgb(var(--c-zinc-800) / <alpha-value>)', 900: 'rgb(var(--c-zinc-900) / <alpha-value>)', 950: 'rgb(var(--c-zinc-950) / <alpha-value>)' },
				violet: { 50: 'rgb(var(--c-violet-50) / <alpha-value>)', 100: 'rgb(var(--c-violet-100) / <alpha-value>)', 200: 'rgb(var(--c-violet-200) / <alpha-value>)', 300: 'rgb(var(--c-violet-300) / <alpha-value>)', 400: 'rgb(var(--c-violet-400) / <alpha-value>)', 500: 'rgb(var(--c-violet-500) / <alpha-value>)', 600: 'rgb(var(--c-violet-600) / <alpha-value>)', 700: 'rgb(var(--c-violet-700) / <alpha-value>)', 800: 'rgb(var(--c-violet-800) / <alpha-value>)', 900: 'rgb(var(--c-violet-900) / <alpha-value>)', 950: 'rgb(var(--c-violet-950) / <alpha-value>)' },
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				lifetime: {
					DEFAULT: 'hsl(var(--lifetime-bg))',
					foreground: 'hsl(var(--lifetime-foreground))',
					accent: 'hsl(var(--lifetime-accent))'
				},
				'pro-gradient': {
					from: 'hsl(var(--pro-gradient-from))',
					to: 'hsl(var(--pro-gradient-to))'
				},
				'dark-button': {
					DEFAULT: 'hsl(var(--dark-button))',
					foreground: 'hsl(var(--dark-button-foreground))'
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
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				jobbar: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } },
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
				'scale-in': {
					from: {
						opacity: '0',
						transform: 'scale(0.8)'
					},
					to: {
						opacity: '1',
						transform: 'scale(1)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'scale-in': 'scale-in 0.2s ease-out'
			}
		}
	},
	plugins: [
		require("tailwindcss-animate")
	],
} satisfies Config;
