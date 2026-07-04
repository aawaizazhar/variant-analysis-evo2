import "~/styles/globals.css";

import { type Metadata } from "next";
import { ReactQueryProvider } from "~/providers/react-query-provider";
import { SidebarLayout } from "~/components/sidebar-layout";
import { AuthProvider } from "~/providers/auth-provider";
import { ThemeProvider } from "~/providers/theme-provider";
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
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .single()
    : { data: null };
  const initialThemeClass =
    profile?.theme_preference === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      className={initialThemeClass}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased selection:bg-phosphor selection:text-primary-foreground">
        <ReactQueryProvider>
          <AuthProvider initialUser={user}>
            <ThemeProvider>
              <SidebarLayout>
                {children}
              </SidebarLayout>
            </ThemeProvider>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
