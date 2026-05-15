import { Link } from 'react-router-dom';
import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ─── Farmer Image Data ─────────────────────────────────────── */
const HERO_SLIDES = [
  {
    img: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=80',
    title: 'Golden Harvest',
    sub: 'Empowering wheat farmers across Punjab & Haryana',
  },
  {
    img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&q=80',
    title: 'Green Fields',
    sub: 'Satellite-verified rice paddies in the Gangetic plains',
  },
  {
    img: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&q=80',
    title: 'Morning Light',
    sub: 'AI-powered crop health monitoring at sunrise',
  },
  {
    img: 'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c10?w=1200&q=80',
    title: 'Terrace Farming',
    sub: 'Supporting hill agriculture in the Northeast',
  },
];

/* ─── Canvas Particle Field ─────────────────────────────────── */
interface Particle { x: number; y: number; vx: number; vy: number; r: number; alpha: number }

function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animId = useRef(0);
  const mouse = useRef({ x: -1000, y: -1000 });

  const init = useCallback((w: number, h: number) => {
    const ps: Particle[] = [];
    const count = Math.min(80, Math.floor((w * h) / 12000));
    for (let i = 0; i < count; i++) {
      ps.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.8, alpha: Math.random() * 0.35 + 0.1,
      });
    }
    particles.current = ps;
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d')!;
    let w = 0, h = 0;
    const resize = () => {
      const rect = cvs.parentElement!.getBoundingClientRect();
      w = rect.width; h = rect.height;
      cvs.width = w * devicePixelRatio; cvs.height = h * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      init(w, h);
    };
    resize();
    window.addEventListener('resize', resize);
    const onMove = (e: MouseEvent) => {
      const rect = cvs.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    cvs.addEventListener('mousemove', onMove);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const ps = particles.current;
      const mx = mouse.current.x, my = mouse.current.y;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dx = p.x - mx, dy = p.y - my, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) { p.x += (dx / dist) * 0.6; p.y += (dy / dist) * 0.6; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,197,94,${p.alpha})`; ctx.fill();
        for (let j = i + 1; j < ps.length; j++) {
          const p2 = ps[j], cx = p.x - p2.x, cy = p.y - p2.y, cd = Math.sqrt(cx * cx + cy * cy);
          if (cd < 120) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(34,197,94,${0.06 * (1 - cd / 120)})`; ctx.lineWidth = 0.6; ctx.stroke();
          }
        }
      }
      animId.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId.current); window.removeEventListener('resize', resize); cvs.removeEventListener('mousemove', onMove); };
  }, [init]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', width: '100%', height: '100%' }} />;
}

