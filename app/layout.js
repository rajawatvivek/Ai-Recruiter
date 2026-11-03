import "./globals.css";

// Root layout required by the Next.js App Router
export const metadata = { title: "HireSense AI - Resume Screening" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
