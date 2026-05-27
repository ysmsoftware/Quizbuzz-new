'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useParticipantCertificate } from '@/lib/hooks/useParticipantCertificate';
import { 
  Award, 
  Download, 
  ChevronLeft, 
  ShieldCheck, 
  ExternalLink,
  Loader2,
  Share2,
  Linkedin,
  Twitter,
  Link2,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

export default function ParticipantCertificatePage() {
  const { id: participantId } = useParams() as { id: string };
  const router = useRouter();
  const [isCopied, setIsCopied] = useState(false);

  // ── All motion hooks MUST be called unconditionally at the top level ──────────
  // This is the root cause of React hydration error #310:
  // calling useTransform/useSpring *inside* JSX (e.g. inside `style` prop objects)
  // or *after* an early return violates the Rules of Hooks.
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 200, mass: 0.5 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), springConfig);
  const shadowX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-20, 20]), springConfig);
  const shadowY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-20, 20]), springConfig);
  const shineX = useSpring(useTransform(mouseX, [-0.5, 0.5], [0, 100]), springConfig);
  const shineY = useSpring(useTransform(mouseY, [-0.5, 0.5], [0, 100]), springConfig);

  // Pre-compute derived motion values (also unconditional)
  const boxShadow = useTransform(
    [shadowX, shadowY],
    ([sX, sY]) => `${Number(sX)}px ${Number(sY)}px 60px -10px rgba(0, 0, 0, 0.7)`
  );
  const shineBackground = useTransform(
    [shineX, shineY],
    ([sX, sY]) =>
      `radial-gradient(circle at ${Number(sX)}% ${Number(sY)}%, rgba(255,255,255,0.06) 0%, transparent 60%)`
  );
  // ─────────────────────────────────────────────────────────────────────────────

  const { certificate, loading: isLoading, error } = useParticipantCertificate(participantId);

  // Celebrate on load success
  useEffect(() => {
    if (certificate && (certificate.status === 'GENERATED' || certificate.status === 'DELIVERED')) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#c5a85c', '#d4af37', '#e5c158', '#ffffff', '#2563eb']
      });
      const end = Date.now() + 1500;
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
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
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
    const url = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '');
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  const shareToTwitter = () => {
    const text = encodeURIComponent(
      `Proudly verified my achievement in the ${certificate?.contest?.title || 'Quiz'} contest! Check out my official certificate here:`
    );
    const url = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  // ── Early returns AFTER all hooks are declared ────────────────────────────────
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
          The requested certificate is either generating, has failed, or doesn&apos;t exist. Please reach out to your administrator.
        </p>
        <Button
          variant="ghost"
          className="rounded-2xl border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-900 px-6 h-12"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const isGenerated = certificate.status === 'GENERATED' || certificate.status === 'DELIVERED';
  const isPending = certificate.status === 'PENDING' || certificate.status === 'QUEUED' || certificate.status === 'GENERATING';
  const isFailed = certificate.status === 'FAILED';

  const recipientName = certificate.participant?.contact
    ? `${certificate.participant.contact.firstName || ''} ${certificate.participant.contact.lastName || ''}`.trim()
    : 'Valued Participant';
  const contestTitle = certificate.contest?.title || 'Official Contest';
  const verificationUrl = typeof window !== 'undefined' ? window.location.href : `https://quizbuzz.com/verify/${certificate.id}`;

  // Build the clean PDF iframe URL (suppress toolbar / navigation chrome)
  const pdfEmbedUrl = certificate.fileUrl
    ? `${certificate.fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`
    : null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-neutral-950 to-neutral-950">
      
      {/* Decorative floating glows */}
      <div className="absolute top-[-10%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl w-full space-y-10 z-10 py-10">

        {/* Top bar */}
        <div className="flex justify-between items-center px-2">
          <Button
            variant="ghost"
            className="text-neutral-400 hover:text-white rounded-xl border border-neutral-900 bg-neutral-950/40 hover:bg-neutral-900/60"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-4 w-4 mr-1.5" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> SECURE INTEGRITY SEAL
            </span>
          </div>
        </div>

        {/* ── Certificate Status Header ─────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{contestTitle}</h1>
          <p className="text-neutral-400 text-sm">
            Official certificate for <span className="text-amber-400 font-bold">{recipientName}</span>
          </p>
          {certificate.generatedAt && (
            <p className="text-neutral-500 text-xs font-mono">
              Issued on {format(new Date(certificate.generatedAt), 'MMMM dd, yyyy · hh:mm a')}
            </p>
          )}
        </div>

        {/* ── Main content area ─────────────────────────────────────────────── */}
        {isPending && (
          <div className="flex flex-col items-center justify-center gap-6 bg-neutral-900/40 border border-neutral-800 rounded-3xl p-12 text-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Certificate Generating...</h2>
              <p className="text-neutral-400 text-sm max-w-sm leading-relaxed">
                Your official certificate is currently being prepared by our systems. This process typically takes a few minutes.
                Refresh this page once the results are officially published.
              </p>
            </div>
          </div>
        )}

        {isFailed && (
          <div className="flex flex-col items-center justify-center gap-6 bg-red-950/20 border border-red-900/40 rounded-3xl p-12 text-center">
            <div className="h-20 w-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Certificate Generation Failed</h2>
              <p className="text-neutral-400 text-sm max-w-sm leading-relaxed">
                There was an issue generating your certificate. Please contact your administrator to re-queue generation.
              </p>
            </div>
          </div>
        )}

        {isGenerated && pdfEmbedUrl && (
          <>
            {/* 3D interactive PDF card frame */}
            <div className="perspective-[1400px] flex justify-center">
              <motion.div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  rotateX,
                  rotateY,
                  transformStyle: 'preserve-3d',
                  boxShadow,
                }}
                className="w-full max-w-[860px] rounded-[2rem] border border-amber-500/20 relative overflow-hidden cursor-pointer transition-all duration-200 select-none bg-neutral-900"
              >
                {/* Shine overlay — uses pre-computed motion value */}
                <motion.div
                  style={{ background: shineBackground }}
                  className="absolute inset-0 pointer-events-none z-10"
                />

                {/* Corner ornaments */}
                {[
                  'top-4 left-4 border-t-2 border-l-2',
                  'top-4 right-4 border-t-2 border-r-2',
                  'bottom-4 left-4 border-b-2 border-l-2',
                  'bottom-4 right-4 border-b-2 border-r-2',
                ].map((pos, i) => (
                  <div
                    key={i}
                    className={`absolute h-6 w-6 pointer-events-none z-10 border-amber-500/40 ${pos}`}
                  />
                ))}

                {/* Verified seal badge */}
                <div className="absolute top-4 right-[4.5rem] z-20 flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-sm">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </div>

                {/* ── Official S3 PDF Embed ─────────────────────────────────── */}
                <div className="relative w-full" style={{ aspectRatio: '1.414 / 1' }}>
                  <iframe
                    src={pdfEmbedUrl}
                    title={`${recipientName} — ${contestTitle} Certificate`}
                    className="absolute inset-0 w-full h-full rounded-[2rem] border-0"
                    loading="lazy"
                  />
                  {/* Fallback message for browsers that don't support inline PDF */}
                  <noscript>
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 rounded-[2rem] gap-4">
                      <FileText className="h-12 w-12 text-amber-500" />
                      <p className="text-neutral-300 text-sm">Your browser cannot display the PDF inline.</p>
                      <a href={certificate.fileUrl!} download className="text-amber-400 underline font-bold text-sm">
                        Download PDF
                      </a>
                    </div>
                  </noscript>
                </div>
              </motion.div>
            </div>

            {/* ── Action Row ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Certificate details + Download */}
              <div className="md:col-span-2 bg-neutral-900/30 border border-neutral-900 rounded-[2rem] p-6 space-y-5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" /> Certificate Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-900/50">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-1">RECIPIENT</span>
                    <span className="text-sm font-semibold block">{recipientName}</span>
                    <span className="text-xs text-neutral-400 font-mono block mt-0.5">
                      {certificate.participant?.contact?.email || 'N/A'}
                    </span>
                  </div>
                  <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-900/50">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-1">ISSUED ON</span>
                    <span className="text-sm font-semibold block">
                      {certificate.generatedAt ? format(new Date(certificate.generatedAt), 'MMM dd, yyyy') : '—'}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono block mt-0.5">
                      {certificate.generatedAt ? format(new Date(certificate.generatedAt), 'hh:mm a') : '—'}
                    </span>
                  </div>
                </div>

                <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-900/50">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-1">REFERENCE ID</span>
                  <span className="text-xs text-neutral-300 font-mono">{certificate.id}</span>
                </div>

                {/* QR code */}
                <div className="flex items-center gap-4 bg-neutral-950/50 p-4 rounded-xl border border-neutral-900/50">
                  <div className="bg-white p-1.5 rounded-lg shrink-0">
                    <QRCodeSVG value={verificationUrl} size={52} level="H" bgColor="#ffffff" fgColor="#000000" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">SCAN TO VERIFY</p>
                    <p className="text-xs text-neutral-400 leading-relaxed break-all">{verificationUrl}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold shadow-lg shadow-amber-500/10 hover:scale-[1.01] transition-all"
                    asChild
                  >
                    <a href={certificate.fileUrl!} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" /> Download PDF Credential
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:text-white"
                    onClick={() => window.open(certificate.fileUrl!, '_blank')}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Social sharing */}
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-[2rem] p-6 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-blue-400" /> Share Achievement
                </h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Showcase your verified credentials to your professional network.
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
          </>
        )}

        <p className="text-center text-xs text-neutral-500">
          This credential is secured under unique reference <span className="font-mono">{certificate.id}</span>.
        </p>
      </div>
    </div>
  );
}
