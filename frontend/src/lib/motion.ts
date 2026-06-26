import type { Transition, Variants } from "framer-motion";

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

export const springSoft: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 28,
};

export const easeOut: Transition = { duration: 0.35, ease: [0.22, 1, 0.36, 1] };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: easeOut },
  exit: { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.22 } },
};

/** Sans transform/filter : iOS Safari casse position:fixed sur les ancêtres transformés. */
export const chatPageVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: easeOut },
  exit: { opacity: 0, transition: { duration: 0.22 } },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: springSnappy },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: easeOut },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2 } },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1, transition: springSnappy },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.18 } },
};

export const slideUp: Variants = {
  initial: { opacity: 0, y: "100%" },
  animate: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: "100%", transition: { duration: 0.25 } },
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};
