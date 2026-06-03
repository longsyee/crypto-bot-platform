import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function PageWrapper({ children, className = "" }: PageWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      const el = containerRef.current;
      const sections = el.querySelectorAll(".gsap-section");

      if (sections.length > 0) {
        gsap.set(sections, { opacity: 0, y: 20 });
        gsap.to(sections, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.05,
          ease: "power3.out",
          clearProps: "transform",
        });
      } else {
        gsap.set(el, { opacity: 0, y: 20 });
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power3.out",
          clearProps: "transform",
        });
      }
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        {children}
      </div>
    </div>
  );
}
