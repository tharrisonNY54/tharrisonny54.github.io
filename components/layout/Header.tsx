import Link from "next/link";

import { NAV, SITE } from "@/lib/site";
import { UtcClock } from "./UtcClock";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="telemetry text-text transition-colors hover:text-accent"
        >
          {SITE.handle}
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="label transition-colors hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
          <UtcClock className="telemetry hidden text-text-2 sm:inline" />
        </nav>
      </div>
    </header>
  );
}