/* ─── 3D Hero Image Slider ──────────────────────────────────── */
function HeroSlider() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setActive(p => (p + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (i: number) => {
    setDirection(i > active ? 1 : -1);
    setActive(i);
  };

  return (
    <div className="relative w-full" style={{ perspective: '1200px' }}>
      <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl shadow-stone-900/20">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={active}
            custom={direction}
            initial={(d: number) => ({ rotateY: d * 45, x: `${d * 60}%`, opacity: 0, scale: 0.85 })}
            animate={{ rotateY: 0, x: '0%', opacity: 1, scale: 1 }}
            exit={(d: number) => ({ rotateY: d * -45, x: `${d * -60}%`, opacity: 0, scale: 0.85 })}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ transformStyle: 'preserve-3d' }}
            className="absolute inset-0"
          >
            <img
              src={HERO_SLIDES[active].img}
              alt={HERO_SLIDES[active].title}
              className="w-full h-full object-cover"
              loading={active === 0 ? 'eager' : 'lazy'}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Caption */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="absolute bottom-0 left-0 right-0 p-6 sm:p-8"
            >
              <h3 className="text-white text-2xl sm:text-3xl font-bold tracking-tight mb-1">{HERO_SLIDES[active].title}</h3>
              <p className="text-white/70 text-sm sm:text-base">{HERO_SLIDES[active].sub}</p>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Nav dots */}
        <div className="absolute bottom-4 right-6 flex gap-2 z-10">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i} onClick={() => goTo(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 border-0 cursor-pointer ${i === active ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      </div>

      {/* Floating thumbnail strip */}
      <div className="hidden lg:flex gap-3 mt-5 justify-center">
        {HERO_SLIDES.map((s, i) => (
          <motion.button
            key={i} onClick={() => goTo(i)}
            whileHover={{ y: -4 }}
            className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 transition-all duration-300 cursor-pointer p-0 ${i === active ? 'border-green-500 shadow-lg shadow-green-200/40' : 'border-transparent opacity-60 hover:opacity-100'}`}
          >
            <img src={s.img} alt="" className="w-full h-full object-cover" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ─── Animated Section Wrapper ───────────────────────────────── */
function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >{children}</motion.div>
  );
}

/* ─── GSAP Counter ───────────────────────────────────────────── */
function Counter({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  useEffect(() => {
    if (!isInView || !ref.current) return;
    const obj = { val: 0 };
    gsap.to(obj, { val: value, duration: 2.2, ease: 'power2.out',
      onUpdate: () => { if (ref.current) ref.current.textContent = prefix + Math.round(obj.val).toLocaleString('en-IN') + suffix; },
    });
  }, [isInView, value, suffix, prefix]);
  return <span ref={ref}>0{suffix}</span>;
}

/* ─── Interactive Stat Bar ───────────────────────────────────── */
function StatBar({ label, value, max, color, delay: d }: { label: string; value: number; max: number; color: string; delay: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="group">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm font-medium text-stone-600">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{value.toLocaleString('en-IN')}</span>
      </div>
      <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={isInView ? { width: `${(value / max) * 100}%` } : {}}
          transition={{ duration: 1.5, delay: d, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}dd)` }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  LANDING PAGE                                                  */
/* ═══════════════════════════════════════════════════════════════ */
export default function Landing() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-tag', { scale: 0.8, opacity: 0, duration: 0.6, ease: 'back.out(1.7)', delay: 0.2 });
      gsap.from('.hero-word', { y: 70, opacity: 0, rotateX: 35, stagger: 0.07, duration: 0.9, ease: 'power3.out', delay: 0.4 });
      gsap.from('.hero-sub', { y: 25, opacity: 0, duration: 0.7, ease: 'power2.out', delay: 1.1 });
      gsap.from('.hero-cta', { y: 25, opacity: 0, duration: 0.7, ease: 'power2.out', delay: 1.3 });
      gsap.from('.hero-slider', { x: 60, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.6 });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  /* ─── Bento Features ──────────────────────────────────────── */
  const bentoItems = [
    {
      title: 'Satellite Crop Verification',
      desc: 'Real-time NDVI from Sentinel-2 imagery validates crop health at 10m precision. Google Earth Engine integration for multi-temporal analysis.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      ),
      span: 'col-span-1 md:col-span-2 row-span-1',
      gradient: 'from-emerald-500/10 via-green-500/5 to-transparent',
      accent: '#22c55e',
    },
    {
      title: 'AI Eligibility Engine',
      desc: 'XGBoost + SHAP explainability scores every application with transparent reasoning.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      ),
      span: 'col-span-1 row-span-1',
      gradient: 'from-violet-500/10 via-purple-500/5 to-transparent',
      accent: '#8b5cf6',
    },
    {
      title: 'Fraud Detection',
      desc: '11 rules + Isolation Forest anomaly detection.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
      span: 'col-span-1 row-span-1',
      gradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
      accent: '#f59e0b',
    },
    {
      title: 'Tamper-Proof Audit',
      desc: 'SHA-256 hashed insert-only logs. Immutable record of every decision.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      span: 'col-span-1 row-span-1',
      gradient: 'from-cyan-500/10 via-sky-500/5 to-transparent',
      accent: '#06b6d4',
    },
    {
      title: 'Instant UPI Payouts',
      desc: 'HMAC-SHA256 signed Direct Benefit Transfer via NPCI with automatic retry on timeout. Funds reach farmers within minutes.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
      span: 'col-span-1 md:col-span-2 row-span-1',
      gradient: 'from-green-500/10 via-emerald-500/5 to-transparent',
      accent: '#10b981',
    },
    {
      title: 'Live Dashboard',
      desc: 'WebSocket-powered real-time analytics.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      ),
      span: 'col-span-1 row-span-1',
      gradient: 'from-rose-500/10 via-pink-500/5 to-transparent',
      accent: '#f43f5e',
    },
  ];

  return (
    <div className="landing-page bg-gradient-to-b from-stone-50 via-white to-green-50/20 min-h-screen overflow-hidden" style={{ fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif" }}>

      {/* ═══ HERO ═══════════════════════════════════════════════ */}
      <motion.section
        ref={heroRef}
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative min-h-screen flex items-center px-6 pt-8 pb-16"
      >
        {/* Background effects */}
        <div className="absolute top-10 left-0 w-[500px] h-[500px] bg-green-200/25 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-amber-100/30 rounded-full blur-3xl" />
        <div className="absolute inset-0 z-0"><HeroCanvas /></div>

        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text */}
          <div>
            <div className="hero-tag inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100/80 border border-green-200/60 text-green-700 text-sm font-medium mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              AI-Powered Agricultural Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-stone-900 tracking-tight leading-[1.06] mb-6" style={{ perspective: '800px' }}>
              {'Smarter Subsidies for'.split(' ').map((w, i) => (
                <span key={i} className="hero-word inline-block mr-[0.28em]">{w}</span>
              ))}
              <br />
              <span className="hero-word inline-block mr-[0.28em]">
                <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">Every</span>
              </span>
              <span className="hero-word inline-block">Farmer</span>
            </h1>

            <p className="hero-sub text-base sm:text-lg text-stone-500 max-w-lg mb-10 leading-relaxed">
              Satellite-verified crop data, machine learning eligibility scoring, and transparent audit trails — transforming how agricultural subsidies reach the people who need them.
            </p>

            <div className="hero-cta flex flex-col sm:flex-row gap-4">
              <Link to="/register"
                className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-lg shadow-xl shadow-green-300/30 hover:shadow-green-300/50 transition-all duration-300 hover:-translate-y-0.5 no-underline overflow-hidden">
                <span className="relative z-10 flex items-center gap-2">
                  Get Started Free
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </Link>
              <Link to="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/80 border border-stone-200/80 text-stone-700 font-semibold text-lg backdrop-blur-sm hover:bg-white hover:shadow-lg hover:border-stone-300 transition-all duration-300 no-underline">
                Sign In
              </Link>
            </div>

            {/* Social proof mini */}
            <div className="hero-cta mt-8 flex items-center gap-4">
              <div className="flex -space-x-2">
                {['R', 'L', 'S', 'A'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444'][i], zIndex: 4 - i }}>
                    {c}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-sm font-semibold text-stone-700">Trusted by farmers</div>
                <div className="text-xs text-stone-400">across 28 states</div>
              </div>
            </div>
          </div>

          {/* Right: 3D Image Slider */}
          <div className="hero-slider">
            <HeroSlider />
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-stone-300 flex justify-center pt-2">
            <div className="w-1 h-2.5 rounded-full bg-stone-400" />
          </div>
        </motion.div>
      </motion.section>

      {/* ═══ TRUSTED INTEGRATIONS ═══════════════════════════════ */}
      <FadeIn className="py-14 px-6 border-y border-stone-100">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs uppercase tracking-[0.25em] text-stone-400 font-medium mb-8">Integrated with India's trusted systems</p>
          <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4">
            {[
              { name: 'PM-KISAN', icon: '🌾' },
              { name: 'PMFBY', icon: '🛡️' },
              { name: 'Copernicus', icon: '🛰️' },
              { name: 'NPCI / UPI', icon: '💳' },
              { name: 'data.gov.in', icon: '📊' },
              { name: 'Google Earth Engine', icon: '🌍' },
            ].map(({ name, icon }) => (
              <div key={name} className="flex items-center gap-2 text-stone-400 hover:text-stone-600 transition-colors">
                <span className="text-lg">{icon}</span>
                <span className="text-sm font-semibold tracking-wide">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* ═══ BENTO FEATURE GRID ═══════════════════════════════════ */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-20">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-600 mb-4 block">Platform Capabilities</span>
              <h2 className="text-4xl lg:text-[3.25rem] font-extrabold text-stone-900 tracking-tight leading-tight">
                Everything you need,<br />
                <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">nothing you don't.</span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bentoItems.map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.08} className={item.span}>
                <motion.div
                  whileHover={{ y: -6, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="group relative h-full rounded-2xl border border-stone-200/70 bg-white/80 backdrop-blur-sm p-7 overflow-hidden cursor-default hover:shadow-xl hover:border-stone-300/80 transition-all duration-500"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors duration-300"
                      style={{ background: item.accent + '15', color: item.accent }}>
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-bold text-stone-800 mb-2 tracking-tight">{item.title}</h3>
                    <p className="text-stone-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                  {/* Corner glow on hover */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-700 blur-2xl"
                    style={{ background: item.accent }} />
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INTERACTIVE STATS — India's Farm Subsidy Reality ═══ */}
      <section className="py-28 px-6 bg-gradient-to-b from-stone-50 to-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-green-100/20 rounded-full blur-3xl" />
        <div className="max-w-6xl mx-auto relative z-10">
          <FadeIn>
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-4 block">The Problem We Solve</span>
              <h2 className="text-4xl lg:text-[3.25rem] font-extrabold text-stone-900 tracking-tight leading-tight">
                India's subsidy system<br />
                <span className="text-stone-400">needs a digital upgrade.</span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left: Big numbers */}
            <div className="space-y-8">
              <FadeIn delay={0.1}>
                <div className="rounded-2xl bg-white border border-stone-200/70 p-8 shadow-sm">
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { val: 14, suf: ' Cr', label: 'Farmer families in India', color: '#22c55e' },
                      { val: 36, suf: '%', label: 'Don\'t receive entitled benefits', color: '#ef4444' },
                      { val: 2.4, suf: 'L Cr', pre: '₹', label: 'Annual agri-subsidy budget', color: '#3b82f6' },
                      { val: 42, suf: '%', label: 'Lost to leakage & delays', color: '#f59e0b' },
                    ].map((s, i) => (
                      <div key={i} className="text-center">
                        <div className="text-3xl lg:text-4xl font-extrabold tracking-tight" style={{ color: s.color }}>
                          <Counter value={s.val} suffix={s.suf} prefix={s.pre || ''} />
                        </div>
                        <div className="text-xs text-stone-500 mt-1 leading-snug">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>

              <FadeIn delay={0.2}>
                <div className="rounded-2xl bg-white border border-stone-200/70 p-8 shadow-sm">
                  <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-5">Key Scheme Challenges</h4>
                  <div className="space-y-4">
                    <StatBar label="Manual verification delays" value={847} max={1000} color="#ef4444" delay={0.3} />
                    <StatBar label="Identity fraud cases (FY24)" value={623} max={1000} color="#f59e0b" delay={0.45} />
                    <StatBar label="Land record mismatches" value={512} max={1000} color="#8b5cf6" delay={0.6} />
                    <StatBar label="Ghost beneficiaries detected" value={389} max={1000} color="#06b6d4" delay={0.75} />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-4">Per 1,000 applications sampled — illustrative data</p>
                </div>
              </FadeIn>
            </div>

            {/* Right: Before/After comparison */}
            <div className="space-y-6">
              <FadeIn delay={0.15}>
                <div className="rounded-2xl border border-red-200/60 bg-red-50/40 p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                    <h4 className="font-bold text-stone-800">Traditional Process</h4>
                  </div>
                  <ul className="space-y-3">
                    {[
                      'Manual land inspection — 15 to 45 day wait',
                      'Paper-based verification prone to fraud',
                      'No transparency — farmers can\'t track status',
                      'Duplicate beneficiaries go undetected',
                      'Subsidy reaches bank after 3-6 months',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-stone-600">
                        <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>

              <FadeIn delay={0.25}>
                <div className="rounded-2xl border border-green-200/60 bg-green-50/40 p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h4 className="font-bold text-stone-800">With AgriVerify</h4>
                  </div>
                  <ul className="space-y-3">
                    {[
                      'Satellite NDVI verification in under 30 seconds',
                      'AI + 11 fraud rules catch overclaims instantly',
                      'Real-time WebSocket tracking for every step',
                      'Cadastral cross-check eliminates duplicates',
                      'UPI payout within minutes of approval',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-stone-600">
                        <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ════════════════════════════════════════ */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-20">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-600 mb-4 block">Simple Process</span>
              <h2 className="text-4xl lg:text-[3.25rem] font-extrabold text-stone-900 tracking-tight">How It Works</h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-4 gap-0">
            {[
              { num: '01', emoji: '📱', title: 'Register', desc: 'Sign up with your Aadhaar-linked mobile and draw your farm parcel.' },
              { num: '02', emoji: '📋', title: 'Choose Scheme', desc: 'Browse 64+ central & state schemes filtered for your eligibility.' },
              { num: '03', emoji: '🛰️', title: 'Auto-Verify', desc: 'NDVI + cadastral + AI scoring in under 30 seconds.' },
              { num: '04', emoji: '💸', title: 'Get Paid', desc: 'Signed UPI transfer directly to your bank account.' },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.12}>
                <div className="relative text-center px-6 py-8 group">
                  {/* Connector line */}
                  {i < 3 && <div className="hidden md:block absolute top-14 left-[60%] w-[80%] h-px bg-gradient-to-r from-green-300 to-green-100" />}
                  <div className="relative z-10">
                    <div className="text-4xl mb-4">{step.emoji}</div>
                    <div className="text-xs font-bold text-green-600 tracking-widest mb-2">{step.num}</div>
                    <h4 className="text-lg font-bold text-stone-800 mb-2">{step.title}</h4>
                    <p className="text-sm text-stone-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═════════════════════════════════════════ */}
      <section className="py-28 px-6 bg-gradient-to-b from-white to-stone-50">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-600 mb-4 block">Impact Stories</span>
              <h2 className="text-4xl lg:text-[3.25rem] font-extrabold text-stone-900 tracking-tight">
                Voices from the Field
              </h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Rajesh Kumar', role: 'Wheat Farmer, Punjab', text: 'I received my PM-KISAN subsidy within 2 days. The satellite verification was instant and I could track every step on my phone.', emoji: '🌾' },
              { name: 'Lakshmi Devi', role: 'Rice Farmer, Andhra Pradesh', text: 'Earlier I waited months for verification. Now the AI checks everything automatically and the money comes straight to my bank.', emoji: '🌿' },
              { name: 'Suresh Patel', role: 'Cotton Farmer, Gujarat', text: 'The fraud detection caught a boundary error in my application and corrected it automatically. Very transparent system.', emoji: '🌱' },
            ].map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.12}>
                <motion.div
                  whileHover={{ y: -6 }}
                  className="rounded-2xl border border-stone-200/70 bg-white/90 backdrop-blur-sm p-8 shadow-sm hover:shadow-xl transition-all duration-500"
                >
                  <div className="text-3xl mb-4">{t.emoji}</div>
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-stone-600 leading-relaxed mb-6 text-[15px] italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">{t.name[0]}</div>
                    <div>
                      <div className="font-semibold text-stone-800 text-sm">{t.name}</div>
                      <div className="text-stone-400 text-xs">{t.role}</div>
                    </div>
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA — Bharat / India Aesthetic ═══════════════════════ */}
      <section className="py-28 px-6">
        <FadeIn>
          <div className="max-w-5xl mx-auto relative overflow-hidden rounded-[2rem]">
            {/* Tricolor top accent */}
            <div className="flex h-1.5">
              <div className="flex-1 bg-[#FF9933]" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-[#138808]" />
            </div>

            <div className="relative bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 px-8 sm:px-16 py-16 lg:py-20">
              {/* Ashoka Chakra watermark */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03]">
                <svg width="400" height="400" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeWidth="2" />
                  <circle cx="50" cy="50" r="8" fill="none" stroke="white" strokeWidth="1.5" />
                  {[...Array(24)].map((_, i) => (
                    <line key={i} x1="50" y1="12" x2="50" y2="5" stroke="white" strokeWidth="1.2"
                      transform={`rotate(${i * 15}, 50, 50)`} />
                  ))}
                  {[...Array(24)].map((_, i) => (
                    <line key={`s${i}`} x1="50" y1="50" x2="50" y2="12" stroke="white" strokeWidth="0.3"
                      transform={`rotate(${i * 15}, 50, 50)`} />
                  ))}
                </svg>
              </div>

              {/* Mandala pattern overlay */}
              <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                backgroundSize: '24px 24px',
              }} />

              <div className="relative z-10 text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 border border-white/10 text-amber-300 text-sm font-medium mb-8 backdrop-blur-sm"
                >
                  <span className="text-base">🇮🇳</span>
                  Built for Bharat
                </motion.div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
                  Jai Kisan.{' '}
                  <span className="bg-gradient-to-r from-[#FF9933] via-amber-300 to-[#138808] bg-clip-text text-transparent">
                    Jai Vigyan.
                  </span>
                </h2>
                <p className="text-stone-400 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
                  Bridging the gap between India's farmers and the subsidies they deserve — with satellite precision and AI transparency.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                  <Link to="/register"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#FF9933] to-amber-500 text-white font-bold text-lg hover:shadow-xl hover:shadow-amber-500/20 hover:-translate-y-0.5 transition-all duration-300 no-underline">
                    Start Your Application
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </Link>
                  <Link to="/login"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/10 border border-white/15 text-white font-semibold text-lg hover:bg-white/20 transition-all duration-300 backdrop-blur-sm no-underline">
                    Admin Portal
                  </Link>
                </div>

                {/* Platform stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-10 border-t border-white/10">
                  {[
                    { val: '64+', label: 'Govt Schemes' },
                    { val: '28', label: 'States Covered' },
                    { val: '91%', label: 'ML Accuracy' },
                    { val: '<30s', label: 'Verification Time' },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className="text-2xl font-extrabold text-white tracking-tight">{s.val}</div>
                      <div className="text-xs text-stone-500 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom tricolor */}
            <div className="flex h-1.5">
              <div className="flex-1 bg-[#FF9933]" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-[#138808]" />
            </div>
          </div>
        </FadeIn>
      </section>

    </div>
  );
}
