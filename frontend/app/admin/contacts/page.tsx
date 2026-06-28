'use client';

import { useState, useEffect } from 'react';
import { useContacts } from '@/lib/hooks/useContacts';
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
  ExternalLink,
  UserPlus,
  ArrowRight,
  History,
  Info
} from 'lucide-react';
import { PaginationBar } from '@/components/ui/pagination-bar';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

export default function ContactsListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [college, setCollege] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    college: '',
    city: '',
  });

  const [createError, setCreateError] = useState<string | null>(null);

  const {
    contacts,
    pagination,
    isLoading,
    createContact,
    createContactLoading,
    createContactError,
  } = useContacts({ search, college, page, limit: 20 });

  // Reset to first page whenever search or college filter changes
  useEffect(() => {
    setPage(1);
  }, [search, college]);

  const handleCreateContact = async () => {
    try {
      await createContact(contactForm);
      setIsCreateOpen(false);
      setContactForm({ firstName: '', lastName: '', email: '', phone: '', college: '', city: '' });
      setCreateError(null);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create contact');
    }
  };

  return (
    <>
      <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage deduplicated identity records across all contests.</p>
        </div>
        <Button className="rounded-xl h-11 bg-primary shadow-lg shadow-primary/20" onClick={() => setIsCreateOpen(true)}>
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
        <Card className="bg-background/50 border-border/50 rounded-4xl overflow-hidden shadow-sm">
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
      {pagination && (
        <PaginationBar
          page={page}
          totalPages={pagination.totalPages ?? 1}
          total={pagination.total}
          pageSize={20}
          onPageChange={setPage}
          className="mt-2"
        />
      )}
    </div>

    {/* Create Contact Dialog */}
    <Dialog open={isCreateOpen} onOpenChange={(open) => {
      setIsCreateOpen(open);
      if (!open) setCreateError(null);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Contact</DialogTitle>
          <DialogDescription>Add a person to the organization's contact database.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {createError && (
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="First name"
              value={contactForm.firstName}
              onChange={(e) => setContactForm((prev) => ({ ...prev, firstName: e.target.value }))}
            />
            <Input
              placeholder="Last name"
              value={contactForm.lastName}
              onChange={(e) => setContactForm((prev) => ({ ...prev, lastName: e.target.value }))}
            />
          </div>
          <Input
            placeholder="Email"
            value={contactForm.email}
            onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <Input
            placeholder="Phone"
            value={contactForm.phone}
            onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="College"
              value={contactForm.college}
              onChange={(e) => setContactForm((prev) => ({ ...prev, college: e.target.value }))}
            />
            <Input
              placeholder="City"
              value={contactForm.city}
              onChange={(e) => setContactForm((prev) => ({ ...prev, city: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button 
            className="ml-2" 
            onClick={handleCreateContact}
            disabled={createContactLoading}
          >
            {createContactLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
        <DialogClose />
      </DialogContent>
    </Dialog>
    </>
  );
}
