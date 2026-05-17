'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, Search } from 'lucide-react';
import { useState } from 'react';

export default function ParticipantsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const mockParticipants = [
    { id: '1', name: 'John Doe', email: 'john@example.com', contests: 5, totalScore: 450 },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', contests: 8, totalScore: 720 },
    { id: '3', name: 'Mike Johnson', email: 'mike@example.com', contests: 3, totalScore: 280 },
    { id: '4', name: 'Sarah Williams', email: 'sarah@example.com', contests: 12, totalScore: 1050 },
    { id: '5', name: 'Robert Brown', email: 'robert@example.com', contests: 6, totalScore: 540 },
  ];

  const filtered = mockParticipants.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/admin" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </Link>
          <h1 className="text-2xl font-bold">Participants</h1>
          <div className="w-[60px]" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Participants
            </CardTitle>
            <CardDescription>Manage and monitor participant information</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No participants found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 font-semibold text-sm">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Contests</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(participant => (
                      <tr key={participant.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-4 font-medium">{participant.name}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{participant.email}</td>
                        <td className="py-3 px-4 text-sm">{participant.contests}</td>
                        <td className="py-3 px-4 text-sm font-semibold">{participant.totalScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
