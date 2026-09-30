'use client';

import { useState, useEffect } from 'react';
import { useContacts } from '@/lib/hooks/useContacts';
import {
  Users,
  Search,
  MoreVertical,
  Mail,
  Phone,
  Building2,
  MapPin,
  ExternalLink,
  UserPlus,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
} from 'lucide-react';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';

import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Combobox, type ComboboxOption } from '@/components/shared/Combobox';
import { referenceDataService, type CollegeOption, type DepartmentOption } from '@/lib/services/reference-data-service';
import type { ContactSortField } from '@/lib/api/crm.api';
import { initials } from '@/components/admin/contacts/contact-badges';
import { ContactSnapshotSheet } from '@/components/admin/contacts/contact-snapshot-sheet';
import { SendMessageModal } from '@/components/features/messaging/SendMessageModal';

// Sentinel Combobox value meaning "not in the catalog" — reveals a free-text fallback input.
const OTHER_VALUE = '__OTHER__';
// Pinned (starts with "__") so the Combobox always shows it above nothing-matched results.
const ALL_COLLEGES = '__ALL__';
const PAGE_SIZE = 50;
const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

type Filters = {
  search: string;
  collegeId: string;
  college: string;
  letter: string;
  sortBy: ContactSortField;
  sortOrder: 'asc' | 'desc';
  page: number;
};

const DEFAULT_FILTERS: Filters = {
  search: '', collegeId: '', college: '', letter: '',
  sortBy: 'firstName', sortOrder: 'asc', page: 1,
};

const SORT_PRESETS: { value: string; label: string }[] = [
  { value: 'firstName:asc', label: 'Name (A → Z)' },
  { value: 'firstName:desc', label: 'Name (Z → A)' },
  { value: 'lastName:asc', label: 'Last name (A → Z)' },
  { value: 'lastName:desc', label: 'Last name (Z → A)' },
  { value: 'college:asc', label: 'College (A → Z)' },
  { value: 'city:asc', label: 'City (A → Z)' },
  { value: 'email:asc', label: 'Email (A → Z)' },
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
];

