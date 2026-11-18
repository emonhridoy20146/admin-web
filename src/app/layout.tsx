import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Howlader Electronics APPS Control', template: '%s · Howlader Electronics' },
  description: 'Howlader Electronics Field operations control room',
  robots: { index: false, follow: false },
  icons: { icon: '/icons/favicon.svg' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#FBFCFD' }, { media: '(prefers-color-scheme: dark)', color: '#0B0E14' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
