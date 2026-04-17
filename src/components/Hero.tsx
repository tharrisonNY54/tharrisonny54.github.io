import { motion } from 'framer-motion'

export default function Hero() {
  return (
    <section
      id="top"
      aria-label="Introduction"
      className="relative min-h-[92vh] flex flex-col justify-end px-6 pb-20 pt-24 mx-auto max-w-5xl"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl"
      >
        <p className="text-text-muted text-[11px] tracking-[0.28em] uppercase mb-10 font-sans">
          University of Arizona &mdash; Tucson
        </p>

        <h1
          className="font-serif font-light text-text leading-[0.92] tracking-tight mb-8"
          style={{ fontSize: 'clamp(4rem, 13vw, 9.5rem)' }}
        >
          Trey
          <br />
          Harrison
        </h1>

        <div className="w-10 h-px bg-accent mb-8" />

        <p className="text-text-muted text-base sm:text-lg leading-relaxed max-w-lg">
          CS student at Arizona working on volumetric capture,
          RAG pipelines, and web infrastructure.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.7 }}
        className="mt-20 flex items-center gap-3 text-text-muted/35 text-[10px] tracking-[0.3em] uppercase font-sans select-none"
        aria-hidden="true"
      >
        <span className="block w-6 h-px bg-current" />
        Scroll
      </motion.div>
    </section>
  )
}
