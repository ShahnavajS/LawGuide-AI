import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NavigationProgress } from '@/components/ui/NavigationProgress/NavigationProgress';

// Per-request CSP nonces require dynamic rendering so Next can attach the nonce
// to every framework script and style element.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'LawGuide AI — Legal language, made human.',
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
    <html lang="en">
      <body>
        <NavigationProgress />
        <Header />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
