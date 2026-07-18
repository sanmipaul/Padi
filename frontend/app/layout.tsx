import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Space_Grotesk, Manrope } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Padi",
  description: "On-chain Ludo vs AI. Roll with your padi on Celo.",
  other: {
    "talentapp:project_verification": "67bf683c08365cd93e55c9586942803602164d6384f58a87ee1b97bc6ea391520b438dd9adad901add28437f532731ba3df861e6442cf079ced56ca3595729dd",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${manrope.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
