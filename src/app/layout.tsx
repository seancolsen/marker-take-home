import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { AudioGate } from "@/components/AudioGate";
import { TutorialProvider } from "@/components/tutorial";
import "./globals.css";

const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "How to analyze a song’s chord progression",
  description:
    "A hands-on mini tutorial: find a song’s tonal center, its scale, the chords that fit, and finally its chord progression — all by ear.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff6ea",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body>
        <div className="backdrop" aria-hidden="true" />
        <AudioGate>
          <TutorialProvider>{children}</TutorialProvider>
        </AudioGate>
      </body>
    </html>
  );
}
