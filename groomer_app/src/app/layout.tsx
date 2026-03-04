import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Groomer App',
  description: 'A management system for grooming salons.',
};

export default function RootLayout({
  children,
}: Readonly<{ 
  children: React.ReactNode; 
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
