import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Sparkles } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface DemoVideoSectionProps {
  /** Path to the MP4 file. Drop your OpenScreen recording here. */
  videoSrc?: string;
  /** Path to the poster image (thumbnail shown before play). */
  posterSrc?: string;
}

/**
 * Premium demo video section. Pure player experience — no auto-play,
 * no muting gimmicks, just a beautiful frame for a real product demo.
 *
 * To add your video:
 *   1. Record with OpenScreen (installed)
 *   2. Export as MP4 at 1920x1080 or 2560x1440
 *   3. Place at /packages/web/public/demo/papera-demo.mp4
 *   4. Place thumbnail at /packages/web/public/demo/papera-demo-poster.jpg
 */
export const DemoVideoSection: React.FC<DemoVideoSectionProps> = ({
  videoSrc = '/demo/papera-demo.mp4',
  posterSrc = '/demo/papera-demo-poster.jpg',
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [videoExists, setVideoExists] = useState<boolean | null>(null);

  // Check if the video file exists (graceful fallback to placeholder).
  // We check content-type because Vite's SPA fallback returns HTTP 200 + HTML
  // for any unknown path, which would falsely indicate the video exists.
  useEffect(() => {
    fetch(videoSrc, { method: 'HEAD' })
      .then((r) => {
        if (!r.ok) {
          setVideoExists(false);
          return;
        }
        const contentType = r.headers.get('content-type') || '';
        setVideoExists(contentType.includes('video/'));
      })
      .catch(() => setVideoExists(false));
  }, [videoSrc]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        frameRef.current,
        { y: 60, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 75%',
            once: true,
          },
        },
      );

      // Parallax tilt on scroll
      if (frameRef.current) {
        gsap.fromTo(
          frameRef.current,
          { rotateX: 4 },
          {
            rotateX: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 70%',
              end: 'bottom 30%',
              scrub: 0.5,
            },
          },
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const requestFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-32 px-6 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0f111a 0%, #1a1c23 50%, #0f111a 100%)' }}
    >
      {/* Ambient glows */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[700px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(79,70,229,0.18) 0%, transparent 65%)', filter: 'blur(60px)' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[500px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)', filter: 'blur(50px)' }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border"
            style={{
              background: 'rgba(79,70,229,0.15)',
              borderColor: 'rgba(79,70,229,0.4)',
              color: '#a5b4fc',
            }}
          >
            <Sparkles size={13} />
            Watch Papera in action
          </div>
          <h2
            className="font-serif font-bold text-white mb-4"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', lineHeight: 1.1 }}
          >
            See it{' '}
            <span className="italic" style={{ color: '#a5b4fc' }}>generate.</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#94a3b8' }}>
            45 seconds. One prompt. A complete notebook layout. No cuts, no tricks.
          </p>
        </div>

        {/* Video frame with macOS window chrome */}
        <div
          ref={frameRef}
          className="relative rounded-2xl overflow-hidden"
          style={{
            boxShadow: '0 40px 120px rgba(0,0,0,0.5), 0 20px 60px rgba(79,70,229,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
            transformStyle: 'preserve-3d',
            perspective: '1000px',
          }}
        >
          {/* macOS window title bar */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{
              background: 'linear-gradient(180deg, #2a2d3a 0%, #1e212b 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57', boxShadow: '0 0 4px rgba(0,0,0,0.3)' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e', boxShadow: '0 0 4px rgba(0,0,0,0.3)' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#28c840', boxShadow: '0 0 4px rgba(0,0,0,0.3)' }} />
            </div>
            <div className="flex-1 text-center">
              <span
                className="px-3 py-1 text-xs font-medium rounded-md"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8' }}
              >
                papera.app — AI Notebook
              </span>
            </div>
            <div className="w-14" />
          </div>

          {/* Video or placeholder */}
          <div
            className="relative"
            style={{
              aspectRatio: '16/10',
              background: '#0a0c14',
            }}
          >
            {videoExists === true ? (
              <>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  poster={posterSrc}
                  playsInline
                  onLoadedData={() => setHasLoaded(true)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-cover"
                />

                {/* Custom play overlay */}
                {!isPlaying && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center group"
                    style={{ background: 'rgba(0,0,0,0.3)' }}
                  >
                    <div
                      className="flex items-center justify-center w-24 h-24 rounded-full transition-all group-hover:scale-110"
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        boxShadow: '0 20px 60px rgba(79,70,229,0.5)',
                      }}
                    >
                      <Play size={32} fill="#fff" stroke="#fff" strokeWidth={1} style={{ marginLeft: 4 }} />
                    </div>
                  </button>
                )}

                {/* Controls bar */}
                {isPlaying && hasLoaded && (
                  <div
                    className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center gap-3 opacity-0 hover:opacity-100 transition-opacity"
                    style={{
                      background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)',
                    }}
                  >
                    <button onClick={togglePlay} className="text-white hover:text-indigo-300 transition-colors">
                      {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button onClick={toggleMute} className="text-white hover:text-indigo-300 transition-colors">
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                    <div className="flex-1" />
                    <button onClick={requestFullscreen} className="text-white hover:text-indigo-300 transition-colors">
                      <Maximize2 size={18} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Placeholder while video is being recorded */
              <PlaceholderScreen />
            )}
          </div>
        </div>

        {/* Below video stats */}
        <div className="grid grid-cols-3 gap-6 mt-12 max-w-3xl mx-auto">
          {[
            { num: '45s', label: 'Average generation time', color: '#a5b4fc' },
            { num: '22+', label: 'Block types available', color: '#fbbf24' },
            { num: '10', label: 'Paper textures', color: '#6ee7b7' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div
                className="font-serif font-bold"
                style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: stat.color, lineHeight: 1 }}
              >
                {stat.num}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color: '#64748b' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * Animated placeholder shown before the demo video is recorded.
 * Simulates the AI generation flow with CSS animations.
 */
const PlaceholderScreen: React.FC = () => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % 4);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <div
        className="w-full h-full rounded-xl overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #fdfbf7 0%, #f4f0ec 100%)',
        }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center gap-3 px-5 py-3 border-b"
          style={{ borderColor: 'rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.6)' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#4f46e5' }}>
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-serif font-bold text-sm" style={{ color: '#1a1c23' }}>
            AI Layout Generator
          </span>
        </div>

        {/* Prompt area */}
        <div className="px-8 py-6 border-b" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#4f46e5' }}>
            Your prompt
          </div>
          <div className="font-hand text-2xl" style={{ color: '#1a1c23' }}>
            Weekly planner for a startup founder
            <span
              className="inline-block w-0.5 h-6 ml-1 align-middle"
              style={{ background: '#4f46e5', animation: 'blink 1s infinite' }}
            />
          </div>
        </div>

        {/* Generated blocks area */}
        <div className="flex-1 p-6 relative">
          {phase >= 1 && (
            <div
              className="mb-3 rounded-lg p-3 border"
              style={{
                background: 'rgba(79,70,229,0.05)',
                borderColor: 'rgba(79,70,229,0.2)',
                animation: 'slideIn 0.6s ease-out',
              }}
            >
              <div className="font-hand text-xl font-bold" style={{ color: '#1a1c23' }}>
                Week of March 24
              </div>
            </div>
          )}

          {phase >= 2 && (
            <div
              className="grid grid-cols-2 gap-3 mb-3"
              style={{ animation: 'slideIn 0.6s ease-out' }}
            >
              <div className="rounded-lg p-3 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                <div className="text-[10px] font-bold uppercase mb-1" style={{ color: '#10b981' }}>Priorities</div>
                <div className="font-hand text-sm" style={{ color: '#475569' }}>
                  • Ship v2 API<br />
                  • Investor meeting
                </div>
              </div>
              <div className="rounded-lg p-3 border" style={{ background: 'rgba(217,119,6,0.05)', borderColor: 'rgba(217,119,6,0.2)' }}>
                <div className="text-[10px] font-bold uppercase mb-1" style={{ color: '#d97706' }}>Schedule</div>
                <div className="font-hand text-sm" style={{ color: '#475569' }}>
                  Mon/Wed deep work<br />
                  Tue/Thu meetings
                </div>
              </div>
            </div>
          )}

          {phase >= 3 && (
            <div
              className="rounded-lg p-3 border flex items-center gap-4"
              style={{
                background: 'rgba(124,58,237,0.05)',
                borderColor: 'rgba(124,58,237,0.2)',
                animation: 'slideIn 0.6s ease-out',
              }}
            >
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase mb-1" style={{ color: '#7c3aed' }}>Mood Tracker</div>
                <div className="flex gap-2">
                  {['😢', '😕', '😐', '🙂', '😄'].map((e, i) => (
                    <span key={i} className={`text-xl ${i === 3 ? 'scale-125' : 'opacity-30'}`}>{e}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {phase === 0 && (
            <div className="flex items-center justify-center h-full">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)' }}
              >
                <Sparkles size={14} style={{ color: '#4f46e5' }} />
                <span className="text-xs font-medium" style={{ color: '#4f46e5' }}>AI thinking</span>
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" style={{ animation: 'dot1 1.4s infinite' }} />
                  <div className="w-1 h-1 rounded-full bg-indigo-500" style={{ animation: 'dot2 1.4s infinite' }} />
                  <div className="w-1 h-1 rounded-full bg-indigo-500" style={{ animation: 'dot3 1.4s infinite' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div
          className="px-5 py-2 text-center text-xs border-t"
          style={{ borderColor: 'rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.4)', color: '#94a3b8' }}
        >
          Demo video uploading soon — recording in progress
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dot1 { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes dot2 { 0%, 100% { opacity: 0.3; } 33% { opacity: 1; } }
        @keyframes dot3 { 0%, 100% { opacity: 0.3; } 66% { opacity: 1; } }
      `}</style>
    </div>
  );
};
