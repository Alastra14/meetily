/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		// Ternova Meet: Gosha (display/títulos), Space Grotesk (subtítulos),
  		// Montserrat (body). OJO: nunca dejar aquí una var() que no exista —
  		// una var indefinida invalida TODO el font-family y cae a serif.
  		fontFamily: {
  			sans: [
  				'var(--font-body)',
  				'system-ui',
  				'sans-serif'
  			],
  			subtitle: [
  				'var(--font-subtitle)',
  				'system-ui',
  				'sans-serif'
  			],
  			display: [
  				'var(--font-display)',
  				'sans-serif'
  			]
  		},
  		// Escala tipográfica (migrada desde el tailwind.config.ts eliminado)
  		fontSize: {
  			'display': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
  			'h1': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
  			'h2': ['18px', { lineHeight: '1.4', fontWeight: '500' }],
  			'body': ['16px', { lineHeight: '1.6', fontWeight: '400' }],
  			'small': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
  			'caption': ['12px', { lineHeight: '1.4', fontWeight: '400' }]
  		},
  		colors: {
  			// === Remapeo de la escala `blue` a la rampa indigo de Ternova ===
  			// Las ~153 clases blue-* repartidas en la app renderizan marca sin
  			// tocar componentes (capa de tema, merge-safe con upstream).
  			blue: {
  				50: '#F4F0FA',
  				100: '#E8E1F5',
  				200: '#D4C8EE',
  				300: '#9A83D6',
  				400: '#7857C5',
  				500: '#5A37B0',
  				600: '#4A2399',
  				700: '#3A1380',
  				800: '#2A0A60',
  				900: '#1D0447',
  				950: '#13002E'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			tertiary: '#64748b',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
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
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
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
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}