import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useGsapAnimations() {
  const location = useLocation();

  useEffect(() => {
    // Small timeout to allow React to paint the DOM first
    const ctx = gsap.context(() => {
      
      // Page Title Animations
      const titles = document.querySelectorAll('.page-title');
      if (titles.length > 0) {
        gsap.from(titles, {
          y: 30,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out"
        });
      }

      // Section Block Entrance Animations (ScrollTriggered)
      const sectionBlocks = document.querySelectorAll('.section-block');
      if (sectionBlocks.length > 0) {
        sectionBlocks.forEach((block) => {
          gsap.from(block, {
            scrollTrigger: {
              trigger: block,
              start: "top 85%",
              toggleActions: "play none none reverse", // play on enter, reverse on leave back
            },
            y: 40,
            opacity: 0,
            duration: 0.6,
            ease: "power2.out"
          });
        });
      }

    });

    // Cleanup context when location changes or component unmounts
    return () => ctx.revert();
  }, [location.pathname]); 
}
