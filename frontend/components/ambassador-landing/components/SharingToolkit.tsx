'use client';

import React, { useState } from 'react';
import { Link2, QrCode, MessageSquare, Users2, Copy, Check, Download, Eye, Sparkles, ArrowRight } from 'lucide-react';
import { SocialPreview } from './SocialPreview';

export const SharingToolkit: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'preview' | 'link' | 'qr' | 'social' | 'community'>('preview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sampleMessages = {
    social: `🏆 Calling all quizzers & aptitude buffs!\nMeridian State University is hosting the National Aptitude Sprint 2026 on QuizBuzz.\n• National rank benchmark & certificates\n• Cash grants & prizes worth ₹50,000\nRegister here through our campus invite: https://ysmquizbuzz.com/contest/national-aptitude-sprint-2026?ref=ABC12D`,
    community: `📢 Club Announcement: Winter Coding Cup 2026 is now live on QuizBuzz!\nOpen to all 1st-4th year students. Practice competitive DSA, test against peers nationwide, and get interview opportunities with sponsor tech firms.\nExclusive campus link: https://ysmquizbuzz.com/contest/winter-coding-cup-2026?ref=ABC12D`,
  };

  return (
    <section id="toolkit" className="py-16 md:py-24 bg-[var(--card)] border-y border-[var(--border)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DISTRIBUTION &amp; SHARING TOOLS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            Share it your way.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            Turn one campaign into something your community can actually act on. We give you ready-made tools for campus WhatsApp groups, Twitter / X announcements, club flyers, and Discord servers.
          </p>
        </div>

        {/* 5 Tool Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4 mb-10">
          {/* 1. Preview Social Share (Primary Feature) */}
          <div
            onClick={() => setActiveTab('preview')}
            className={`col-span-2 sm:col-span-1 cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${
              activeTab === 'preview'
                ? 'border-[var(--primary)] bg-[var(--background)] shadow-md ring-2 ring-[var(--primary)]/20'
                : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40'
            }`}
          >
            <div className="absolute top-3 right-3">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                Live Preview
              </span>
            </div>
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--foreground)] mb-1">
                Social Preview
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Simulate how your referral link looks with image, title &amp; description on Twitter or WhatsApp.
              </p>
            </div>
          </div>

          {/* 2. Direct Link */}
          <div
            onClick={() => setActiveTab('link')}
            className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between ${
              activeTab === 'link'
                ? 'border-[var(--primary)] bg-[var(--background)] shadow-md ring-2 ring-[var(--primary)]/20'
                : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40'
            }`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mb-3">
                <Link2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--foreground)] mb-1">
                Campaign Link
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Personalized URL with UTM parameters and 30-day attribution memory.
              </p>
            </div>
          </div>

          {/* 3. QR Code */}
          <div
            onClick={() => setActiveTab('qr')}
            className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between ${
              activeTab === 'qr'
                ? 'border-[var(--primary)] bg-[var(--background)] shadow-md ring-2 ring-[var(--primary)]/20'
                : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40'
            }`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--foreground)] mb-1">
                Printable QR Code
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Vector QR code ready for hostel bulletin boards and classroom handouts.
              </p>
            </div>
          </div>

          {/* 4. Social Kit */}
          <div
            onClick={() => setActiveTab('social')}
            className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between ${
              activeTab === 'social'
                ? 'border-[var(--primary)] bg-[var(--background)] shadow-md ring-2 ring-[var(--primary)]/20'
                : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40'
            }`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--foreground)] mb-1">
                Social Copy Kit
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Formatted announcements for WhatsApp stories, Instagram, and LinkedIn.
              </p>
            </div>
          </div>

          {/* 5. Community Kit */}
          <div
            onClick={() => setActiveTab('community')}
            className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between ${
              activeTab === 'community'
                ? 'border-[var(--primary)] bg-[var(--background)] shadow-md ring-2 ring-[var(--primary)]/20'
                : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40'
            }`}
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <Users2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--foreground)] mb-1">
                Community Kit
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Discord markdown blocks, Telegram channel broadcasts, and club newsletter drafts.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Tool Preview Box */}
        <div className="max-w-6xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 sm:p-6 shadow-sm">
          {/* Tab 1: Live Social Share Preview */}
          {activeTab === 'preview' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-black text-[var(--foreground)] tracking-tight">
                  Social Preview &amp; Card Simulator
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Simulates how your shared campaign card and referral link appears when posted across Twitter/X, WhatsApp, and LinkedIn with title, description, and high-quality placeholder images.
                </p>
              </div>

              <SocialPreview initialCampaignId="meridian-nas-2026" />
            </div>
          )}

          {/* Tab 2: Direct Link */}
          {activeTab === 'link' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-bold text-[var(--foreground)]">
                  Your Direct Referral URL
                </h4>
                <button
                  onClick={() => setActiveTab('preview')}
                  className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview social card</span>
                </button>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mb-4">
                Share this in direct DMs, bio links, or email signatures. Every click is tracked with 30-day cookie attribution.
              </p>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  readOnly
                  value="https://ysmquizbuzz.com/contest/national-aptitude-sprint-2026?ref=ABC12D"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs sm:text-sm font-mono text-[var(--foreground)] select-all"
                />
                <button
                  onClick={() => handleCopyText('https://ysmquizbuzz.com/contest/national-aptitude-sprint-2026?ref=ABC12D', 'directLink')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:opacity-95 flex items-center gap-1.5 transition-colors"
                >
                  {copiedKey === 'directLink' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === 'directLink' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Quick tip banner */}
              <div className="p-3.5 rounded-xl bg-[var(--secondary)]/60 border border-[var(--border)] flex items-center justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">
                  Want to see how this link appears when pasted in WhatsApp chats or tweets?
                </span>
                <button
                  onClick={() => setActiveTab('preview')}
                  className="font-bold text-[var(--primary)] hover:underline flex items-center gap-1 ml-2 shrink-0"
                >
                  <span>Open Preview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: QR Code */}
          {activeTab === 'qr' && (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Stylized QR Code SVG */}
              <div className="w-36 h-36 rounded-2xl border-2 border-[var(--border)] bg-white p-3 flex flex-col items-center justify-center shadow-sm shrink-0">
                <div className="grid grid-cols-5 gap-1.5 w-full h-full p-1 bg-slate-950 rounded-lg">
                  <div className="col-span-2 row-span-2 bg-white rounded-xs" />
                  <div className="col-span-1 bg-white" />
                  <div className="col-span-2 row-span-2 bg-white rounded-xs" />
                  <div className="col-span-1 bg-white" />
                  <div className="col-span-3 bg-white" />
                  <div className="col-span-1 bg-white" />
                  <div className="col-span-2 row-span-2 bg-white rounded-xs" />
                  <div className="col-span-1 bg-white" />
                  <div className="col-span-2 row-span-2 bg-white rounded-xs" />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[var(--foreground)] mb-1">
                  Dynamic Campus QR Flyer
                </h4>
                <p className="text-xs text-[var(--muted-foreground)] mb-4 leading-relaxed">
                  Students can point their smartphone camera and open the registration page instantly. Generated with high error-correction so it scans even when printed at small poster sizes.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleCopyText('https://ysmquizbuzz.com/contest/national-aptitude-sprint-2026?ref=ABC12D', 'qrDownload')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:opacity-95 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'qrDownload' ? 'Link Copied' : 'Download SVG / PNG'}</span>
                  </button>
                  <span className="text-xs text-[var(--muted-foreground)]">300 DPI ready</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Social Share Kit */}
          {activeTab === 'social' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-[var(--foreground)]">
                  WhatsApp &amp; Instagram Broadcast Copy
                </h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Card</span>
                  </button>
                  <button
                    onClick={() => handleCopyText(sampleMessages.social, 'socialCopy')}
                    className="text-xs font-bold text-[var(--foreground)] hover:text-[var(--primary)] flex items-center gap-1"
                  >
                    {copiedKey === 'socialCopy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'socialCopy' ? 'Copied' : 'Copy text'}</span>
                  </button>
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] font-mono whitespace-pre-line leading-relaxed mb-4">
                {sampleMessages.social}
              </div>

              {/* Callout to preview */}
              <div className="p-3.5 rounded-xl bg-[var(--secondary)]/60 border border-[var(--border)] flex items-center justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">
                  Check how the link preview unfurls with image, title, and description on WhatsApp.
                </span>
                <button
                  onClick={() => setActiveTab('preview')}
                  className="font-bold text-[var(--primary)] hover:underline flex items-center gap-1 ml-2 shrink-0"
                >
                  <span>See Live Preview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Tab 5: Community Kit */}
          {activeTab === 'community' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-[var(--foreground)]">
                  Discord &amp; Telegram Club Announcement
                </h4>
                <button
                  onClick={() => handleCopyText(sampleMessages.community, 'communityCopy')}
                  className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
                >
                  {copiedKey === 'communityCopy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'communityCopy' ? 'Copied' : 'Copy text'}</span>
                </button>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] font-mono whitespace-pre-line leading-relaxed">
                {sampleMessages.community}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};