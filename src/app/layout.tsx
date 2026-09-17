import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'LexiGuide AI — Legal language, made human.',
  description:
    'Understand your legal documents, find key obligations and risks, compare versions, and prepare with confidence. GenAI-powered legal information grounded in verifiable evidence.',
  keywords: [
    'legal document analysis',
    'contract summarizer',
    'plain language legal',
    'contract review assistant',
    'legal AI',
    'evidence citations',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Header />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
