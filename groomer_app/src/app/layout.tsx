import type { Metadata } from 'next';
import { cookies } from 'next/headers'
import { PointerCaptureGuard } from '@/components/dev/PointerCaptureGuard'
import { ThemeHydrator } from '@/components/ui/ThemeHydrator'
import { UI_THEMES } from '@/lib/ui/themes'
import { resolveUiThemeOrDefault, UI_THEME_COOKIE, UI_THEME_STORAGE_KEY } from '@/lib/ui/theme-preference'
import '@fontsource/inter/latin.css'
import './globals.css';

export const metadata: Metadata = {
  title: 'Groomer App',
  description: 'A management system for grooming salons.',
};

const themeBootstrapScript = `(function(){try{var k='${UI_THEME_STORAGE_KEY}';var v=sessionStorage.getItem(k);if(!v){return;}var allowed=${JSON.stringify(
  UI_THEMES
)};if(allowed.indexOf(v)===-1){return;}document.documentElement.setAttribute('data-theme',v);}catch(_e){}})();`

export default async function RootLayout({
  children,
}: Readonly<{ 
  children: React.ReactNode; 
}>) {
  const cookieStore = await cookies()
  const initialTheme = resolveUiThemeOrDefault(cookieStore.get(UI_THEME_COOKIE)?.value)

  return (
    <html lang="ja" data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <ThemeHydrator />
        <PointerCaptureGuard />
        {children}
      </body>
    </html>
  );
}
