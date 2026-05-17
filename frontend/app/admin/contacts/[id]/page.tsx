'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  Calendar,
  ChevronLeft,
  History,
  CreditCard,
  FileText,
  Trophy,
  Activity,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { crmApi } from '@/lib/api/crm.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { format } from 'date-fns';
import Link from 'next/link';

export default function ContactProfilePage() {
  const { id: contactId } = useParams() as { id: string };
  const router = useRouter();

  // Queries
  const { data: contact, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => crmApi.getContactDetail(contactId).then(res => res.data),
  });

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['contact-history', contactId],
    queryFn: () => crmApi.getContactHistory(contactId).then(res => res.data),
  });

  if (isLoadingProfile) {
    return <div className="p-8 flex items-center justify-center">Loading profile...</div>;
  }

  if (!contact) {
    return <div className="p-8 text-center text-muted-foreground">Contact not found.</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Contact Profile</h1>
          <p className="text-muted-foreground">Comprehensive view of user information and activity.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Info */}
        <div className="space-y-8">
          <Card className="bg-background/50 border-border/50 rounded-[2rem] overflow-hidden shadow-sm">
            <CardHeader className="p-8 pb-0 text-center">
              <div className="h-24 w-24 rounded-[2.5rem] bg-primary/10 mx-auto flex items-center justify-center text-2xl font-black text-primary shadow-2xl shadow-primary/10 mb-6">
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <CardTitle className="text-2xl font-black">{contact.firstName} {contact.lastName}</CardTitle>
              <CardDescription className="text-xs font-mono uppercase tracking-widest">{contact.id}</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Email Address</p>
                    <p className="text-sm font-medium">{contact.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Phone Number</p>
                    <p className="text-sm font-medium">{contact.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Institutional Affiliation</p>
                    <p className="text-sm font-medium">{contact.college || 'Not Specified'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location</p>
                    <p className="text-sm font-medium">{contact.city}, {contact.state}</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border/50 space-y-3">
                <Button className="w-full rounded-xl h-12 bg-primary font-bold shadow-lg shadow-primary/20">
                  Edit Information
                </Button>
                <Button variant="outline" className="w-full rounded-xl h-12 border-border/50 font-bold group">
                  <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
                  Send Private Message
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-secondary/20 border-border/50 rounded-2xl p-6">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Contests</p>
              <p className="text-3xl font-black">{history?.length || 0}</p>
            </Card>
            <Card className="bg-secondary/20 border-border/50 rounded-2xl p-6">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Success Rate</p>
              <p className="text-3xl font-black text-green-500">
                {history ? Math.round((history.filter(h => h.submission && parseInt(h.submission.percentage) >= 60).length / history.length) * 100) : 0}%
              </p>
            </Card>
          </div>
        </div>

        {/* Participation History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
              Participation History
            </h2>
          </div>

          <Card className="bg-background/50 border-border/50 rounded-[2rem] overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold h-14 pl-8">Contest</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold text-center">Result</TableHead>
                  <TableHead className="font-bold text-center">Payment</TableHead>
                  <TableHead className="font-bold text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell colSpan={5} className="h-20 bg-secondary/10" />
                    </TableRow>
                  ))
                ) : history?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">
                      No participation records found for this contact.
                    </TableCell>
                  </TableRow>
                ) : (
                  history?.map((item) => (
                    <TableRow key={item.participantId} className="hover:bg-secondary/20 transition-colors group border-border/20">
                      <TableCell className="pl-8">
                        <div>
                          <p className="font-bold text-sm leading-tight mb-1">{item.contest.title}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(item.joinedAt), 'MMM dd, yyyy')} • {item.registrationRef}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[10px] font-black bg-secondary/50 uppercase tracking-wider">
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.submission ? (
                          <div className="space-y-1">
                            <p className="text-sm font-black text-primary">{item.submission.score}</p>
                            <div className="flex items-center justify-center gap-1">
                              <Trophy className="h-3 w-3 text-amber-500" />
                              <span className="text-[10px] font-bold text-muted-foreground">Rank {item.submission.rank}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No result</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.payment.status === 'SUCCESS' ? (
                          <Badge className="bg-green-500/10 text-green-500 border-none gap-1 px-2 py-0.5 text-[10px] font-bold">
                            <ShieldCheck className="h-3 w-3" /> Paid
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 px-2 py-0.5 text-[10px] font-bold">
                            <Activity className="h-3 w-3" /> {item.payment.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" asChild>
                          <Link href={`/admin/contests/${item.contest.id}/registrations`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
