import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// One framework-independent animation engine for Astro's static pages.
// All effects are progressive enhancement: there is no initial CSS hide.
gsap.registerPlugin(ScrollTrigger);

function initializeSiteMotion() {
  const motionPreference = gsap.matchMedia();

  // matchMedia automatically reverts in-flight tweens and ScrollTriggers
  // when the OS accessibility preference changes.
  motionPreference.add('(prefers-reduced-motion: no-preference)', () => {
    const root = document.documentElement;
    root.classList.add('site-motion-enabled');

    const hero = document.querySelector('.page-hero');
    if (hero) {
      const copy = [...(hero.querySelector('.page-hero__copy')?.children || [])];
      const panel = hero.querySelector('.page-hero__panel');
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.85 }, delay: 0.05 });

      if (copy.length) {
        timeline.from(copy, {
          opacity: 0,
          y: 28,
          stagger: 0.115,
          clearProps: 'opacity,transform'
        }, 0);
      }

      if (panel) {
        timeline.from(panel, {
          opacity: 0,
          y: 34,
          scale: 0.975,
          clearProps: 'opacity,transform'
        }, 0.27);
      }

      const signal = hero.querySelectorAll('.readiness-signal span');
      if (signal.length) {
        timeline.from(signal, {
          scaleX: 0,
          transformOrigin: 'left center',
          stagger: 0.11,
          duration: 0.6,
          ease: 'power2.out',
          clearProps: 'transform'
        }, 0.5);
      }
    }

    // Group by actual document structure, not brittle per-item timeouts.
    // ScrollTrigger starts animations only when content enters the viewport.
    const groups = document.querySelectorAll([
      '.section-header',
      '.outcome-strip__grid',
      '.audience-link-grid',
      '.readiness-preview-grid',
      '.services__grid',
      '.process-list',
      '.frameworks__grid',
      '.why__grid',
      '.card-grid--two',
      '.people-grid',
      '.testimonials-grid'
    ].join(','));

    const reveals = [];
    groups.forEach((group) => {
      const items = [...group.children].filter((item) => item instanceof HTMLElement);
      if (!items.length) return;

      items.forEach((item) => {
        item.dataset.motionReveal = '';
        reveals.push(item);
      });

      gsap.from(items, {
        opacity: 0,
        y: 30,
        duration: 0.75,
        stagger: 0.085,
        ease: 'power2.out',
        clearProps: 'opacity,transform',
        scrollTrigger: {
          trigger: group,
          start: 'top 88%',
          once: true,
          invalidateOnRefresh: true
        }
      });
    });

    const progress = document.querySelector('.site-scroll-progress');
    if (progress) {
      gsap.fromTo(progress, { scaleX: 0 }, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: document.documentElement,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.3,
          invalidateOnRefresh: true
        }
      });
    }

    // The pointer treatment is deliberately subtle and opt-in for precise
    // pointers; coarse touch and reduced-motion users never receive it.
    const unbind = [];
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll('.page-hero__actions .btn--primary, .cta-panel .btn--primary').forEach((button) => {
        const moveX = gsap.quickTo(button, 'x', { duration: 0.45, ease: 'power3.out' });
        const moveY = gsap.quickTo(button, 'y', { duration: 0.45, ease: 'power3.out' });
        const onMove = (event) => {
          const rect = button.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          moveX(((event.clientX - rect.left) / rect.width - 0.5) * 10);
          moveY(((event.clientY - rect.top) / rect.height - 0.5) * 8);
        };
        const onLeave = () => { moveX(0); moveY(0); };
        button.addEventListener('pointermove', onMove);
        button.addEventListener('pointerleave', onLeave);
        button.addEventListener('blur', onLeave);
        unbind.push(() => {
          button.removeEventListener('pointermove', onMove);
          button.removeEventListener('pointerleave', onLeave);
          button.removeEventListener('blur', onLeave);
        });
      });
    }

    return () => {
      root.classList.remove('site-motion-enabled');
      reveals.forEach((item) => delete item.dataset.motionReveal);
      unbind.forEach((dispose) => dispose());
    };
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSiteMotion, { once: true });
} else {
  initializeSiteMotion();
}
