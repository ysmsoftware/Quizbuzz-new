'use client';

import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Share2, 
  Heart, 
  Repeat2, 
  MessageCircle, 
  Bookmark, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles,
  Sliders,
  Image as ImageIcon,
  RotateCcw,
  Trophy
} from 'lucide-react';
import { MOCK_CAMPAIGNS } from '../data/mockData';

// Curated high-quality placeholder image presets for generic QuizBuzz competition campaigns
export const PLACEHOLDER_IMAGE_PRESETS = [
  {
    id: 'quizbuzz-arena',
    label: 'QuizBuzz Arena',
    category: 'Official Tournament',
    url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&h=630&q=85',
    description: 'Electric competition arena with tournament stage lights and podiums',
  },
  {
    id: 'campus-academic',
    label: 'Academic Sprint',
    category: 'University Challenge',
    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&h=630&q=85',
    description: 'Collegiate competition team collaborating in study hall',
  },
  {
    id: 'coding-terminal',
    label: 'Coding Cup',
    category: 'Hackathon & DSA',
    url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&h=630&q=85',
    description: 'Sleek dark algorithmic coding setup and compiler interface',
  },
  {
    id: 'business-analytics',
    label: 'Case League',
    category: 'Finance & Strategy',
    url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&h=630&q=85',
    description: 'Strategy competition room with financial charts and decks',
  },
  {
    id: 'ai-matrix',
    label: 'AI & Cloud Cup',
    category: 'Innovation Challenge',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&h=630&q=85',
    description: 'Futuristic neural matrix data stream and machine learning visuals',
  },
  {
    id: 'grandmaster-bowl',
    label: 'Trivia Grandmaster',
    category: 'Auditorium Championship',
    url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&h=630&q=85',
    description: 'Collegiate auditorium quiz bowl championship stage',
  },
];

interface SocialPreviewProps {
  initialCampaignId?: string;
  className?: string;
}

