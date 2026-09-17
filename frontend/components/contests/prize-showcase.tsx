"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";
import type { PublicContestPrize } from "@/lib/types/public-contest";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/contests/contest-motion";

// Isolated + memoized so the perpetual breathing loop never restarts —
// PrizeShowcase itself only re-renders when the prizes array changes.
const PodiumGlow = memo(function PodiumGlow() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 top-2 mx-auto h-56 max-w-xl blur-3xl"
      style={{
        background:
          "radial-gradient(50% 100% at 50% 35%, var(--accent), transparent 70%)",
      }}
      animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.08, 1] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
});

interface PrizeShowcaseProps {
  prizes: PublicContestPrize[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function ordinal(n: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${n}${suffixes[n] ?? "th"}`;
}

function goodieWorth(prize: PublicContestPrize): string | null {
  const v = prize.goodieCashEquivalent;
  return v != null && Number(v) > 0 ? formatCurrency(Number(v)) : null;
}

// Podium rungs only make sense for a single, specific position — a prize
// spanning a range (e.g. rank 4-10) can't stand on one step. Anything else
// (ranges, or a solo rank below 3rd) renders as a tier row instead.
function isPodiumRank(prize: PublicContestPrize): boolean {
  return prize.rankFrom === prize.rankTo && prize.rankFrom <= 3;
}

// One consistent brand color across all three podium spots — rank is
// communicated by height/order/badge number, not by a gold/silver/bronze
// palette.
const PODIUM_GRADIENT = "from-accent to-accent/60";
const PODIUM_TEXT = "text-accent-foreground";

const RANK_STYLES: Record<
  number,
  { tier: string; blockHeight: string; order: string }
> = {
  1: { tier: "Champion", blockHeight: "h-24", order: "order-2" },
  2: { tier: "Runner-up", blockHeight: "h-17", order: "order-1" },
  3: { tier: "Third place", blockHeight: "h-13", order: "order-3" },
};

// The goodie image is an optional field in the contest-create form (Step 3 —
// prizes may be cash-only, or added without a photo). A missing image must
// not read as a broken/generic placeholder, so the fallback is the rank
// itself — "1st" / "2nd" / "3rd" — which is specific to that podium spot
// rather than a stock trophy icon.
function PedestalMedal({
  rank,
  imageUrl,
  label,
}: {
  rank: number;
  imageUrl?: string | null;
  label: string;
}) {
  return (
    <div className="relative mb-2.5">
      <div
        className={cn(
          "absolute -inset-3 rounded-full opacity-70 blur-md bg-gradient-to-br",
          PODIUM_GRADIENT,
        )}
        aria-hidden
      />
      <div
        className={cn(
          "relative size-20 sm:size-24 rounded-full p-[3px] bg-gradient-to-br shadow-md",
          PODIUM_GRADIENT,
        )}
      >
        <div className="size-full rounded-full overflow-hidden bg-card border-2 border-background flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={label}
              className="size-full object-cover"
            />
          ) : (
            <span
              className={cn("text-xl sm:text-2xl font-extrabold", PODIUM_TEXT)}
            >
              {ordinal(rank)}
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-6 rounded-full grid place-items-center text-xs font-bold border-2 border-background shadow bg-gradient-to-br",
          PODIUM_GRADIENT,
          PODIUM_TEXT,
        )}
      >
        {rank}
      </div>
    </div>
  );
}

// Hover/tap content — this is where the full prize detail lives now that the
// pedestal itself only shows the image and title. Leads with the same image
// (or ordinal fallback) shown on the pedestal, since the card previously had
// no image at all even when one was set on the prize.
function PrizeDetails({
  prize,
  rank,
  label,
}: {
  prize: PublicContestPrize;
  rank: number;
  label: string;
}) {
  const amount = Number(prize.amount);
  const worth = goodieWorth(prize);
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative w-full aspect-square rounded-xl overflow-hidden bg-gradient-to-br p-[2px]",
          PODIUM_GRADIENT,
        )}
      >
        <div className="size-full rounded-[10px] overflow-hidden bg-card flex items-center justify-center">
          {prize.goodieImageUrl ? (
            <img
              src={prize.goodieImageUrl}
              alt={label}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <span className={cn("text-4xl font-extrabold", PODIUM_TEXT)}>
              {ordinal(rank)}
            </span>
          )}
        </div>
        {worth && (
          <span className="absolute top-2 right-2 whitespace-nowrap rounded-full bg-background/90 border px-2.5 py-1 text-xs font-semibold shadow-sm">
            Worth ~{worth}
          </span>
        )}
      </div>
      <div>
        <p className="font-semibold">{label}</p>
        {amount > 0 && (
          <p className="text-sm font-semibold text-primary mt-0.5">
            {formatCurrency(amount)}
          </p>
        )}
        {prize.goodieLabel && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Includes {prize.goodieLabel}
            {worth && ` (Worth ~${worth})`}
          </p>
        )}
      </div>
      {prize.benefits && prize.benefits.length > 0 && (
        <ul className="space-y-1">
          {prize.benefits.map((b) => (
            <li key={b} className="text-sm text-muted-foreground">
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pedestal({
  prize,
  delay = 0,
}: {
  prize: PublicContestPrize;
  delay?: number;
}) {
  const rank = prize.rankFrom;
  const style = RANK_STYLES[rank];
  const label = prize.label || `${ordinal(rank)} Rank Winner`;

  return (
    <Reveal
      delay={delay}
      className={cn(
        "relative z-10 flex w-1/3 max-w-48 flex-col items-center",
        style.order,
      )}
    >
      <HoverCard openDelay={100} closeDelay={80}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex flex-col items-center",
              rank === 1 && "scale-105 sm:scale-110",
            )}
          >
            <PedestalMedal
              rank={rank}
              imageUrl={prize.goodieImageUrl}
              label={label}
            />
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-wide",
                PODIUM_TEXT,
              )}
            >
              {style.tier}
            </span>
            <span className="mt-0.5 text-center text-sm font-semibold">
              {label}
            </span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72" align="center">
          <PrizeDetails prize={prize} rank={rank} label={label} />
        </HoverCardContent>
      </HoverCard>
      <div
        className={cn(
          "mt-3.5 w-full rounded-t-xl bg-gradient-to-b shadow-inner flex items-start justify-center pt-2",
          PODIUM_GRADIENT,
          style.blockHeight,
        )}
      >
        <span className={cn("text-2xl font-extrabold", PODIUM_TEXT)}>
          {rank}
        </span>
      </div>
    </Reveal>
  );
}

function TierRow({ prize }: { prize: PublicContestPrize }) {
  const isRange = prize.rankFrom !== prize.rankTo;
  const rangeLabel = isRange
    ? `Rank ${prize.rankFrom}–${prize.rankTo}`
    : `Rank ${prize.rankFrom}`;
  const label = prize.label || rangeLabel;
  const amount = Number(prize.amount);
  const worth = goodieWorth(prize);
  const descParts = [...(prize.benefits ?? [])];

  return (
    <div className="flex gap-4 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Sized to actually show the goodie photo, not a thumbnail it gets
          lost in — this tier's reward is the point of the card. */}
      <div className="relative size-28 sm:size-32 shrink-0 rounded-xl overflow-hidden border bg-accent/10 shadow-sm">
        {prize.goodieImageUrl ? (
          <img
            src={prize.goodieImageUrl}
            alt={prize.goodieLabel ?? label}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full flex items-center justify-center">
            <Gift className="size-9 text-muted-foreground" />
          </div>
        )}
        {worth && (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-background/90 border px-2 py-0.5 text-[10px] font-semibold shadow-sm">
            Worth ~{worth}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
          {rangeLabel}
        </span>
        <p className="font-semibold text-sm mt-1.5">{label}</p>
        {/* Ranges mean the same reward goes to every winner in that band —
            worth spelling out, since "Rank 4–10" alone reads ambiguous
            about whether it's shared or per-winner. */}
        <p className="text-xs text-muted-foreground mt-0.5">
          {isRange
            ? `Every winner ranked ${prize.rankFrom}–${prize.rankTo} receives:`
            : "Winner receives:"}
        </p>
        <p className="text-xs text-foreground mt-0.5">
          {descParts.length > 0
            ? descParts.join(" · ")
            : "Certificate of participation"}
        </p>
        {prize.goodieLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Includes {prize.goodieLabel}
            {worth && ` (worth ~${worth})`}
          </p>
        )}
        {amount > 0 && (
          <p className="text-sm font-bold text-primary mt-1.5">
            {formatCurrency(amount)}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              per winner
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export function PrizeShowcase({ prizes }: PrizeShowcaseProps) {
  if (!prizes || prizes.length === 0) return null;

  const podiumPrizes = prizes
    .filter(isPodiumRank)
    .sort((a, b) => a.rankFrom - b.rankFrom);
  const tierPrizes = prizes
    .filter((p) => !isPodiumRank(p))
    .sort((a, b) => a.rankFrom - b.rankFrom);

  return (
    <div className="space-y-3">
      {podiumPrizes.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl py-8 px-3 sm:px-8">
          {/* A soft, slowly breathing glow anchored to the medals themselves,
              not the panel's edges — no bordered/background "card" around
              the podium. */}
          <PodiumGlow />
          <div className="relative flex items-end justify-center gap-3 sm:gap-6">
            {podiumPrizes.map((prize, i) => (
              <Pedestal key={prize.id} prize={prize} delay={i * 0.08} />
            ))}
          </div>
        </div>
      )}

      {tierPrizes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tierPrizes.map((prize, i) => (
            <Reveal key={prize.id} delay={i * 0.08}>
              <TierRow prize={prize} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
