import { Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Rupees } from './Rupees';

interface Goodie {
  label: string;
  cashEquivalent?: number;
  imageUrl?: string;
}

const SIZE_CLASSES = {
  xs: 'size-7',
  sm: 'size-9',
  md: 'size-14 sm:size-16',
  lg: 'size-20 sm:size-24',
} as const;

/** A goodie's actual photo, sized to read as a photo — not the 16–20px icon a reward row
 *  used to squeeze it into. Same visual language as the contest-prize cards (prize-showcase.tsx):
 *  rounded-xl frame, "Worth ~₹X" badge overlaid once there's room for it (md/lg only). */
export function GoodieThumb({
  goodie,
  size = 'md',
  className,
}: {
  goodie: Goodie;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const showWorth = size !== 'xs' && size !== 'sm' && !!goodie.cashEquivalent && goodie.cashEquivalent > 0;
  return (
    <div
      className={cn(
        'relative shrink-0 rounded-xl overflow-hidden border border-border/50 bg-accent/10',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {goodie.imageUrl ? (
        <img src={goodie.imageUrl} alt={goodie.label} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="size-full flex items-center justify-center">
          <Gift className="size-1/3 text-muted-foreground" />
        </div>
      )}
      {showWorth && (
        <span className="absolute bottom-1 inset-x-1 truncate rounded-full bg-background/90 border border-border/50 px-1.5 py-0.5 text-center text-[9px] font-semibold shadow-sm">
          ~<Rupees amount={goodie.cashEquivalent!} />
        </span>
      )}
    </div>
  );
}
