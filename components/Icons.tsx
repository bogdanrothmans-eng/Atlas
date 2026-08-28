import type { SVGProps } from "react";

export type IconName =
  | "arrow-left"
  | "camera"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "close"
  | "documents"
  | "family"
  | "food"
  | "flag"
  | "health"
  | "leisure"
  | "location"
  | "message"
  | "plus"
  | "route"
  | "search"
  | "send"
  | "thumb-down"
  | "thumb-up"
  | "user"
  | "work";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

export function Icon({ name, ...props }: IconProps) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    focusable: false,
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    ...props,
  };

  const paths: Record<IconName, React.ReactNode> = {
    "arrow-left": <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
    camera: <><path d="M14.5 5 13 3h-2L9.5 5H6a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3Z" /><circle cx="12" cy="12.5" r="3.5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
    documents: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    family: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9" r="2" /><path d="M15.5 14.5a4 4 0 0 1 5 3.9" /></>,
    food: <><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" /><path d="M16 3v18M16 3c2.5 1.5 3.5 4 3.5 6.5H16" /></>,
    flag: <><path d="M5 21V4" /><path d="M5 5h10l-1 4 3 4H5" /></>,
    health: <><path d="M12 4v16" /><path d="M4 12h16" /></>,
    leisure: <><path d="m12 3 1.5 5.2L19 10l-5.5 1.8L12 17l-1.5-5.2L5 10l5.5-1.8L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    "thumb-down": <><path d="M7 3v12" /><path d="M7 13 11 21c2 0 3-1 3-3v-3h4a3 3 0 0 0 3-3l-1-6a3 3 0 0 0-3-3Z" /><path d="M3 3h4v12H3Z" /></>,
    "thumb-up": <><path d="M7 21V9" /><path d="m7 11 4-8c2 0 3 1 3 3v3h4a3 3 0 0 1 3 3l-1 6a3 3 0 0 1-3 3Z" /><path d="M3 9h4v12H3Z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    work: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}
