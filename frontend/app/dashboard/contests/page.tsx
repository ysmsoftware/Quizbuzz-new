'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clock, Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useParticipantDashboard } from '@/lib/hooks/useParticipantDashboard';

const PARTICIPANT_ID = 'QZCP12345ABC';

export default function ContestsPage() {
  const { upcomingContests, activeContests, pastContests, registrations, loading } =
    useParticipantDashboard(PARTICIPANT_ID);
  const [filter, setFilter] = useState('all');

  let contests = [];
  if (filter === 'active') contests = activeContests;
  else if (filter === 'upcoming') contests = upcomingContests;
  else if (filter === 'past') contests = pastContests;
  else contests = [...activeContests, ...upcomingContests, ...pastContests];

  const getContestStatus = (contest: any) => {
    const isRegistered = registrations.has(contest.id);
    const now = new Date();
    const startTime = new Date(contest.contestStartTime);
    const endTime = new Date(contest.contestEndTime);

    if (startTime > now) {
      return isRegistered ? 'Registered' : 'Not Registered';
    } else if (endTime > now) {
      return 'Live Now';
    } else {
      return 'Completed';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Contests</h1>
          <p className="text-muted-foreground">Browse and manage your quiz contests</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contests</SelectItem>
            <SelectItem value="active">Active Now</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contests Grid */}
      {contests.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">No contests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contests.map((contest) => {
            const isRegistered = registrations.has(contest.id);
            const status = getContestStatus(contest);

            return (
              <Card key={contest.id} className="flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg line-clamp-2">{contest.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {contest.category}
                      </CardDescription>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      status === 'Live Now'
                        ? 'bg-yellow-100 text-yellow-800'
                        : isRegistered
                        ? 'bg-green-100 text-green-800'
                        : 'bg-muted'
                    }`}>
                      {status}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {contest.description}
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Target className="h-4 w-4" />
                      <span>{contest.totalQuestions} Questions</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{contest.durationMinutes} mins</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{contest.currentParticipants} participants</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      {new Date(contest.contestDate).toLocaleDateString()}
                    </p>

                    {status === 'Live Now' && isRegistered ? (
                      <Link href={`/quiz/${contest.id}/live`}>
                        <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
                          Join Quiz Now
                        </Button>
                      </Link>
                    ) : status === 'Not Registered' ? (
                      <Link href={`/quiz/${contest.id}/entry`}>
                        <Button className="w-full">Register</Button>
                      </Link>
                    ) : status === 'Registered' ? (
                      <Link href={`/quiz/${contest.id}/waiting`}>
                        <Button className="w-full" variant="outline">
                          View Details
                        </Button>
                      </Link>
                    ) : (
                      <Link href={`/results/${contest.id}`}>
                        <Button className="w-full" variant="outline">
                          View Results
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
