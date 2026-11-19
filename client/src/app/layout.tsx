import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StoreProvider from "@/redux/store_provider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ricoz | Build Your Franchise Business",
  description:
    "Build your business with the backing of the Ricoz franchise ecosystem, including technology, operations, training and ongoing support.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StoreProvider>
          {children}

          <Toaster
            position="top-center"
            theme="dark"
            richColors
            toastOptions={{
              style: {
                width: "fit-content",
              },
            }}
          />
        </StoreProvider>
      </body>
    </html>
  );
}
