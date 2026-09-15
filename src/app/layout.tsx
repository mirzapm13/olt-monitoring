import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Mikroin Monitor",
  description: "Aplikasi monitoring SNMP OLT untuk pantauan jaringan yang cepat dan rapi.",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var savedTheme = localStorage.getItem("mikroin-theme");
                var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                var darkMode = savedTheme ? savedTheme === "dark" : prefersDark;
                document.documentElement.classList.toggle("dark", darkMode);
                document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
