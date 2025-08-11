import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Runway Video-to-Video',
  description: 'Generate videos from videos using Runway AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
          <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
            <div className="container mx-auto px-4 py-4">
              <h1 className="text-2xl font-bold text-white"> Video-to-Video</h1>
              <p className="text-slate-400 text-sm mt-1">
                Transform videos with AI-powered video-to-video generation
              </p>
            </div>
          </header>
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}