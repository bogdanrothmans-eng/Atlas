import type { AppProps } from "next/app";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/styles/globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/sonner";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
      {/*
        No `richColors`: its error palette renders #e60000 on #fff0f0, which is
        4.34:1 and fails AA. The theme surface keeps toast text high-contrast,
        and sonner still distinguishes types by icon.
      */}
      <Toaster position="bottom-center" closeButton />
    </AuthProvider>
  );
}
