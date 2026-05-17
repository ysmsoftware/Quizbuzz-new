import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion, useSpring, useTransform } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  format?: (val: number) => string;
  trend?: {
    value: string;
    label: string;
    isPositive: boolean;
  };
  status?: {
    label: string;
    type: 'success' | 'warning' | 'info' | 'default';
  };
  className?: string;
}

export function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  format = (val) => val.toLocaleString(),
  trend,
  status,
  className 
}: StatCardProps) {
  const springValue = useSpring(0, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });
  
  const displayValue = useTransform(springValue, (latest) => format(Math.floor(latest)));

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  return (
    <Card className={cn("overflow-hidden border-border/50", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <motion.h3 className="text-3xl font-bold tracking-tight">
              {displayValue}
            </motion.h3>
          </div>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {trend && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
              trend.isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}>
              {trend.value}
            </div>
          )}
          {status && (
            <div className={cn(
              "px-2 py-0.5 rounded text-xs font-medium",
              status.type === 'success' && "bg-green-100 text-green-700",
              status.type === 'warning' && "bg-amber-100 text-amber-700",
              status.type === 'info' && "bg-blue-100 text-blue-700",
              status.type === 'default' && "bg-slate-100 text-slate-700",
            )}>
              {status.label}
            </div>
          )}
          {trend && <span className="text-xs text-muted-foreground">{trend.label}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
