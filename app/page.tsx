import { SITE } from "@/lib/site";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-24 px-4 py-16 sm:px-6">
      {/* Hero — Phase 1 replaces the placeholder panel with the point cloud. */}
      <section
        aria-labelledby="hero-heading"
        className="grid gap-10 lg:grid-cols-2 lg:items-center"
      >
        <div className="flex flex-col gap-6">
          <h1
            id="hero-heading"
            className="max-w-[18ch] text-4xl font-medium leading-[1.1] text-text sm:text-5xl"
          >
            Spacecraft geometry. Volumetric video. Systems that ship.
          </h1>
          {/* TODO(trey): 2-sentence subhead (Phase 2 — full home copy). */}
          <p className="telemetry flex items-center gap-2 text-text-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            />
            ASPERA: MISSION SW — ACTIVE · TUCSON, AZ
          </p>
        </div>

        {/* Fixed-aspect placeholder reserves the hero footprint — zero layout shift. */}
        <div
          className="aspect-square w-full border border-border"
          aria-hidden
        />
      </section>

      {/* Selected work — Phase 2 renders the manifest table here. */}
      <section id="work" aria-labelledby="work-heading" className="flex flex-col gap-4">
        <h2 id="work-heading" className="label">
          Selected Work
        </h2>
        {/* TODO(trey): manifest table + experience + secondary projects (Phase 2). */}
      </section>

      {/* Contact — real details from the brief. */}
      <section id="contact" aria-labelledby="contact-heading" className="flex flex-col gap-4">
        <h2 id="contact-heading" className="label">
          Contact
        </h2>
        <ul className="flex flex-col gap-2">
          <li>
            <a
              href={`mailto:${SITE.contact.email}`}
              className="telemetry text-text transition-colors hover:text-accent"
            >
              {SITE.contact.email}
            </a>
          </li>
          <li>
            <a
              href={SITE.contact.github}
              className="telemetry text-text transition-colors hover:text-accent"
              rel="me noopener noreferrer"
              target="_blank"
            >
              {SITE.contact.githubLabel}
            </a>
          </li>
          <li>
            <a
              href={SITE.contact.linkedin}
              className="telemetry text-text transition-colors hover:text-accent"
              rel="me noopener noreferrer"
              target="_blank"
            >
              {SITE.contact.linkedinLabel}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
