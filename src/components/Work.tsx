import { motion } from 'framer-motion'

interface Project {
  title: string
  description: string
  tags: string[]
  link?: { label: string; href: string }
  award?: string
}

const FEATURED_PROJECTS: Project[] = [
  {
    title: 'CDH Volumetric Capture Showcase',
    description:
      'Building a web platform to display volumetric capture subjects for the Tucson Jewish Museum & Holocaust Center and the Maduro Museum in Curaçao. Three.js WebGL rendering, AWS S3/CloudFront delivery, Drupal CMS integration.',
    tags: ['Three.js', 'WebGL', 'AWS', 'Drupal'],
    link: {
      label: 'View live',
      href: 'https://tharrisonny54.github.io/portfolio-website/',
    },
  },
  {
    title: 'RAG Pipeline',
    description:
      'Built a retrieval-augmented generation pipeline that won a UArizona Innovation Award. Focused on efficient document retrieval and context injection for LLM queries.',
    tags: ['Python', 'RAG', 'LLM', 'Vector Search'],
    award: 'UArizona Innovation Award',
  },
  // TODO: Add project — see README for format
  // TODO: Add project — see README for format
  // TODO: Add project — see README for format
]

export default function Work() {
  return (
    <section id="work" aria-label="Work" className="py-28 px-6 mx-auto max-w-5xl">
      <div className="border-t border-border pt-16">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-text-muted text-[11px] tracking-[0.28em] uppercase font-sans mb-2"
        >
          Work
        </motion.p>

        <div>
          {FEATURED_PROJECTS.map((project, i) => (
            <ProjectCard key={project.title} project={project} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: 'easeOut', delay: index * 0.08 }}
      className="border-t border-border py-10 md:grid md:grid-cols-[1fr_160px] md:gap-12"
    >
      <div>
        <div className="flex flex-wrap items-baseline gap-3 mb-4">
          <h3 className="font-serif font-light text-2xl text-text tracking-tight">
            {project.title}
          </h3>
          {project.award && (
            <span className="text-accent text-[10px] tracking-[0.16em] uppercase font-sans border border-accent/40 px-2 py-0.5 rounded-sm whitespace-nowrap">
              {project.award}
            </span>
          )}
        </div>

        <p className="text-text-muted text-[15px] leading-relaxed mb-5 max-w-xl">
          {project.description}
        </p>

        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {project.tags.map(tag => (
            <span
              key={tag}
              className="text-text-muted/50 text-xs font-mono tracking-wide"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {project.link && (
        <div className="mt-6 md:mt-0 md:flex md:items-start md:justify-end md:pt-1.5">
          <a
            href={project.link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${project.link.label} — opens in new tab`}
            className="inline-flex items-center gap-2 text-accent text-sm tracking-wide hover:opacity-75 transition-opacity duration-200"
          >
            {project.link.label}
            <ArrowRight />
          </a>
        </div>
      )}
    </motion.article>
  )
}

function ArrowRight() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="1.5" y1="6.5" x2="11.5" y2="6.5" />
      <polyline points="7.5,2.5 11.5,6.5 7.5,10.5" />
    </svg>
  )
}
