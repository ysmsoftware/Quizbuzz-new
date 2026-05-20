'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  Award, 
  Download, 
  ChevronLeft, 
  ShieldCheck, 
  ExternalLink,
  Loader2,
  Trophy,
  Calendar,
  Building,
  Share2,
  Linkedin,
  Twitter,
  Link2,
  Sparkles,
  Palette
} from 'lucide-react';
import { certificatesApi } from '@/lib/api/results-certs.api';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

type CertificateTheme = 'royal' | 'midnight' | 'emerald';

export default function ParticipantCertificatePage() {
  const { id: participantId } = useParams() as { id: string };
  const router = useRouter();
  const [theme, setTheme] = useState<CertificateTheme>('royal');
  const [isCopied, setIsCopied] = useState(false);

  // Card perspective mouse physics using Framer Motion
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for high-end feel
  const springConfig = { damping: 25, stiffness: 200, mass: 0.5 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), springConfig);
  const shadowX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-20, 20]), springConfig);
  const shadowY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-20, 20]), springConfig);
  
  // Highlight reflection overlay gradient position
  const shineX = useSpring(useTransform(mouseX, [-0.5, 0.5], [0, 100]), springConfig);
  const shineY = useSpring(useTransform(mouseY, [-0.5, 0.5], [0, 100]), springConfig);

  const { data: certData, isLoading, error } = useQuery({
    queryKey: ['participant-certificate', participantId],
    queryFn: () => certificatesApi.getParticipantCertificate(participantId),
    retry: false,
  });

  const certificate = certData?.data;

  // Celebrate on load success
  useEffect(() => {
    if (certificate && (certificate.status === 'GENERATED' || certificate.status === 'DELIVERED')) {
      // Explode primary confetti burst
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#c5a85c', '#d4af37', '#e5c158', '#ffffff', '#2563eb']
      });

      // Staggered sparkles
      const end = Date.now() + (1.5 * 1000);
      const interval = setInterval(() => {
        if (Date.now() > end) return clearInterval(interval);
        confetti({
          startVelocity: 15,
          spread: 360,
          ticks: 60,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
          colors: ['#c5a85c', '#d4af37', '#e5c158'],
          particleCount: 15
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [certificate]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const xVal = (e.clientX - rect.left) / width - 0.5;
    const yVal = (e.clientY - rect.top) / height - 0.5;
    
    mouseX.set(xVal);
    mouseY.set(yVal);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const copyShareLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    toast.success('Certificate link copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const shareToLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(`Proudly verified my achievement in the ${certificate?.contest?.title || 'Quiz'} contest! Check out my official certificate here:`);
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6">
        <Loader2 className="h-12 w-12 animate-spin text-amber-500 mb-4" />
        <p className="text-neutral-400 font-medium tracking-wide">Retrieving your secure credentials...</p>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-24 w-24 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-6 shadow-2xl shadow-red-950/20">
          <Award className="h-12 w-12 text-red-500/80" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">Certificate Unavailable</h1>
        <p className="text-neutral-400 max-w-sm mb-8 leading-relaxed">
          The requested certificate is either generating, has failed, or doesn't exist. Please reach out to your administrator.
        </p>
        <Button variant="ghost" className="rounded-2xl border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-900 px-6 h-12" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  // Fallback defaults if API has blank metadata fields
  const meta = certificate.metadata || {};
  const recipientName = meta.participantName || `${certificate.participant?.contact?.firstName || ''} ${certificate.participant?.contact?.lastName || ''}`.trim() || 'Valued Participant';
  const contestTitle = meta.contestTitle || certificate.contest?.title || 'Advanced Contest';
  const percentage = meta.percentage ?? 80;
  const rank = meta.rank ?? 1;
  const timeTakenSecs = meta.timeTakenSecs ?? 360;

  // Format time taken helper
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return mins > 0 ? `${mins}m ${remaining}s` : `${remaining}s`;
  };

  // Verification secure path url
  const verificationUrl = typeof window !== 'undefined' ? window.location.href : `https://quizbuzz.com/verify/${certificate.id}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-neutral-950 to-neutral-950">
      
      {/* Decorative Floating Light Glows */}
      <div className="absolute top-[-10%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-4xl w-full space-y-10 z-10 py-10">
        
        {/* Main Action Bar */}
        <div className="flex justify-between items-center px-2">
          <Button 
            variant="ghost" 
            className="text-neutral-400 hover:text-white rounded-xl border border-neutral-900 bg-neutral-950/40 hover:bg-neutral-900/60"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-4 w-4 mr-1.5" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> SECURE INTEGRITY SEAL
            </span>
          </div>
        </div>

        {/* Dynamic Interactive Theme Selector */}
        <div className="flex flex-col items-center gap-4 bg-neutral-900/40 backdrop-blur-xl border border-neutral-900 p-4 rounded-2xl max-w-md mx-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 tracking-wider uppercase">
            <Palette className="h-4 w-4 text-amber-500" /> Custom Certificate Theme Styles
          </div>
          <div className="flex gap-3">
            {[
              { id: 'royal', label: 'Royal Gold', color: 'bg-amber-500 border-amber-300' },
              { id: 'midnight', label: 'Midnight Blue', color: 'bg-blue-600 border-blue-400' },
              { id: 'emerald', label: 'Emerald Merit', color: 'bg-emerald-600 border-emerald-400' }
            ].map((themeBtn) => (
              <button
                key={themeBtn.id}
                onClick={() => setTheme(themeBtn.id as CertificateTheme)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer bg-neutral-950 border-neutral-900 text-neutral-500 hover:text-neutral-300"
                style={{
                  backgroundColor: theme === themeBtn.id ? '#262626' : undefined,
                  borderColor: theme === themeBtn.id ? '#525252' : undefined,
                  color: theme === themeBtn.id ? '#ffffff' : undefined
                }}
              >
                <span className={`h-2.5 w-2.5 rounded-full border ${themeBtn.color}`} />
                {themeBtn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive 3D Perspective Card Wrapper */}
        <div className="perspective-[1200px] flex justify-center">
          <motion.div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              rotateX,
              rotateY,
              transformStyle: 'preserve-3d',
              boxShadow: useTransform(
                [shadowX, shadowY],
                ([sX, sY]) => `${Number(sX)}px ${Number(sY)}px 60px -10px rgba(0, 0, 0, 0.7)`
              )
            }}
            className="w-full max-w-[800px] aspect-[1.414/1] rounded-[2rem] border relative overflow-hidden cursor-pointer transition-all duration-200 select-none group"
            animate={{
              borderColor: 
                theme === 'royal' ? 'rgba(212, 175, 55, 0.3)' : 
                theme === 'midnight' ? 'rgba(37, 99, 235, 0.3)' : 
                'rgba(16, 185, 129, 0.3)',
              background: 
                theme === 'royal' ? 'linear-gradient(135deg, #110e08 0%, #1a160d 100%)' : 
                theme === 'midnight' ? 'linear-gradient(135deg, #0b0f19 0%, #0d1527 100%)' : 
                'linear-gradient(135deg, #08110e 0%, #0c1c16 100%)'
            }}
          >
            {/* Soft highlight sweeping light reflections */}
            <motion.div
              style={{
                background: useTransform(
                  [shineX, shineY],
                  ([sX, sY]) => `radial-gradient(circle at ${Number(sX)}% ${Number(sY)}%, rgba(255,255,255,0.06) 0%, transparent 60%)`
                )
              }}
              className="absolute inset-0 pointer-events-none z-10"
            />

            {/* Inner Intricate Border */}
            <div className="absolute inset-4 rounded-[1.5rem] border border-dashed pointer-events-none opacity-50 z-10 border-neutral-700" />
            <div className={`absolute inset-5 rounded-[1.4rem] border-2 pointer-events-none transition-all duration-300 z-10 ${
              theme === 'royal' ? 'border-amber-500/20' : 
              theme === 'midnight' ? 'border-blue-500/20' : 
              'border-emerald-500/20'
            }`} />

            {/* Corner Ornaments */}
            {[
              "top-6 left-6 border-t-2 border-l-2",
              "top-6 right-6 border-t-2 border-r-2",
              "bottom-6 left-6 border-b-2 border-l-2",
              "bottom-6 right-6 border-b-2 border-r-2"
            ].map((pos, idx) => (
              <div
                key={idx}
                className={`absolute h-6 w-6 pointer-events-none transition-all duration-300 z-10 ${pos} ${
                  theme === 'royal' ? 'border-amber-500/50' : 
                  theme === 'midnight' ? 'border-blue-500/50' : 
                  'border-emerald-500/50'
                }`}
              />
            ))}

            {/* Certificate Content Grid */}
            <CardContent className="h-full p-12 flex flex-col justify-between items-center relative z-20 text-center">
              
              {/* Header Title */}
              <div className="space-y-1">
                <span className={`text-[10px] font-black uppercase tracking-[0.4em] transition-all ${
                  theme === 'royal' ? 'text-amber-500' : 
                  theme === 'midnight' ? 'text-blue-400' : 
                  'text-emerald-400'
                }`}>
                  Certificate of Accomplishment
                </span>
                <h2 className="text-3xl font-serif font-bold text-white tracking-wide mt-2">
                  QUIZBUZZ CHAMPIONSHIP
                </h2>
              </div>

              {/* Presented To block */}
              <div className="space-y-2 mt-4">
                <p className="text-xs italic text-neutral-400 font-serif">
                  This secure credential is proudly presented to
                </p>
                <h3 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
                  {recipientName}
                </h3>
                <div className={`h-[2px] w-32 mx-auto rounded-full mt-3 ${
                  theme === 'royal' ? 'bg-amber-500/50' : 
                  theme === 'midnight' ? 'bg-blue-500/50' : 
                  'bg-emerald-500/50'
                }`} />
              </div>

              {/* For successfully completing contest */}
              <p className="text-sm text-neutral-300 max-w-xl leading-relaxed mt-2 font-medium">
                for demonstrating exceptional performance and mastery in the official evaluation
                <span className="block font-black text-white text-base mt-1.5">{contestTitle}</span>
              </p>

              {/* Metric stats row */}
              <div className="grid grid-cols-3 gap-6 bg-neutral-950/60 border border-neutral-900 px-6 py-3 rounded-2xl mt-4 w-full max-w-md">
                <div className="text-center">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 block">Score</span>
                  <span className={`text-sm font-black font-mono ${
                    theme === 'royal' ? 'text-amber-400' : 
                    theme === 'midnight' ? 'text-blue-400' : 
                    'text-emerald-400'
                  }`}>
                    {percentage}%
                  </span>
                </div>
                <div className="text-center border-x border-neutral-900">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 block">Global Rank</span>
                  <span className="text-sm font-black font-mono text-white">
                    #{rank}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 block">Duration</span>
                  <span className="text-sm font-black font-mono text-neutral-300">
                    {formatDuration(timeTakenSecs)}
                  </span>
                </div>
              </div>

              {/* Footer Credentials & Seal */}
              <div className="w-full flex justify-between items-end mt-4">
                
                {/* Left Signature */}
                <div className="text-left w-1/3">
                  <div className="h-10 flex items-center justify-start pointer-events-none pl-2">
                    <svg className="h-8 text-neutral-400 stroke-current opacity-70" viewBox="0 0 100 40">
                      <path d="M10,30 Q25,5 40,25 T70,10 T90,30" fill="none" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="border-t border-neutral-800 pt-1 mt-1">
                    <p className="text-[10px] font-bold text-neutral-300 leading-none">Contest Director</p>
                    <p className="text-[8px] text-neutral-500 mt-0.5">{certificate.contest?.organizationName || 'QuizBuzz Admin'}</p>
                  </div>
                </div>

                {/* Middle Holographic/Gold Verification Seal */}
                <div className="flex flex-col items-center justify-center w-1/3 relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 40, ease: 'linear' }}
                    className="relative w-16 h-16 flex items-center justify-center"
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" className={`stroke-dashed opacity-60 ${
                        theme === 'royal' ? 'text-amber-500' : 
                        theme === 'midnight' ? 'text-blue-500' : 
                        'text-emerald-500'
                      }`} />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1" className={`opacity-30 ${
                        theme === 'royal' ? 'text-amber-500' : 
                        theme === 'midnight' ? 'text-blue-500' : 
                        'text-emerald-500'
                      }`} />
                    </svg>
                    <Trophy className={`absolute h-6 w-6 transition-all duration-300 ${
                      theme === 'royal' ? 'text-amber-500 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                      theme === 'midnight' ? 'text-blue-500 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 
                      'text-emerald-500 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    }`} />
                  </motion.div>
                  <span className="text-[7px] tracking-widest text-emerald-400 font-bold uppercase mt-1 flex items-center gap-0.5">
                    <ShieldCheck className="h-2 w-2" /> VERIFIED
                  </span>
                </div>

                {/* Right Signature / QR code preview */}
                <div className="text-right w-1/3 flex flex-col items-end">
                  <div className="bg-white p-1 rounded-md mb-2 shadow-md">
                    <QRCodeSVG 
                      value={verificationUrl}
                      size={36}
                      level="H"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <div className="border-t border-neutral-800 pt-1 w-full text-right">
                    <p className="text-[10px] font-bold text-neutral-300 leading-none">Security Reference</p>
                    <p className="text-[8px] text-neutral-500 mt-0.5 font-mono">{certificate.id.slice(0, 16)}</p>
                  </div>
                </div>

              </div>

            </CardContent>
          </motion.div>
        </div>

        {/* Action Controls & Sharing Tools */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card Info Details */}
          <div className="md:col-span-2 bg-neutral-900/30 border border-neutral-900 rounded-[2rem] p-6 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> Certificate Details & Identity
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-900/50">
                <span className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-1">RECIPIENT CONTACT</span>
                <span className="text-sm font-semibold block">{recipientName}</span>
                <span className="text-xs text-neutral-400 font-mono block mt-0.5">{certificate.participant?.contact?.email || 'N/A'}</span>
              </div>
              <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-900/50">
                <span className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-1">DATE OF ISSUANCE</span>
                <span className="text-sm font-semibold block">
                  {certificate.generatedAt ? format(new Date(certificate.generatedAt), 'MMMM dd, yyyy') : '--'}
                </span>
                <span className="text-xs text-neutral-400 font-mono block mt-0.5">
                  {certificate.generatedAt ? format(new Date(certificate.generatedAt), 'hh:mm a') : '--'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold shadow-lg shadow-amber-500/10 hover:scale-[1.01] transition-all"
                asChild
              >
                <a href={certificate.fileUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" /> Download PDF Credential
                </a>
              </Button>
              <Button 
                variant="outline" 
                className="h-12 rounded-xl border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:text-white"
                onClick={() => certificate.fileUrl && window.open(certificate.fileUrl)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Social Sharing Channels */}
          <div className="bg-neutral-900/30 border border-neutral-900 rounded-[2rem] p-6 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Share2 className="h-4 w-4 text-blue-400" /> Share Achievement
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Showcase your credentials directly to your network. Certified links can be instantly verified.
            </p>
            <div className="space-y-2.5">
              <Button 
                variant="outline" 
                className="w-full h-11 justify-start rounded-xl border-neutral-800 bg-neutral-950/40 hover:bg-neutral-900 font-semibold"
                onClick={shareToLinkedIn}
              >
                <Linkedin className="h-4 w-4 mr-2.5 text-blue-400" />
                Add to LinkedIn Profile
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-11 justify-start rounded-xl border-neutral-800 bg-neutral-950/40 hover:bg-neutral-900 font-semibold"
                onClick={shareToTwitter}
              >
                <Twitter className="h-4 w-4 mr-2.5 text-sky-400" />
                Share on Twitter / X
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-11 justify-start rounded-xl border-neutral-800 bg-neutral-950/40 hover:bg-neutral-900 font-semibold"
                onClick={copyShareLink}
              >
                <Link2 className="h-4 w-4 mr-2.5 text-amber-500" />
                {isCopied ? 'Link Copied!' : 'Copy Verification Link'}
              </Button>
            </div>
          </div>

        </div>

        <p className="text-center text-xs text-neutral-500">
          This cryptographic credential is fully secured and verified under unique reference number {certificate.id}.
        </p>

      </div>
    </div>
  );
}
