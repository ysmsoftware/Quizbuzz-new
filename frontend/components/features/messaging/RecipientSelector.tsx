import React from 'react';
import { RecipientFilter } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle, CreditCard } from 'lucide-react';

interface RecipientSelectorProps {
  selectedFilter: RecipientFilter;
  onFilterChange: (filter: RecipientFilter) => void;
  recipientCounts: {
    all: number;
    confirmed: number;
    paid: number;
  };
  loading?: boolean;
}

export function RecipientSelector({
  selectedFilter,
  onFilterChange,
  recipientCounts,
  loading = false,
}: RecipientSelectorProps) {
  const filters: Array<{
    value: RecipientFilter;
    label: string;
    icon: React.ReactNode;
    description: string;
  }> = [
    {
      value: 'all',
      label: 'All Registered',
      icon: <Users className="h-4 w-4" />,
      description: 'All participants',
    },
    {
      value: 'confirmed',
      label: 'Confirmed Only',
      icon: <CheckCircle className="h-4 w-4" />,
      description: 'Email confirmed',
    },
    {
      value: 'paid',
      label: 'Paid Only',
      icon: <CreditCard className="h-4 w-4" />,
      description: 'Payment completed',
    },
  ];

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Select Recipients
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.value}
            variant={selectedFilter === filter.value ? 'default' : 'outline'}
            onClick={() => onFilterChange(filter.value)}
            disabled={loading}
            className="h-auto py-3 flex flex-col items-start gap-2"
          >
            <div className="flex items-center gap-2 w-full">
              {filter.icon}
              <span className="font-medium">{filter.label}</span>
            </div>
            <div className="text-xs opacity-90">
              {filter.description}
            </div>
            <Badge variant="secondary" className="mt-1">
              {filter.value === 'all' && recipientCounts.all}
              {filter.value === 'confirmed' && recipientCounts.confirmed}
              {filter.value === 'paid' && recipientCounts.paid}
              {' '}recipients
            </Badge>
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>
          {selectedFilter === 'all' && recipientCounts.all}
          {selectedFilter === 'confirmed' && recipientCounts.confirmed}
          {selectedFilter === 'paid' && recipientCounts.paid}
        </strong>
        {' '}participants will receive this message
      </p>
    </div>
  );
}
