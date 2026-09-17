"use client";

// Small, isolated motion primitives for the public contest page. Kept as
// memoized leaf components so a parent re-render (contest-details.tsx polls
// the contest every 60s and recomputes phase every 30s) never restarts an
// in-flight animation or re-triggers a mount transition — each of these only
// re-renders when its own primitive props actually change.

import { memo, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 100, damping: 20 };

// Fade + slide-up entrance. `mode="mount"` plays immediately (above-the-fold
// hero content); `mode="view"` (default) plays once when scrolled into view.
export const Reveal = memo(function Reveal({
  children,
  delay = 0,
  className,
  mode = "view",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  mode?: "view" | "mount";
}) {
  const motionProps =
    mode === "mount"
      ? { animate: { opacity: 1, y: 0 } }
      : {
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-40px" },
        };
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      {...motionProps}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
});

// Ticks a number up/down with spring physics whenever `value` changes —
// used for the live participant count so a 60s poll reads as motion instead
// of a silent swap. Does not animate on first mount (that would misread as
// growth from zero).
export const AnimatedCounter = memo(function AnimatedCounter({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (v) =>
    Math.round(v).toLocaleString(),
  );
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    const controls = animate(motionValue, value, SPRING);
    return controls.stop;
  }, [value, motionValue]);

  return <motion.span className={className}>{rounded}</motion.span>;
});

// Spring-animated capacity bar, replacing a plain CSS width transition so
// the fill reacts with the same weighty physics as the rest of the page.
export const AnimatedProgressBar = memo(function AnimatedProgressBar({
  percentage,
  className,
}: {
  percentage: number;
  className?: string;
}) {
  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-secondary", className)}
    >
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percentage, 100)}%` }}
        transition={SPRING}
      />
    </div>
  );
});

// Small perpetual pulse, used next to the "Contest Live" badge — a real
// status signal (something is actively happening right now), not motion for
// its own sake.
export const PulseDot = memo(function PulseDot({
  className,
}: {
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      <motion.span
        className="absolute inline-flex size-full rounded-full bg-current opacity-60"
        animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
      />
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
});

// Progressive disclosure for the organizer-authored rules list — caps the
// wall of text at 5 items with a spring height-reveal for the rest, instead
// of grouping (the rules are free text with no category metadata, so
// grouping would mean guessing at content).
export const ExpandableRulesList = memo(function ExpandableRulesList({
  rules,
}: {
  rules: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = 5;
  const primary = rules.slice(0, visibleCount);
  const rest = rules.slice(visibleCount);

  const renderRule = (rule: string, key: number) => (
    <li key={key} className="flex items-start gap-2 text-sm">
      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
      <span>{rule}</span>
    </li>
  );

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {primary.map((rule, i) => renderRule(rule, i))}
      </ul>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className="space-y-2 overflow-hidden"
          >
            {rest.map((rule, i) => renderRule(rule, i + visibleCount))}
          </motion.ul>
        )}
      </AnimatePresence>
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {expanded ? "Show fewer rules" : `Show all ${rules.length} rules`}
        </button>
      )}
    </div>
  );
});
