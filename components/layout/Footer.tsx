import { SITE } from "@/lib/site";
import { UtcClock } from "./UtcClock";

export function Footer() {
  const year = new Date().getUTCFullYear();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <UtcClock className="telemetry text-text-2" />
        <span className="telemetry text-text-3">{SITE.location.coords}</span>
        <span className="telemetry text-text-3">
          © {year} {SITE.name}
        </span>
      </div>
    </footer>
  );
}
