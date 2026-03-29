import "~/styles/globals.css";

import { type Metadata } from "next";
import { ReactQueryProvider } from "~/providers/react-query-provider";
import { SidebarLayout } from "~/components/sidebar-layout";
import { AuthProvider } from "~/providers/auth-provider";
import { createClient } from "~/utils/supabase/server";

export const metadata: Metadata = {
  title: "DNAAnalyzer",
  description: "DNAAnalyzer - AI-Powered Genomic Analysis",
  icons: [{ rel: "icon", url: "/logo.png" }],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-void text-foreground antialiased selection:bg-phosphor selection:text-void">
        <ReactQueryProvider>
          <AuthProvider initialSession={session}>
            <SidebarLayout>
              {children}
            </SidebarLayout>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
