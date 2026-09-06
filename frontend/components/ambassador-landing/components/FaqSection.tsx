'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import { FAQ_ITEMS } from '../data/mockData';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // first open by default
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  const categories = ['All', 'Program', 'Attribution & Tracking', 'Rewards & Payout', 'Rules & Guidelines'];

  const filteredFaqs = FAQ_ITEMS.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesQuery =
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-16 md:py-24 bg-[var(--background)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>COMMON QUESTIONS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-[var(--muted-foreground)] leading-relaxed">
            Everything you need to know about joining campaigns, tracking your referrals, and receiving payouts.
          </p>
        </div>

        {/* Categories Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.question}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleAccordion(idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                >
                  <span className="leading-snug">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[var(--primary)]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)]/60 bg-[var(--background)]/50">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};