import type { AppProps } from "next/app";
import "maplibre-gl/dist/maplibre-gl.css";
import "../styles/globals.css";
import { AuthProvider } from "../components/AuthProvider";

export default function App({ Component, pageProps }: AppProps) {
  return <AuthProvider><Component {...pageProps} /></AuthProvider>;
}
