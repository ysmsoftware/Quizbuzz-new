'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  UserPlus,
  ArrowRight,
  History,
  Info
} from 'lucide-react';
import { crmApi, Contact } from '@/lib/api/crm.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Link from 'next/link';

import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function ContactsListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [college, setCollege] = useState('');

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['contacts', { page, search, college }],
    queryFn: () => crmApi.getContacts({ search, college, page, limit: 20 }),
  });

  const contacts = contactsData?.data?.data || [];
  const pagination = contactsData?.data?.pagination;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage deduplicated identity records across all contests.</p>
        </div>
        <Button className="rounded-xl h-11 bg-primary shadow-lg shadow-primary/20">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, email, or phone..." 
            className="pl-10 h-11 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative w-full md:w-64">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filter by college..." 
            className="pl-10 h-11 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-all"
            value={college}
            onChange={(e) => setCollege(e.target.value)}
          />
        </div>
        <Button variant="outline" className="rounded-xl h-11 border-border/50">
          <Filter className="h-4 w-4 mr-2" />
          Advanced
        </Button>
      </div>

      {/* Table */}
      <WidgetErrorBoundary name="Contacts Table">
        <Card className="bg-background/50 border-border/50 rounded-[2rem] overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-bold h-14 pl-8">Name</TableHead>
                <TableHead className="font-bold">Contact Details</TableHead>
                <TableHead className="font-bold">Institutional Info</TableHead>
                <TableHead className="font-bold text-center">Contests</TableHead>
                <TableHead className="font-bold text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={5} className="h-16 bg-secondary/10" />
                  </TableRow>
                ))
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">
                    <div className="flex flex-col items-center gap-3">
                      <Users className="h-10 w-10 opacity-20" />
                      No contacts found.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id} className="hover:bg-secondary/20 transition-colors group border-border/20">
                    <TableCell className="pl-8">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-[10px] font-black text-primary">
                          {contact.firstName[0]}{contact.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-none mb-1">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            ID: {contact.id.slice(-8)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <Building2 className="h-3 w-3 text-primary/50" />
                          {contact.college || 'N/A'}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {contact.city}, {contact.state}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[10px] font-black bg-secondary/50">
                        {contact._count?.participants || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg opacity-0 group-hover:opacity-100 transition-all" asChild>
                          <Link href={`/admin/contacts/${contact.id}`}>
                            <Info className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/contacts/${contact.id}`}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Full Profile
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/contacts/${contact.id}/history`}>
                                <History className="h-4 w-4 mr-2" />
                                Participation History
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-primary">
                              <Mail className="h-4 w-4 mr-2" />
                              Send Message
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </WidgetErrorBoundary>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground font-medium">
            Showing <span className="text-foreground">{contacts.length}</span> of <span className="text-foreground">{pagination.total}</span> records
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-10 px-4 border-border/50"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-10 px-4 border-border/50"
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
