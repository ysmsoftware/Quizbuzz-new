'use client';

import Link from 'next/link';
import { Plus, BookOpen, MessageSquare, Trophy, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ACTIONS = [
  { label: 'New contest', href: '/org/contests/create', icon: Plus },
  { label: 'Add questions', href: '/org/questions/create', icon: BookOpen },
  { label: 'Message participants', href: '/org/messages', icon: MessageSquare },
  { label: 'Manage contests', href: '/org/contests', icon: Trophy },
];

export function QuickActionsCard() {
  return (
    <Card className="border-border/50 h-full py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-semibold">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        <div>
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-secondary/40 transition-colors group"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/50 bg-secondary/30 text-muted-foreground shrink-0 group-hover:text-primary group-hover:border-primary/40 transition-colors">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium flex-1">{action.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