export const SocialPreview: React.FC<SocialPreviewProps> = ({
  initialCampaignId = 'meridian-nas-2026',
  className = '',
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'whatsapp' | 'twitter' | 'linkedin'>('twitter');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(initialCampaignId);
  const [ambassadorHandle, setAmbassadorHandle] = useState<string>('ABC12D');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState<boolean>(false);
  const [customImageSelected, setCustomImageSelected] = useState<string | null>(null);
  const [showCustomizer, setShowCustomizer] = useState<boolean>(false);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);

  // Active campaign data
  const activeCampaign = MOCK_CAMPAIGNS.find((c) => c.id === selectedCampaignId) || MOCK_CAMPAIGNS[0];

  // Editable meta state (defaults from campaign)
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customDesc, setCustomDesc] = useState<string>('');

  // Selected image placeholder: user-selected preset, campaign image, or default fallback
  const currentImageUrl = customImageSelected || activeCampaign.ogImage || PLACEHOLDER_IMAGE_PRESETS[0].url;

  // Derived title & description (supports inline customizer)
  const metaTitle = customTitle.trim() || `${activeCampaign.promotedContest} | QuizBuzz Campus Challenge`;
  const metaDescription = customDesc.trim() || `${activeCampaign.aboutContest} Organized by ${activeCampaign.organization}. Benchmark nationally and win cash rewards.`;

  // Dynamic link based on contest slug and ambassador ref code:
  // Format: ysmquizbuzz.com/contest/:contestSlug?ref=ABC12D
  const contestSlug = activeCampaign.contestSlug || activeCampaign.promotedContest.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const referralCode = ambassadorHandle.trim().toUpperCase() || 'ABC12D';
  const dynamicSlug = `ysmquizbuzz.com/contest/${contestSlug}?ref=${referralCode}`;
  const dynamicUrl = `https://${dynamicSlug}`;

  // Prepared share messages
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
      setImageLoadError(false);
    }, 600);
  };

  const resetCustomOverrides = () => {
    setCustomTitle('');
    setCustomDesc('');
    setCustomImageSelected(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Controls Row: Platform Tabs + Campaign Selector + Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-[var(--card)] border border-[var(--border)]">
        {/* Platform Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--background)] border border-[var(--border)] shrink-0">
          <button
            onClick={() => setSelectedPlatform('twitter')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedPlatform === 'twitter'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <span className="font-mono text-xs font-black">𝕏</span>
            <span>Twitter / X</span>
          </button>

          <button
            onClick={() => setSelectedPlatform('whatsapp')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedPlatform === 'whatsapp'
                ? 'bg-[#25D366] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => setSelectedPlatform('linkedin')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedPlatform === 'linkedin'
                ? 'bg-[#0A66C2] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <span className="font-serif font-black text-xs">in</span>
            <span>LinkedIn</span>
          </button>
        </div>

        {/* Campaign Dropdown, Card Preview Indicator & Customize Button */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs flex-1 sm:flex-initial">
            <span className="text-[var(--muted-foreground)] font-medium hidden md:inline">Campaign:</span>
            <select
              value={selectedCampaignId}
              onChange={(e) => {
                setSelectedCampaignId(e.target.value);
                setCustomImageSelected(null);
                setCustomTitle('');
                setCustomDesc('');
                setImageLoadError(false);
              }}
              className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-semibold text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {MOCK_CAMPAIGNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.promotedContest} ({c.category})
                </option>
              ))}
            </select>
          </div>

          {/* Customize Button */}
          <button
            onClick={() => setShowCustomizer(!showCustomizer)}
            title="Toggle card copy and image customizer"
            className={`px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0 ${
              showCustomizer 
                ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-xs' 
                : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {/* Two-Column Layout: Left Side Settings & Clicking | Right Side Preview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ==================== LEFT COLUMN: SETTINGS & CONTROLS ==================== */}
        <div className="lg:col-span-6 space-y-4">
          {/* 1. Placeholder Images Grid */}
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[var(--primary)]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                  Card Visuals &amp; Placeholder Images
                </h4>
              </div>
              <span className="text-[11px] text-[var(--muted-foreground)]">Click to test photo</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PLACEHOLDER_IMAGE_PRESETS.map((preset) => {
                const isSelected = currentImageUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setCustomImageSelected(preset.url);
                      setImageLoadError(false);
                    }}
                    className={`relative p-1.5 rounded-xl border text-left transition-all group overflow-hidden flex flex-col ${
                      isSelected
                        ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20 bg-[var(--background)] shadow-xs'
                        : 'border-[var(--border)] bg-[var(--background)]/60 hover:border-[var(--primary)]/40'
                    }`}
                  >
                    <div className="relative h-16 w-full rounded-lg overflow-hidden bg-slate-900 mb-1.5">
                      <img
                        src={preset.url}
                        alt={preset.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/20" />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-[var(--foreground)] truncate leading-tight">
                      {preset.label}
                    </div>
                    <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                      {preset.category}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Optional Copy Customizer (Controlled by Customize toggle or inline) */}
          {showCustomizer && (
            <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--border)]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--foreground)]">
                  <Sliders className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Customize Title &amp; Description Overrides</span>
                </div>
                {(customTitle || customDesc || customImageSelected) && (
                  <button
                    onClick={resetCustomOverrides}
                    className="text-[10px] text-[var(--muted-foreground)] hover:text-rose-500 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--muted-foreground)] mb-1 block">
                    Custom Card Title (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder={activeCampaign.promotedContest}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--muted-foreground)] mb-1 block">
                    Custom Card Description (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder={activeCampaign.aboutContest.slice(0, 60) + '...'}
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Ambassador Referral Handle & Quick Copy Bar */}
          <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[var(--muted-foreground)] font-medium shrink-0">Ref code:</span>
              <div className="flex items-center gap-1 font-mono text-[11px] truncate flex-1">
                <span className="text-[var(--muted-foreground)] truncate hidden sm:inline">ysmquizbuzz.com/contest/{contestSlug}?ref=</span>
                <span className="text-[var(--muted-foreground)] truncate sm:hidden">.../contest/?ref=</span>
                <input
                  type="text"
                  value={ambassadorHandle}
                  onChange={(e) => setAmbassadorHandle(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  placeholder="ABC12D"
                  className="px-2 py-0.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs font-bold text-[var(--foreground)] w-24 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] uppercase"
                />
              </div>
            </div>

            <button
              onClick={() => handleCopy(dynamicUrl, 'dynUrl')}
              className="px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--background)] font-bold text-[var(--foreground)] flex items-center gap-1 transition-colors shrink-0 text-xs"
            >
              {copiedKey === 'dynUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'dynUrl' ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* ==================== RIGHT COLUMN: COMPACT LIVE CARD PREVIEW ==================== */}
        <div className="lg:col-span-6 space-y-3">
          {/* Card Preview Header Status */}
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] px-1">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {selectedPlatform === 'twitter' && 'Twitter / X Timeline Card'}
                {selectedPlatform === 'whatsapp' && 'WhatsApp Rich Link Unfurl'}
                {selectedPlatform === 'linkedin' && 'LinkedIn Feed Post'}
              </span>
            </div>
            <span className="text-[11px] font-mono opacity-80">
              {selectedPlatform === 'twitter' && '1200×630 summary_large_image'}
              {selectedPlatform === 'whatsapp' && 'Chat message with thumbnail'}
              {selectedPlatform === 'linkedin' && 'OpenGraph 1.91:1 ratio'}
            </span>
          </div>

          {/* ==================== 1. COMPACT TWITTER / X SIMULATION ==================== */}
          {selectedPlatform === 'twitter' && (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-white dark:bg-black text-black dark:text-white p-3.5 sm:p-4 shadow-sm transition-colors">
              <div className="flex items-start gap-2.5">
                {/* Profile Avatar */}
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-black text-xs flex items-center justify-center shrink-0">
                  AM
                </div>

                <div className="flex-1 min-w-0">
                  {/* Tweet Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1 truncate">
                      <span className="font-bold text-xs text-[var(--foreground)] hover:underline truncate">
                        Austin Makasare
                      </span>
                      <span className="w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[8px] flex items-center justify-center font-bold shrink-0">
                        ✓
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)] truncate">
                        @{ambassadorHandle || 'austin'}
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)] shrink-0">· 15m</span>
                    </div>
                  </div>

                  {/* Tweet Text (Compact) */}
                  <div className="text-xs text-[var(--foreground)] leading-relaxed mb-2.5 line-clamp-3">
                    {`Registration is now live for the `}
                    <span className="font-semibold text-sky-500">#{activeCampaign.promotedContest.replace(/\s+/g, '')}</span>
                    {` hosted by ${activeCampaign.organization} on @QuizBuzz 🏆\nCompete for cash grants & national rank. Campus invite 👇`}
                  </div>

                  {/* Twitter Summary Large Image Card - Compact height */}
                  <a
                    href={dynamicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-slate-400 dark:hover:border-slate-600 transition-all group mb-2.5 bg-slate-50 dark:bg-zinc-950"
                  >
                    {/* Compact Image Banner */}
                    <div className="relative h-32 sm:h-36 w-full overflow-hidden bg-slate-900">
                      {!imageLoadError ? (
                        <img
                          src={currentImageUrl}
                          alt={metaTitle}
                          referrerPolicy="no-referrer"
                          onError={() => setImageLoadError(true)}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 p-3 flex flex-col justify-between text-white">
                          <span className="text-[10px] font-mono uppercase text-teal-300">
                            {activeCampaign.category}
                          </span>
                          <h4 className="text-sm font-bold">{metaTitle}</h4>
                        </div>
                      )}

                      {/* Card Overlay Gradient & Badges */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-black/40 p-2.5 flex flex-col justify-between text-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15">
                            <div className="w-3.5 h-3.5 rounded-full bg-[var(--primary)] text-white font-black text-[8px] flex items-center justify-center">
                              Q
                            </div>
                            <span className="text-[10px] font-extrabold tracking-tight">QuizBuzz</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 backdrop-blur-md">
                            {activeCampaign.category}
                          </span>
                        </div>

                        <div>
                          <div className="text-[10px] font-semibold text-teal-300 mb-0.5 drop-shadow-xs">
                            {activeCampaign.organization}
                          </div>
                          <h4 className="text-xs sm:text-sm font-black tracking-tight leading-tight mb-1 drop-shadow-md line-clamp-1">
                            {activeCampaign.promotedContest}
                          </h4>
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-md text-[10px] font-medium text-emerald-200 border border-white/15">
                            <span>💰 {activeCampaign.rewardDetails}</span>
                            <span>•</span>
                            <span className="font-mono text-white">{activeCampaign.daysLeft}d left</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Meta Footer */}
                    <div className="p-2.5 bg-slate-50 dark:bg-zinc-900/90 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                        <span>ysmquizbuzz.com</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </div>
                      <div className="text-xs font-bold text-[var(--foreground)] group-hover:text-sky-500 transition-colors line-clamp-1">
                        {metaTitle}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)] line-clamp-1 mt-0.5">
                        {metaDescription}
                      </div>
                    </div>
                  </a>

                  {/* Compact Twitter Tweet Action Bar */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] pt-1.5 border-t border-slate-100 dark:border-slate-900">
                    <div className="flex items-center gap-1 hover:text-sky-500 transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>24</span>
                    </div>

                    <div className="flex items-center gap-1 hover:text-emerald-500 transition-colors">
                      <Repeat2 className="w-3.5 h-3.5" />
                      <span>48</span>
                    </div>

                    <button
                      onClick={() => setIsLiked(!isLiked)}
                      className={`flex items-center gap-1 transition-colors ${
                        isLiked ? 'text-pink-500' : 'hover:text-pink-500'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-pink-500' : ''}`} />
                      <span>{isLiked ? 193 : 192}</span>
                    </button>

                    <div className="flex items-center gap-1 hover:text-sky-500 transition-colors">
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>19</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--muted-foreground)] font-mono">
                  twitter:card = summary_large_image
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(twitterTweet, 'twCopy')}
                    className="px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)] text-xs font-bold text-[var(--foreground)] flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'twCopy' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'twCopy' ? 'Copied' : 'Copy Tweet'}</span>
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterTweet)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-lg bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Post on X</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 2. COMPACT WHATSAPP SIMULATION ==================== */}
          {selectedPlatform === 'whatsapp' && (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden shadow-sm bg-[#EFEAE2] dark:bg-[#0B141A] transition-colors">
              {/* WhatsApp App Bar */}
              <div className="px-3 py-2 bg-[#008069] dark:bg-[#1F2C34] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center border border-emerald-600">
                    AM
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight flex items-center gap-1">
                      <span>Austin Makasare (Student Ambassador)</span>
                      <ShieldCheck className="w-3 h-3 text-emerald-200" />
                    </div>
                    <div className="text-[9px] text-emerald-100 opacity-90">
                      online • QuizBuzz Ambassador
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSimulateRefresh}
                  title="Simulate WhatsApp link preview crawl"
                  className="p-1 rounded-lg hover:bg-emerald-700/50 text-emerald-100 text-xs flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingCache ? 'animate-spin' : ''}`} />
                  <span className="text-[10px]">Re-crawl</span>
                </button>
              </div>

              {/* Chat Message Bubble Area - Compact */}
              <div className="p-3 sm:p-4 space-y-3 bg-[radial-gradient(#0000000a_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]">
                <div className="max-w-xs sm:max-w-sm ml-auto bg-[#E7FFDB] dark:bg-[#005C4B] rounded-xl rounded-tr-xs p-2 text-[#111B21] dark:text-[#E9EDEF] shadow-xs border border-emerald-200/50 dark:border-emerald-800/50">
                  {/* Rich Link Unfurl Card */}
                  <div className="rounded-lg overflow-hidden bg-white dark:bg-[#1F2C34] border border-[#d1d7db] dark:border-[#2a3942] mb-1.5 shadow-2xs">
                    {/* Compact Visual Card Banner */}
                    <div className="relative h-28 sm:h-32 overflow-hidden bg-slate-900 text-white">
                      {!imageLoadError ? (
                        <img
                          src={currentImageUrl}
                          alt={metaTitle}
                          referrerPolicy="no-referrer"
                          onError={() => setImageLoadError(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-linear-to-br from-emerald-800 to-slate-950 p-2.5 flex flex-col justify-between">
                          <span className="text-[10px] font-mono">{activeCampaign.category}</span>
                          <span className="font-bold text-xs">{activeCampaign.promotedContest}</span>
                        </div>
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/40 p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/25 backdrop-blur-md uppercase">
                            {activeCampaign.category}
                          </span>
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/30 backdrop-blur-md text-[9px] font-bold text-emerald-200">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Official</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-emerald-200 font-semibold drop-shadow-xs">
                            {activeCampaign.organization}
                          </div>
                          <div className="text-xs font-black tracking-tight leading-snug line-clamp-1 drop-shadow-md">
                            {activeCampaign.promotedContest}
                          </div>
                          <div className="text-[9px] text-emerald-100/90 font-medium mt-0.5">
                            💰 {activeCampaign.rewardDetails} • {activeCampaign.daysLeft}d left
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Unfurl Content Metadata */}
                    <div className="p-2 bg-slate-50 dark:bg-[#1F2C34]">
                      <div className="text-[11px] font-bold text-[#111B21] dark:text-[#E9EDEF] leading-tight line-clamp-1 mb-0.5">
                        {metaTitle}
                      </div>
                      <div className="text-[10px] text-[#667781] dark:text-[#8696A0] leading-snug line-clamp-1 mb-1">
                        {metaDescription}
                      </div>
                      <div className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        ysmquizbuzz.com
                      </div>
                    </div>
                  </div>

                  {/* Message body text */}
                  <div className="text-[11px] leading-snug font-sans mb-1">
                    🏆 Calling all quizzers! Registration for *{activeCampaign.promotedContest}* is live:
                    <span className="block text-emerald-700 dark:text-emerald-300 underline font-mono text-[10px] break-all font-semibold mt-0.5">
                      {dynamicUrl}
                    </span>
                  </div>

                  {/* WhatsApp Message Metadata & Blue Ticks */}
                  <div className="flex items-center justify-end gap-1 text-[9px] text-[#667781] dark:text-[#8696A0]">
                    <span>10:42 AM</span>
                    <span className="text-[#53bdeb] font-bold tracking-tighter">✓✓</span>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="px-3 py-2 bg-white dark:bg-[#202C33] border-t border-[#E9EDEF] dark:border-[#2a3942] flex items-center justify-between gap-2">
                <div className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate">Cached preview ready</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopy(whatsappMessage, 'waCopy')}
                    className="px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)] text-xs font-bold text-[var(--foreground)] flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'waCopy' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'waCopy' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 3. COMPACT LINKEDIN SIMULATION ==================== */}
          {selectedPlatform === 'linkedin' && (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)] p-3.5 sm:p-4 shadow-sm transition-colors">
              {/* Author Header */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  AM
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[var(--foreground)] leading-tight flex items-center gap-1">
                    <span className="truncate">Austin Makasare</span>
                    <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">• 1st</span>
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] truncate">
                    Campus Growth Lead @ QuizBuzz
                  </div>
                  <div className="text-[9px] text-[var(--muted-foreground)] flex items-center gap-1">
                    <span>1h</span>
                    <span>•</span>
                    <span>🌐</span>
                  </div>
                </div>
              </div>

              {/* Body Copy (Compact) */}
              <div className="text-xs text-[var(--foreground)] leading-relaxed mb-2.5 line-clamp-2">
                Excited to announce registrations are open for the {activeCampaign.promotedContest}, organized by {activeCampaign.organization}. Secure your spot: {dynamicUrl}
              </div>

              {/* LinkedIn Rich Link Card - Compact */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)] group mb-2.5">
                <div className="relative h-32 sm:h-36 overflow-hidden bg-slate-900 text-white">
                  {!imageLoadError ? (
                    <img
                      src={currentImageUrl}
                      alt={metaTitle}
                      referrerPolicy="no-referrer"
                      onError={() => setImageLoadError(true)}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                  ) : null}

                  <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/30 p-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/20">
                        QUIZBUZZ
                      </span>
                      <span className="text-[9px] text-emerald-300 font-mono font-semibold">
                        VERIFIED CHALLENGE
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-emerald-300 mb-0.5">
                        {activeCampaign.organization}
                      </div>
                      <div className="text-xs sm:text-sm font-black tracking-tight leading-snug line-clamp-1">
                        {activeCampaign.promotedContest}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-300 flex items-center justify-between">
                      <span>{activeCampaign.rewardDetails}</span>
                      <span className="font-mono text-emerald-400 font-bold">{activeCampaign.category}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-[var(--card)]">
                  <div className="text-xs font-bold text-[var(--foreground)] line-clamp-1 mb-0.5">
                    {metaTitle}
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] line-clamp-1 mb-1">
                    {metaDescription}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    ysmquizbuzz.com
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--muted-foreground)] truncate">
                  OpenGraph 1.91:1 ratio
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopy(linkedinPost, 'liCopy')}
                    className="px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)] text-xs font-bold text-[var(--foreground)] flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'liCopy' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'liCopy' ? 'Copied' : 'Copy Post'}</span>
                  </button>
                  <button
                    onClick={() => handleCopy(dynamicUrl, 'liLink')}
                    className="px-3 py-1 rounded-lg bg-[#0A66C2] text-white text-xs font-bold flex items-center gap-1 hover:bg-[#004182] transition-colors shadow-xs"
                  >
                    {copiedKey === 'liLink' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>Copy URL</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};