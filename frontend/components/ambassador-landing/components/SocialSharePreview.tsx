'use client';

import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  Eye, 
  Code2, 
  RefreshCw, 
  Share2, 
  Heart, 
  Repeat2, 
  MessageCircle, 
  Bookmark, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles 
} from 'lucide-react';
import { MOCK_CAMPAIGNS } from '../data/mockData';
import { Campaign } from '../types';

interface SocialSharePreviewProps {
  initialCampaignId?: string;
  onSelectCampaign?: (campaign: Campaign) => void;
}

export const SocialSharePreview: React.FC<SocialSharePreviewProps> = ({
  initialCampaignId = 'meridian-nas-2026',
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'whatsapp' | 'twitter' | 'linkedin'>('whatsapp');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(initialCampaignId);
  const [ambassadorHandle, setAmbassadorHandle] = useState<string>('austin');
  const [viewMode, setViewMode] = useState<'preview' | 'metadata'>('preview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState<boolean>(false);
  const [cacheValidated, setCacheValidated] = useState<boolean>(true);

  // Find active campaign
  const activeCampaign = MOCK_CAMPAIGNS.find((c) => c.id === selectedCampaignId) || MOCK_CAMPAIGNS[0];

  // Derived referral link with dynamic ambassador handle
  const contestSlug = activeCampaign.contestSlug || activeCampaign.promotedContest.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const referralCode = ambassadorHandle.trim().toUpperCase() || 'ABC12D';
  const dynamicSlug = `ysmquizbuzz.com/contest/${contestSlug}?ref=${referralCode}`;
  const dynamicUrl = `https://${dynamicSlug}`;

  // Derived metadata
  const metaTitle = `${activeCampaign.promotedContest} | QuizBuzz Campus Challenge`;
  const metaDescription = `${activeCampaign.aboutContest} Organized by ${activeCampaign.organization}. Benchmark nationally and win cash rewards.`;
  const metaSiteName = 'QuizBuzz • Student Growth Ecosystem';
  const metaImage = `https://quizbuzz.com/og/campaigns/${activeCampaign.id}.png`;

  // Prepared share copy
  const whatsappMessage = `🏆 Calling all quizzers & students!
Registration for the *${activeCampaign.promotedContest}* hosted by *${activeCampaign.organization}* is now live on QuizBuzz.
• National rank benchmark & verified credentials
• Cash grants: ${activeCampaign.rewardDetails}
Register via our campus referral portal:
${dynamicUrl}`;

  const twitterTweet = `Calling all ambitious students! 🚀

Registration is now live for the ${activeCampaign.promotedContest} hosted by ${activeCampaign.organization} on @QuizBuzz 🏆

Benchmark nationally, get certified, and compete for cash grants.
Exclusive campus invite link 👇
${dynamicUrl}

#QuizBuzz #CampusAmbassador #StudentCompetitions`;

  const linkedinPost = `Excited to announce that registrations are open for the ${activeCampaign.promotedContest}, organized by ${activeCampaign.organization} via the QuizBuzz student network.

Whether you're looking to test your domain skills or represent our university on the national leaderboard, this is an incredible opportunity.

👉 Secure your spot via our student cohort link: ${dynamicUrl}`;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimulateRefresh = () => {
    setIsRefreshingCache(true);
    setTimeout(() => {
      setIsRefreshingCache(false);
      setCacheValidated(true);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Bar: Platform Selector & Campaign Picker */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
        {/* Platform Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--background)] border border-[var(--border)] w-full md:w-auto">
          <button
            onClick={() => setSelectedPlatform('whatsapp')}
            className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              selectedPlatform === 'whatsapp'
                ? 'bg-[#25D366] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => setSelectedPlatform('twitter')}
            className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              selectedPlatform === 'twitter'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <span className="font-mono text-sm font-black">𝕏</span>
            <span>Twitter / X</span>
          </button>

          <button
            onClick={() => setSelectedPlatform('linkedin')}
            className={`flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              selectedPlatform === 'linkedin'
                ? 'bg-[#0A66C2] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <span className="font-serif font-black text-xs">in</span>
            <span>LinkedIn</span>
          </button>
        </div>

        {/* Campaign Dropdown & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--muted-foreground)] font-medium hidden sm:inline">Campaign:</span>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs font-semibold text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {MOCK_CAMPAIGNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.promotedContest} ({c.category})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center p-0.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-semibold">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'preview'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Feed Preview</span>
            </button>
            <button
              onClick={() => setViewMode('metadata')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'metadata'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>OpenGraph Tags</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Preview Container */}
      {viewMode === 'preview' ? (
        <div className="space-y-4">
          {/* ==================== 1. WHATSAPP PREVIEW ==================== */}
          {selectedPlatform === 'whatsapp' && (
            <div className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm bg-[#EFEAE2] dark:bg-[#0B141A] transition-colors">
              {/* WhatsApp App Bar */}
              <div className="px-4 py-3 bg-[#008069] dark:bg-[#1F2C34] text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center border border-emerald-600">
                    AM
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight flex items-center gap-1">
                      <span>Austin Makasare (Student Ambassador)</span>
                      <ShieldCheck className="w-3 h-3 text-emerald-200" />
                    </div>
                    <div className="text-[10px] text-emerald-100 opacity-90">
                      online • QuizBuzz Ambassador
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSimulateRefresh}
                    title="Simulate WhatsApp link preview crawl"
                    className="p-1.5 rounded-lg hover:bg-emerald-700/50 text-emerald-100 text-xs flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCache ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline text-[11px]">Re-crawl</span>
                  </button>
                </div>
              </div>

              {/* Chat Message Bubble Area */}
              <div className="p-4 sm:p-6 space-y-4 min-h-[360px] flex flex-col justify-end bg-[radial-gradient(#0000000a_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]">
                {/* Outgoing WhatsApp Bubble */}
                <div className="max-w-md ml-auto bg-[#E7FFDB] dark:bg-[#005C4B] rounded-2xl rounded-tr-xs p-2.5 sm:p-3 text-[#111B21] dark:text-[#E9EDEF] shadow-xs border border-emerald-200/50 dark:border-emerald-800/50">
                  {/* Rich Link Unfurl Card */}
                  <div className="rounded-xl overflow-hidden bg-white dark:bg-[#1F2C34] border border-[#d1d7db] dark:border-[#2a3942] mb-2.5 shadow-2xs">
                    {/* Visual Card Banner with live campaign badges */}
                    <div className="relative h-36 bg-linear-to-br from-emerald-800 via-teal-900 to-slate-950 p-3.5 flex flex-col justify-between text-white overflow-hidden">
                      {/* Background grid accent */}
                      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                      
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/20 backdrop-blur-md uppercase tracking-wider">
                          {activeCampaign.category}
                        </span>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/30 backdrop-blur-md text-[10px] font-bold text-emerald-200">
                          <Sparkles className="w-3 h-3" />
                          <span>Official Challenge</span>
                        </div>
                      </div>

                      <div className="relative z-10">
                        <div className="text-[11px] text-emerald-200 font-semibold mb-0.5">
                          {activeCampaign.organization}
                        </div>
                        <div className="text-base font-black tracking-tight leading-snug line-clamp-2">
                          {activeCampaign.promotedContest}
                        </div>
                      </div>

                      {/* Bottom banner strip */}
                      <div className="relative z-10 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-emerald-100/90 font-medium">
                        <span>{activeCampaign.rewardDetails}</span>
                        <span className="font-mono text-emerald-300">{activeCampaign.daysLeft} days left</span>
                      </div>
                    </div>

                    {/* Unfurl Content Metadata */}
                    <div className="p-3 bg-slate-50 dark:bg-[#1F2C34]">
                      <div className="text-xs font-bold text-[#111B21] dark:text-[#E9EDEF] leading-snug mb-1 line-clamp-1">
                        {metaTitle}
                      </div>
                      <div className="text-[11px] text-[#667781] dark:text-[#8696A0] leading-relaxed line-clamp-2 mb-2">
                        {metaDescription}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-[#667781] dark:text-[#8696A0] pt-1.5 border-t border-[#e9edef] dark:border-[#2a3942]">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">quizbuzz.com</span>
                        <span>• Campus Referral Portal</span>
                      </div>
                    </div>
                  </div>

                  {/* Accompanying chat message text */}
                  <div className="text-xs leading-relaxed whitespace-pre-line mb-1 font-sans">
                    {`🏆 Calling all quizzers & students!\nRegistration for the *${activeCampaign.promotedContest}* hosted by *${activeCampaign.organization}* is now live on QuizBuzz.\n\nExclusive campus referral link:\n`}
                    <span className="text-emerald-700 dark:text-emerald-300 underline font-mono text-[11px] break-all font-semibold">
                      {dynamicUrl}
                    </span>
                  </div>

                  {/* WhatsApp Message Metadata & Blue Ticks */}
                  <div className="flex items-center justify-end gap-1 text-[10px] text-[#667781] dark:text-[#8696A0] pt-1">
                    <span>10:42 AM</span>
                    <span className="text-[#53bdeb] font-bold text-xs tracking-tighter">✓✓</span>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="px-4 py-3 bg-white dark:bg-[#202C33] border-t border-[#E9EDEF] dark:border-[#2a3942] flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>WhatsApp rich metadata verified &amp; cached</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(whatsappMessage, 'waCopy')}
                    className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)] text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5 transition-colors"
                  >
                    {copiedKey === 'waCopy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'waCopy' ? 'Copied' : 'Copy Message'}</span>
                  </button>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Open WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 2. TWITTER / X PREVIEW ==================== */}
          {selectedPlatform === 'twitter' && (
            <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-white dark:bg-black text-black dark:text-white p-4 sm:p-6 transition-colors shadow-sm">
              <div className="flex items-start gap-3">
                {/* Profile Avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-black text-sm flex items-center justify-center shrink-0">
                  AM
                </div>

                <div className="flex-1 min-w-0">
                  {/* Tweet Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-[var(--foreground)] hover:underline cursor-pointer">
                        Austin Makasare
                      </span>
                      <span className="w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] flex items-center justify-center font-bold">
                        ✓
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        @{ambassadorHandle || 'austin_lead'}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">· 2h</span>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900">
                      Ambassador
                    </span>
                  </div>

                  {/* Tweet Text */}
                  <div className="text-sm text-[var(--foreground)] leading-relaxed mb-3 whitespace-pre-line">
                    {`Calling all ambitious students! 🚀\n\nRegistration is now live for the `}
                    <span className="font-semibold text-sky-500">#{activeCampaign.promotedContest.replace(/\s+/g, '')}</span>
                    {` hosted by ${activeCampaign.organization} on `}
                    <span className="text-sky-500">@QuizBuzz</span>
                    {` 🏆\n\nBenchmark nationally, get certified, and compete for cash grants.\nExclusive campus invite link 👇`}
                  </div>

                  {/* Twitter Summary Large Image Card */}
                  <a
                    href={dynamicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-slate-400 dark:hover:border-slate-600 transition-all group mb-3.5 bg-slate-50 dark:bg-zinc-950"
                  >
                    {/* 16:9 Image Preview Graphic */}
                    <div className="relative aspect-video w-full bg-linear-to-br from-teal-900 via-slate-900 to-indigo-950 p-5 flex flex-col justify-between text-white overflow-hidden">
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px]" />
                      
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-[var(--primary)] text-white font-black text-xs flex items-center justify-center">
                            Q
                          </div>
                          <span className="text-xs font-extrabold tracking-tight">QuizBuzz</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/20 backdrop-blur-md">
                          {activeCampaign.category}
                        </span>
                      </div>

                      <div className="relative z-10 my-auto py-3">
                        <div className="text-xs font-semibold text-teal-300 mb-1">
                          {activeCampaign.organization} presents
                        </div>
                        <h4 className="text-xl sm:text-2xl font-black tracking-tight leading-tight mb-2">
                          {activeCampaign.promotedContest}
                        </h4>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md text-xs font-semibold text-emerald-200">
                          <span>💰 Prize Pool &amp; Grants</span>
                          <span>•</span>
                          <span>{activeCampaign.rewardDetails}</span>
                        </div>
                      </div>

                      <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-white/10">
                        <span>Attribution: {ambassadorHandle}</span>
                        <span className="font-mono text-emerald-400 font-bold">Open to All Streams</span>
                      </div>
                    </div>

                    {/* Card Meta Content */}
                    <div className="p-3.5 bg-slate-50 dark:bg-zinc-900/90 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-[11px] font-mono text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                        <span>quizbuzz.com</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </div>
                      <div className="text-sm font-bold text-[var(--foreground)] group-hover:text-sky-500 transition-colors line-clamp-1">
                        {metaTitle}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] line-clamp-2 mt-0.5 leading-relaxed">
                        {metaDescription}
                      </div>
                    </div>
                  </a>

                  {/* Twitter Tweet Action Bar */}
                  <div className="flex items-center justify-between max-w-md text-xs text-[var(--muted-foreground)] pt-2 border-t border-slate-100 dark:border-slate-900">
                    <button className="flex items-center gap-1.5 hover:text-sky-500 transition-colors group">
                      <div className="p-1.5 rounded-full group-hover:bg-sky-500/10">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <span>18</span>
                    </button>

                    <button className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors group">
                      <div className="p-1.5 rounded-full group-hover:bg-emerald-500/10">
                        <Repeat2 className="w-4 h-4" />
                      </div>
                      <span>34</span>
                    </button>

                    <button
                      onClick={() => setIsLiked(!isLiked)}
                      className={`flex items-center gap-1.5 transition-colors group ${
                        isLiked ? 'text-pink-500' : 'hover:text-pink-500'
                      }`}
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-pink-500/10">
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-pink-500' : ''}`} />
                      </div>
                      <span>{isLiked ? 143 : 142}</span>
                    </button>

                    <button className="flex items-center gap-1.5 hover:text-sky-500 transition-colors group">
                      <div className="p-1.5 rounded-full group-hover:bg-sky-500/10">
                        <Bookmark className="w-4 h-4" />
                      </div>
                      <span>12</span>
                    </button>

                    <button className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="mt-6 pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1.5">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--secondary)] font-semibold">
                    twitter:card = summary_large_image
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(twitterTweet, 'twCopy')}
                    className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)] text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5 transition-colors"
                  >
                    {copiedKey === 'twCopy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'twCopy' ? 'Copied' : 'Copy Tweet'}</span>
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterTweet)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Post on X</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 3. LINKEDIN PREVIEW ==================== */}
          {selectedPlatform === 'linkedin' && (
            <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--card)] p-4 sm:p-6 shadow-sm transition-colors">
              {/* Author Header */}
              <div className="flex items-center gap-3 mb-3.5">
                <div className="w-11 h-11 rounded-full bg-[var(--primary)] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  AM
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--foreground)] leading-tight flex items-center gap-1.5">
                    <span>Austin Makasare</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">• 1st</span>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Campus Growth Lead @ QuizBuzz • Meridian State University
                  </div>
                  <div className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
                    <span>1h</span>
                    <span>•</span>
                    <span>🌐</span>
                  </div>
                </div>
              </div>

              {/* Body Copy */}
              <div className="text-xs sm:text-sm text-[var(--foreground)] leading-relaxed mb-4 whitespace-pre-line">
                {linkedinPost}
              </div>

              {/* LinkedIn Rich Link Card */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)] group">
                <div className="relative h-44 bg-linear-to-r from-emerald-950 via-teal-900 to-slate-950 p-4 text-white flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/20">
                      QUIZBUZZ ECOSYSTEM
                    </span>
                    <span className="text-[10px] text-emerald-300 font-mono font-semibold">
                      VERIFIED CHALLENGE
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-emerald-300 mb-1">
                      {activeCampaign.organization}
                    </div>
                    <div className="text-lg font-black tracking-tight leading-snug">
                      {activeCampaign.promotedContest}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-300 flex items-center justify-between">
                    <span>{activeCampaign.rewardDetails}</span>
                    <span className="font-mono text-emerald-400 font-bold">{activeCampaign.category}</span>
                  </div>
                </div>

                <div className="p-3 bg-[var(--card)]">
                  <div className="text-xs font-bold text-[var(--foreground)] line-clamp-1 mb-1">
                    {metaTitle}
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] line-clamp-2 mb-2">
                    {metaDescription}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    quizbuzz.com
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="mt-5 pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[var(--muted-foreground)]">
                  Simulated LinkedIn feed rendering with OpenGraph 1.91:1 ratio
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(linkedinPost, 'liCopy')}
                    className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)] text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5 transition-colors"
                  >
                    {copiedKey === 'liCopy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'liCopy' ? 'Copied' : 'Copy Post'}</span>
                  </button>
                  <button
                    onClick={() => handleCopy(dynamicUrl, 'liLink')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0A66C2] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#004182] transition-colors shadow-xs"
                  >
                    {copiedKey === 'liLink' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Share URL</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ==================== METADATA & OPENGRAPH INSPECTOR ==================== */
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div>
              <h4 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[var(--primary)]" />
                <span>OpenGraph &amp; Twitter Card Meta Tags</span>
              </h4>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Automatically rendered by QuizBuzz edge servers when your link is crawled.
              </p>
            </div>
            <button
              onClick={() => handleCopy(
`<meta property="og:type" content="website" />
<meta property="og:site_name" content="${metaSiteName}" />
<meta property="og:title" content="${metaTitle}" />
<meta property="og:description" content="${metaDescription}" />
<meta property="og:url" content="${dynamicUrl}" />
<meta property="og:image" content="${metaImage}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${metaTitle}" />
<meta name="twitter:description" content="${metaDescription}" />
<meta name="twitter:image" content="${metaImage}" />`, 'metaTagsCopy'
              )}
              className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)] text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5 transition-colors"
            >
              {copiedKey === 'metaTagsCopy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'metaTagsCopy' ? 'Copied' : 'Copy All Tags'}</span>
            </button>
          </div>

          {/* Tag Rows */}
          <div className="space-y-2.5 font-mono text-xs">
            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <span className="text-purple-600 dark:text-purple-400 font-bold">&lt;meta&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">property</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">"og:title"&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">content</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-sky-600 dark:text-sky-400">"{metaTitle}"</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold">&nbsp;/&gt;</span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <span className="text-purple-600 dark:text-purple-400 font-bold">&lt;meta&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">property</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">"og:description"&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">content</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-sky-600 dark:text-sky-400">"{metaDescription}"</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold">&nbsp;/&gt;</span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <span className="text-purple-600 dark:text-purple-400 font-bold">&lt;meta&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">property</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">"og:url"&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">content</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-sky-600 dark:text-sky-400">"{dynamicUrl}"</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold">&nbsp;/&gt;</span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <span className="text-purple-600 dark:text-purple-400 font-bold">&lt;meta&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">name</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">"twitter:card"&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">content</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-sky-600 dark:text-sky-400">"summary_large_image"</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold">&nbsp;/&gt;</span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <span className="text-purple-600 dark:text-purple-400 font-bold">&lt;meta&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">property</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">"og:image"&nbsp;</span>
              <span className="text-amber-600 dark:text-amber-400">content</span>
              <span className="text-[var(--foreground)]">=</span>
              <span className="text-sky-600 dark:text-sky-400">"{metaImage}"</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold">&nbsp;/&gt;</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/15 text-xs text-[var(--muted-foreground)] leading-relaxed">
            <span className="font-bold text-[var(--foreground)]">Why OpenGraph matters for Ambassadors:</span> Messages with preview cards achieve up to <strong>3.8x higher click-through rates</strong> in campus WhatsApp groups and Twitter feeds compared to raw unformatted links.
          </div>
        </div>
      )}

      {/* Dynamic Handle Modifier Footer */}
      <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted-foreground)] font-medium">Your referral code:</span>
          <div className="flex items-center gap-1 font-mono">
            <span className="text-[var(--muted-foreground)]">ysmquizbuzz.com/contest/.../?ref=</span>
            <input
              type="text"
              value={ambassadorHandle}
              onChange={(e) => setAmbassadorHandle(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              placeholder="ABC12D"
              className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs font-bold text-[var(--foreground)] w-24 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] uppercase"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopy(dynamicUrl, 'dynUrl')}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--background)] font-bold text-[var(--foreground)] flex items-center gap-1 transition-colors"
          >
            {copiedKey === 'dynUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'dynUrl' ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export { SocialPreview } from './SocialPreview';