export default function ContactsListPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [messageContactId, setMessageContactId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    college: '',
    department: '',
    collegeId: null as string | null,
    departmentId: null as string | null,
    city: '',
  });

  const [createError, setCreateError] = useState<string | null>(null);

  // Any filter change goes back to page 1; only the pager itself moves pages.
  const updateFilters = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch, page: 1 }));

  // Restore filters/page from the URL so "back" from a profile lands on the same page.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const restored = { ...DEFAULT_FILTERS };
    (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).forEach((k) => {
      const v = q.get(k);
      if (v !== null) (restored as any)[k] = k === 'page' ? Math.max(1, Number(v) || 1) : v;
    });
    setFilters(restored);
    setSearchInput(restored.search);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const q = new URLSearchParams();
    (Object.keys(filters) as (keyof Filters)[]).forEach((k) => {
      if (filters[k] !== DEFAULT_FILTERS[k]) q.set(k, String(filters[k]));
    });
    const qs = q.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [filters, hydrated]);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    if (!hydrated || searchInput === filters.search) return;
    const t = setTimeout(() => updateFilters({ search: searchInput }), 300);
    return () => clearTimeout(t);
  }, [searchInput, hydrated]);

  // College/Department catalog (see backend/src/common/colleges.ts) — same
  // Combobox + "Other" fallback pattern used on the contact detail/edit page.
  const [createColleges, setCreateColleges] = useState<CollegeOption[]>([]);
  const [createDepartments, setCreateDepartments] = useState<DepartmentOption[]>([]);
  const [selectedCreateCollegeId, setSelectedCreateCollegeId] = useState('');
  const [selectedCreateDepartmentId, setSelectedCreateDepartmentId] = useState('');

  useEffect(() => {
    referenceDataService.getColleges().then(setCreateColleges).catch(() => { });
  }, []);

  useEffect(() => {
    if (!selectedCreateCollegeId || selectedCreateCollegeId === OTHER_VALUE) {
      setCreateDepartments([]);
      return;
    }
    referenceDataService.getDepartments(selectedCreateCollegeId).then(setCreateDepartments).catch(() => setCreateDepartments([]));
  }, [selectedCreateCollegeId]);

  const createCollegeOptions: ComboboxOption[] = [
    ...createColleges.map((c) => ({ value: c.id, label: c.name })),
    { value: OTHER_VALUE, label: 'Other (not listed)' },
  ];
  const createDepartmentOptions: ComboboxOption[] = [
    ...createDepartments.map((d) => ({ value: d.id, label: d.name })),
    { value: OTHER_VALUE, label: 'Other (not listed)' },
  ];
  const filterCollegeOptions: ComboboxOption[] = [
    ...createColleges.map((c) => ({ value: c.id, label: c.name })),
    { value: ALL_COLLEGES, label: 'All colleges' },
  ];

  const handleFilterCollege = (value: string) => {
    if (value === ALL_COLLEGES) return updateFilters({ collegeId: '', college: '' });
    const picked = createColleges.find((c) => c.id === value);
    updateFilters({ collegeId: value, college: picked?.name ?? '' });
  };

  const handleCreateCollegeSelect = (value: string) => {
    setSelectedCreateCollegeId(value);
    setSelectedCreateDepartmentId('');
    if (value === OTHER_VALUE) {
      setContactForm((prev) => ({ ...prev, college: '', collegeId: null, department: '', departmentId: null }));
    } else {
      const college = createColleges.find((c) => c.id === value);
      setContactForm((prev) => ({ ...prev, college: college?.name ?? '', collegeId: value, department: '', departmentId: null }));
    }
  };

  const handleCreateDepartmentSelect = (value: string) => {
    setSelectedCreateDepartmentId(value);
    if (value === OTHER_VALUE) {
      setContactForm((prev) => ({ ...prev, department: '', departmentId: null }));
    } else {
      const department = createDepartments.find((d) => d.id === value);
      setContactForm((prev) => ({ ...prev, department: department?.name ?? '', departmentId: value }));
    }
  };

  const { page, ...query } = filters;
  const {
    contacts,
    pagination,
    isLoading,
    contactsQuery,
    createContact,
    createContactLoading,
  } = useContacts(
    {
      ...Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '')),
      page,
      limit: PAGE_SIZE,
    },
    { enabled: hydrated },
  );

  const activeFilterCount = [filters.collegeId, filters.letter, filters.search].filter(Boolean).length;

  const toggleSort = (field: ContactSortField) =>
    updateFilters({
      sortBy: field,
      sortOrder: filters.sortBy === field && filters.sortOrder === 'asc' ? 'desc' : 'asc',
    });

  const SortHead = ({ field, children, className }: { field: ContactSortField; children: React.ReactNode; className?: string }) => {
    const active = filters.sortBy === field;
    const Icon = !active ? ArrowUpDown : filters.sortOrder === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead className={cn('font-bold', className)}>
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={cn('inline-flex items-center gap-1.5 hover:text-foreground transition-colors', active && 'text-foreground')}
        >
          {children}
          <Icon className={cn('h-3.5 w-3.5', !active && 'opacity-40')} />
        </button>
      </TableHead>
    );
  };

  const handleCreateContact = async () => {
    try {
      await createContact(contactForm);
      setIsCreateOpen(false);
      setContactForm({ firstName: '', lastName: '', email: '', phone: '', college: '', department: '', collegeId: null, departmentId: null, city: '' });
      setSelectedCreateCollegeId('');
      setSelectedCreateDepartmentId('');
      setCreateError(null);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create contact');
    }
  };

  return (
    <>
      <div className="p-2 md:p-4 space-y-4 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
            {pagination && (
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{pagination.total.toLocaleString()}</span>
                {activeFilterCount > 0 ? ' matching' : ' total'}
              </span>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              className="pl-10 h-11 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-all"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="w-full lg:w-80 min-w-0 flex items-center gap-1">
            <Combobox
              options={filterCollegeOptions}
              value={filters.collegeId}
              onChange={handleFilterCollege}
              placeholder="Filter by college..."
              searchPlaceholder="Search colleges..."
              className="h-11 rounded-xl bg-secondary/30 border-border/50"
            />
            {filters.collegeId && (
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label="Clear college filter" onClick={() => handleFilterCollege(ALL_COLLEGES)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onValueChange={(v) => {
              const [sortBy, sortOrder] = v.split(':') as [ContactSortField, 'asc' | 'desc'];
              updateFilters({ sortBy, sortOrder });
            }}
          >
            <SelectTrigger className="w-full lg:w-52 h-11! rounded-xl bg-secondary/30 border-border/50">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_PRESETS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="rounded-xl h-11 bg-primary shadow-lg shadow-primary/20 shrink-0" onClick={() => setIsCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>

        {/* Table + phone-book letter rail */}
        <div className="flex items-start gap-2">
        <WidgetErrorBoundary name="Contacts Table">
          <Card className={cn('flex-1 min-w-0 bg-background/50 border-border/50 rounded-3xl overflow-hidden shadow-sm transition-opacity', contactsQuery.isFetching && !isLoading && 'opacity-60')}>
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent border-none">
                  <SortHead field="firstName" className="h-14 pl-8">Name</SortHead>
                  <SortHead field="email">Contact Details</SortHead>
                  <SortHead field="college">Institutional Info</SortHead>
                  <TableHead className="font-bold text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || !hydrated ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell colSpan={4} className="h-16 bg-secondary/10" />
                    </TableRow>
                  ))
                ) : contactsQuery.isError ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-3 text-sm text-destructive">
                        Couldn&apos;t load contacts.
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => contactsQuery.refetch()}>Try again</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="h-10 w-10 opacity-20" />
                        No contacts found{activeFilterCount > 0 ? ' for these filters' : ''}.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="hover:bg-secondary/20 transition-colors group border-border/20 cursor-pointer"
                      onClick={() => setSnapshotId(contact.id)}
                    >
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/5 flex items-center justify-center text-[10px] font-black text-primary">
                            {initials(contact.firstName, contact.lastName)}
                          </div>
                          <div className="min-w-0">
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
                            <Mail className="h-3 w-3 shrink-0" />
                            {contact.email}
                          </div>
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              {contact.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-start gap-2 text-xs font-bold">
                            <Building2 className="h-3 w-3 mt-0.5 shrink-0 text-primary/50" />
                            <span className="line-clamp-2">{contact.college || 'N/A'}</span>
                          </div>
                          {(contact.city || contact.state) && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {[contact.city, contact.state].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" title="Quick view" onClick={() => setSnapshotId(contact.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
                              <DropdownMenuItem asChild>
                                <Link href={`/org/contacts/${contact.id}`}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Full Profile
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-primary" onClick={() => setMessageContactId(contact.id)}>
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

          <nav className="sticky top-4 shrink-0 flex flex-col items-center gap-0.5" aria-label="Jump to letter">
            {['All', ...LETTERS].map((l) => {
              const value = l === 'All' ? '' : l;
              const active = filters.letter.toUpperCase() === value;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => updateFilters({ letter: active && value ? '' : value })}
                  aria-pressed={active}
                  className={cn(
                    'w-8 rounded-md text-[11px] font-bold leading-none transition-colors',
                    l === 'All' ? 'h-7 mb-1' : 'h-6',
                    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {l}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Pagination */}
        {pagination && pagination.total > 0 && (
          <PaginationBar
            page={filters.page}
            totalPages={pagination.totalPages || 1}
            total={pagination.total}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => {
              setFilters((prev) => ({ ...prev, page: p }));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="mt-2"
          />
        )}
      </div>

      <ContactSnapshotSheet
        contactId={snapshotId}
        onOpenChange={(open) => !open && setSnapshotId(null)}
        onSendMessage={(id) => setMessageContactId(id)}
      />
      {messageContactId && (
        <SendMessageModal
          open
          onOpenChange={(open) => !open && setMessageContactId(null)}
          contestId=""
          contactId={messageContactId}
        />
      )}

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

          <div className="space-y-3 mt-2">
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
              <div className="space-y-2">
                <Combobox
                  options={createCollegeOptions}
                  value={selectedCreateCollegeId}
                  onChange={handleCreateCollegeSelect}
                  placeholder="Select college"
                  searchPlaceholder="Search colleges..."
                />
                {selectedCreateCollegeId === OTHER_VALUE && (
                  <Input
                    placeholder="Enter college name"
                    value={contactForm.college}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, college: e.target.value }))}
                  />
                )}
              </div>
              {selectedCreateCollegeId && selectedCreateCollegeId !== OTHER_VALUE ? (
                <div className="space-y-2">
                  <Combobox
                    options={createDepartmentOptions}
                    value={selectedCreateDepartmentId}
                    onChange={handleCreateDepartmentSelect}
                    placeholder="Select department"
                    searchPlaceholder="Search departments..."
                  />
                  {selectedCreateDepartmentId === OTHER_VALUE && (
                    <Input
                      placeholder="Enter department"
                      value={contactForm.department}
                      onChange={(e) => setContactForm((prev) => ({ ...prev, department: e.target.value }))}
                    />
                  )}
                </div>
              ) : (
                <Input
                  placeholder="Department"
                  value={contactForm.department}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, department: e.target.value }))}
                />
              )}
            </div>
            <Input
              placeholder="City"
              value={contactForm.city}
              onChange={(e) => setContactForm((prev) => ({ ...prev, city: e.target.value }))}
            />
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
