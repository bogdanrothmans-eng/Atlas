import dynamic from "next/dynamic";
import Head from "next/head";
const AtlasMap = dynamic(() => import("../components/AtlasMap"), { ssr: false, loading: () => <div className="map-loading" role="status">Загружаем Atlas…</div> });
export default function Home() { return <><Head><title>Atlas — полезные места рядом</title><meta name="description" content="Карта проверенных мест для релокантов и путешественников" /><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /></Head><AtlasMap /></>; }
