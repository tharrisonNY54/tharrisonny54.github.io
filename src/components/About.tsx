import { motion } from 'framer-motion'

const inView = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
}

const FACTS = [
  { label: 'Degree', value: 'B.S. Computer Science' },
  { label: 'College', value: 'W.A. Franke Honors College' },
  { label: 'Minors', value: 'Mathematics · Artificial Intelligence' },
  { label: 'Accelerated MS', value: 'Targeted Spring 2029' },
  { label: 'Research', value: 'CDH Student Developer' },
  { label: 'Teaching', value: 'TA, CSC 345' },
]

export default function About() {
  return (
    <section id="about" aria-label="About" className="py-28 px-6 mx-auto max-w-5xl">
      <div className="border-t border-border pt-16">
        <motion.p
          {...inView}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-text-muted text-[11px] tracking-[0.28em] uppercase font-sans mb-14"
        >
          About
        </motion.p>

        <div className="grid md:grid-cols-[3fr_2fr] gap-14 md:gap-20">
          {/* Body copy */}
          <div className="space-y-6">
            <motion.p
              {...inView}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.08 }}
              className="text-text text-lg leading-[1.78]"
            >
              I'm a sophomore at the University of Arizona studying computer science
              in the W.A. Franke Honors College, with minors in math and AI. I'm in
              the Accelerated Master's Program, working toward an MS in spring 2029.
            </motion.p>

            <motion.p
              {...inView}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.14 }}
              className="text-text-muted text-base leading-[1.85]"
            >
              Most of my time outside class goes toward the UA Center for Digital
              Humanities, where I'm building a web platform for volumetric capture —
              3D photogrammetry that lets a browser render a real person in space.
              Current deployments are for a Holocaust memorial project and a cultural
              institution in Curaçao. I also TA for CSC 345 (Data Structures and
              Algorithms).
            </motion.p>

            <motion.p
              {...inView}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
              className="text-text-muted text-base leading-[1.85]"
            >
              Long-term, I'm interested in AI applied to life sciences — how language
              models and retrieval systems can do useful work at the bench. Outside of
              that: I play drums, play tennis, and read somewhere around 800 pages a
              month.
            </motion.p>
          </div>

          {/* Sidebar facts */}
          <motion.dl
            {...inView}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.12 }}
            className="space-y-0"
          >
            {FACTS.map(({ label, value }) => (
              <div key={label} className="border-t border-border py-4">
                <dt className="text-text-muted text-[10px] tracking-[0.22em] uppercase font-sans mb-1.5">
                  {label}
                </dt>
                <dd className="text-text text-sm leading-snug">{value}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </div>
    </section>
  )
}
