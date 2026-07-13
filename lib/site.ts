/** Canonical site metadata and navigation. Single source of truth. */
export const SITE = {
  name: "Trey Harrison",
  handle: "T.HARRISON",
  url: "https://treyharrison.dev",
  description:
    "Software developer on NASA's ASPERA mission (SPICE geometry and ephemeris tooling) and volumetric capture developer at the UA Center for Digital Humanities.",
  location: {
    label: "TUCSON, AZ",
    coords: "32.23N 110.95W · TUCSON",
  },
  contact: {
    email: "treyh413@outlook.com",
    github: "https://github.com/tharrisonNY54",
    githubLabel: "github.com/tharrisonNY54",
    linkedin: "https://linkedin.com/in/trey-harrison",
    linkedinLabel: "linkedin.com/in/trey-harrison",
  },
} as const;

export const NAV = [
  { label: "WORK", href: "/#work" },
  { label: "WRITING", href: "/writing" },
  { label: "CONTACT", href: "/#contact" },
] as const;
