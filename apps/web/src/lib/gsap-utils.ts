import { useRef, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(ScrollTrigger, Flip);

/* ------------------------------------------------------------------ */
// 1. Page transition hook
/* ------------------------------------------------------------------ */
export function usePageTransition() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      const el = containerRef.current;

      gsap.set(el, { opacity: 0, y: 16 });
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: "power3.out",
      });
    },
    { scope: containerRef }
  );

  return containerRef;
}

/* ------------------------------------------------------------------ */
// 2. Scroll reveal hook
/* ------------------------------------------------------------------ */
interface ScrollRevealOptions {
  y?: number;
  x?: number;
  opacity?: number;
  duration?: number;
  delay?: number;
  ease?: string;
  start?: string;
}

export function useScrollReveal<T extends HTMLElement>(
  ref: React.RefObject<T>,
  options: ScrollRevealOptions = {}
) {
  const {
    y = 24,
    x = 0,
    opacity = 0,
    duration = 0.6,
    delay = 0,
    ease = "power3.out",
    start = "top 85%",
  } = options;

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.set(ref.current, { opacity, y, x });
      gsap.to(ref.current, {
        opacity: 1,
        y: 0,
        x: 0,
        duration,
        delay,
        ease,
        scrollTrigger: {
          trigger: ref.current,
          start,
          toggleActions: "play none none none",
        },
      });
    },
    { scope: ref, dependencies: [] }
  );
}

/* ------------------------------------------------------------------ */
// 3. Stagger hook
/* ------------------------------------------------------------------ */
interface StaggerOptions {
  y?: number;
  opacity?: number;
  duration?: number;
  stagger?: number;
  ease?: string;
  start?: string;
}

export function useStagger<T extends HTMLElement>(
  refs: React.RefObject<T>[],
  options: StaggerOptions = {}
) {
  const {
    y = 20,
    opacity = 0,
    duration = 0.5,
    stagger = 0.08,
    ease = "power3.out",
    start = "top 88%",
  } = options;

  const parentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const validEls = refs
        .map((r) => r.current)
        .filter(Boolean) as HTMLElement[];
      if (validEls.length === 0) return;

      gsap.set(validEls, { opacity, y });
      gsap.to(validEls, {
        opacity: 1,
        y: 0,
        duration,
        stagger,
        ease,
        scrollTrigger: {
          trigger: validEls[0],
          start,
          toggleActions: "play none none none",
        },
      });
    },
    { scope: parentRef, dependencies: refs.map((r) => r.current) }
  );

  return parentRef;
}

/* ------------------------------------------------------------------ */
// 4. Count up hook
/* ------------------------------------------------------------------ */
export function useCountUp<T extends HTMLElement>(
  ref: React.RefObject<T>,
  target: number,
  duration: number = 1.5
) {
  const hasRun = useRef(false);

  useGSAP(
    () => {
      if (!ref.current || hasRun.current) return;
      const el = ref.current;
      const obj = { val: 0 };

      gsap.to(obj, {
        val: target,
        duration,
        ease: "power2.out",
        onUpdate: () => {
          if (el) {
            el.textContent = Math.round(obj.val).toLocaleString();
          }
        },
        onComplete: () => {
          hasRun.current = true;
        },
      });
    },
    { scope: ref, dependencies: [target] }
  );
}

/* ------------------------------------------------------------------ */
// 5. Liquid progress hook
/* ------------------------------------------------------------------ */
export function useLiquidProgress<T extends HTMLElement>(
  ref: React.RefObject<T>,
  target: number
) {
  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.fromTo(
        ref.current,
        { width: "0%" },
        {
          width: `${Math.min(Math.max(target, 0), 100)}%`,
          duration: 1.2,
          ease: "elastic.out(1, 0.5)",
        }
      );
    },
    { scope: ref, dependencies: [target] }
  );
}

/* ------------------------------------------------------------------ */
// 6. GSAP hover state utility (returns handlers)
/* ------------------------------------------------------------------ */
export function useGsapHover<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  const onMouseEnter = useCallback(() => {
    if (!ref.current) return;
    gsap.to(ref.current, {
      scale: 1.02,
      duration: 0.25,
      ease: "power2.out",
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    if (!ref.current) return;
    gsap.to(ref.current, {
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
    });
  }, []);

  return { ref, onMouseEnter, onMouseLeave };
}
