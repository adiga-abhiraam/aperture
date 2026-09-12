import type { Metadata } from "next";
import { AuthProvider } from "@/features/auth";
import { UploadProvider } from "@/features/upload";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aperture",
  description:
    "Search any video archive the way you remember it — by spoken dialogue, visual events, objects, or actions.",
  icons: {
    icon: "/favicon.svg",
    apple: "/aperture-icon-180.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <AuthProvider>
          <UploadProvider>{children}</UploadProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
