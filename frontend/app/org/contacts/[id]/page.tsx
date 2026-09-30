'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useContact } from '@/lib/hooks/useContact';
import {
    Mail,
    Phone,
    Calendar,
    ChevronLeft,
    ChevronDown,
    CreditCard,
    Trophy,
    ExternalLink,
    MessageSquare,
    Award,
    Download,
    AlertCircle,
    Pencil,
    Trash2,
    MoreHorizontal,
    FileText,
    History,
    Copy,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SectionErrorBoundary } from '@/components/admin/contacts/section-error-boundary';
import { CertificateBadge, ParticipantStatusBadge, PaymentBadge, formatInr, initials } from '@/components/admin/contacts/contact-badges';
import { SendMessageModal } from '@/components/features/messaging/SendMessageModal';
import { Combobox, type ComboboxOption } from '@/components/shared/Combobox';
import { referenceDataService, type CollegeOption, type DepartmentOption } from '@/lib/services/reference-data-service';
import type { ContactHistoryItem, ContactMessageItem } from '@/lib/api/crm.api';

// Sentinel Combobox value meaning "not in the catalog" — reveals a free-text fallback input.
const OTHER_VALUE = '__OTHER__';

const fmt = (d?: string | null, pattern = 'MMM d, yyyy · h:mm a') => (d ? format(new Date(d), pattern) : '—');
const fmtDuration = (secs?: number | null) =>
    secs == null ? '—' : `${Math.floor(secs / 60)}m ${secs % 60}s`;

// Shared column layout for the participation header + rows (stacked on mobile).
const ROW_GRID = 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_1.5rem] md:items-center md:gap-4';

const MESSAGE_TONE: Record<string, string> = {
    DELIVERED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    SENT: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    FAILED: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
};

export default function ContactProfilePage() {
    const { id: contactId } = useParams() as { id: string };
    const router = useRouter();

    // Centralized contact queries through useContact hook
    const {
        contact,
        isLoadingContact,
        history,
        isLoadingHistory,
        messages,
        isLoadingMessages,
        updateContact,
        isUpdating,
        deleteContact,
        isDeleting,
    } = useContact(contactId, { loadHistory: true, loadMessages: true });

    const [tab, setTab] = useState('participation');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [isMessageOpen, setIsMessageOpen] = useState(false);

    // /org/contacts/[id]/history redirects here with #participation-history. The section only
    // exists after the contact loads, so the browser's own #hash jump fires too early.
    useEffect(() => {
        if (!isLoadingContact && contact && window.location.hash === '#participation-history') {
            setTab('participation');
            document.getElementById('participation-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [isLoadingContact, contact]);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        college: '',
        department: '',
        collegeId: null as string | null,
        departmentId: null as string | null,
        city: '',
        state: '',
    });

    // College/Department catalog (see backend/src/common/colleges.ts) — same
    // Combobox + "Other" fallback pattern as the public registration form.
    const [colleges, setColleges] = useState<CollegeOption[]>([]);
    const [departments, setDepartments] = useState<DepartmentOption[]>([]);
    const [selectedCollegeId, setSelectedCollegeId] = useState('');
    const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

    useEffect(() => {
        referenceDataService.getColleges().then(setColleges).catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedCollegeId || selectedCollegeId === OTHER_VALUE) {
            setDepartments([]);
            return;
        }
        referenceDataService.getDepartments(selectedCollegeId).then(setDepartments).catch(() => setDepartments([]));
    }, [selectedCollegeId]);

    useEffect(() => {
        if (contact) {
            setFormData({
                firstName: contact.firstName || '',
                lastName: contact.lastName || '',
                email: contact.email || '',
                phone: contact.phone || '',
                college: contact.college || '',
                department: contact.department || '',
                collegeId: contact.collegeId ?? null,
                departmentId: contact.departmentId ?? null,
                city: contact.city || '',
                state: contact.state || '',
            });
            setSelectedCollegeId(contact.collegeId || (contact.college ? OTHER_VALUE : ''));
            setSelectedDepartmentId(contact.departmentId || (contact.department ? OTHER_VALUE : ''));
        }
    }, [contact]);

    const collegeOptions: ComboboxOption[] = [
        ...colleges.map((c) => ({ value: c.id, label: c.name })),
        { value: OTHER_VALUE, label: 'Other (not listed)' },
    ];
    const departmentOptions: ComboboxOption[] = [
        ...departments.map((d) => ({ value: d.id, label: d.name })),
        { value: OTHER_VALUE, label: 'Other (not listed)' },
    ];

    const handleCollegeSelect = (value: string) => {
        setSelectedCollegeId(value);
        setSelectedDepartmentId('');
        if (value === OTHER_VALUE) {
            setFormData((prev) => ({ ...prev, college: '', collegeId: null, department: '', departmentId: null }));
        } else {
            const college = colleges.find((c) => c.id === value);
            setFormData((prev) => ({ ...prev, college: college?.name ?? '', collegeId: value, department: '', departmentId: null }));
        }
    };

    const handleDepartmentSelect = (value: string) => {
        setSelectedDepartmentId(value);
        if (value === OTHER_VALUE) {
            setFormData((prev) => ({ ...prev, department: '', departmentId: null }));
        } else {
            const department = departments.find((d) => d.id === value);
            setFormData((prev) => ({ ...prev, department: department?.name ?? '', departmentId: value }));
        }
    };

    if (isLoadingContact) {
        return (
            <div className="p-4 md:p-8 space-y-6 animate-pulse w-full">
                <div className="h-24 rounded-3xl bg-secondary/40" />
                <div className="h-20 rounded-3xl bg-secondary/30" />
                <div className="h-96 rounded-3xl bg-secondary/20" />
            </div>
        );
    }

    if (!contact) {
        return <div className="p-8 text-center text-muted-foreground">Contact not found.</div>;
    }

    const items = history ?? [];
    const allMessages: ContactMessageItem[] = messages?.data ?? [];
    const messagesByContest = allMessages.reduce<Record<string, ContactMessageItem[]>>((acc, m) => {
        if (m.contestId) (acc[m.contestId] ??= []).push(m);
        return acc;
    }, {});
    const payments = items.filter((h) => h.payment);
    const certificates = items.filter((h) => h.certificate && h.certificate.status !== 'PENDING');

    const toggle = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (!next.delete(id)) next.add(id);
            return next;
        });

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateContact(formData);
            setIsEditModalOpen(false);
        } catch (err) {
            // Mutation handles Sonner error toast
        }
    };

    const handleDelete = async () => {
        if (deleteConfirmText.toLowerCase() === 'delete') {
            try {
                await deleteContact();
                setIsDeleteModalOpen(false);
                router.push('/org/contacts');
            } catch (err) {
                // Mutation handles Sonner error toast
            }
        }
    };

    return (
        <div className="p-2 md:p-4 space-y-5 animate-in fade-in duration-500 w-full">
            {/* Header */}
            <SectionErrorBoundary sectionTitle="Contact Profile">
                <Card className="rounded-3xl border-border/50 p-5 md:p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center gap-5">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                            <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={() => router.back()} aria-label="Back">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div className="h-16 w-16 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-black text-primary">
                                {initials(contact.firstName, contact.lastName)}
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h1 className="text-2xl font-black tracking-tight truncate">{contact.firstName} {contact.lastName}</h1>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                        <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="h-3.5 w-3.5" />{contact.email}</a>
                                        <CopyButton value={contact.email} label="email" />
                                    </span>
                                    {contact.phone && (
                                        <span className="inline-flex items-center gap-1">
                                            <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="h-3.5 w-3.5" />{contact.phone}</a>
                                            <CopyButton value={contact.phone} label="phone number" />
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:shrink-0">
                            <Button className="rounded-xl" onClick={() => setIsEditModalOpen(true)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                            </Button>
                            <Button variant="outline" className="rounded-xl" onClick={() => setIsMessageOpen(true)}>
                                <MessageSquare className="h-4 w-4 mr-2" /> Message
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="rounded-xl" aria-label="More actions">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        disabled={isDeleting}
                                        onClick={() => { setDeleteConfirmText(''); setIsDeleteModalOpen(true); }}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" /> Delete contact
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </Card>
            </SectionErrorBoundary>

            <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
                {/* Details */}
                <Card className="rounded-3xl border-border/50 p-5 shadow-sm gap-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Details</p>
                    <Detail label="Institution" value={contact.college} />
                    <Detail label="Department" value={contact.department} />
                    <Detail label="Location" value={[contact.city, contact.state].filter(Boolean).join(', ')} />
                    <div className="pt-3 border-t border-border/50 space-y-1 text-[11px] text-muted-foreground">
                        <p className="font-mono break-all">ID {contact.id}</p>
                        <p>Added {fmt(contact.createdAt)}</p>
                        <p>Updated {fmt(contact.updatedAt)}</p>
                    </div>
                </Card>

                {/* Activity */}
                <div id="participation-history" className="min-w-0 scroll-mt-24">
                    <Tabs value={tab} onValueChange={setTab} className="gap-4">
                        <TabsList className="rounded-xl h-10 flex-wrap">
                            <TabsTrigger value="participation" className="rounded-lg"><History className="h-4 w-4" /> Participation ({items.length})</TabsTrigger>
                            <TabsTrigger value="payments" className="rounded-lg"><CreditCard className="h-4 w-4" /> Payments ({payments.length})</TabsTrigger>
                            <TabsTrigger value="messages" className="rounded-lg"><MessageSquare className="h-4 w-4" /> Messages ({messages?.total ?? allMessages.length})</TabsTrigger>
                            <TabsTrigger value="certificates" className="rounded-lg"><Award className="h-4 w-4" /> Certificates ({certificates.length})</TabsTrigger>
                        </TabsList>

                        <TabsContent value="participation" className="space-y-3">
                            <SectionErrorBoundary sectionTitle="Participation History">
                                {isLoadingHistory ? (
                                    <Skeleton />
                                ) : items.length === 0 ? (
                                    <Empty text="No participation records found for this contact." />
                                ) : (
                                    <Card className="rounded-2xl border-border/50 overflow-hidden shadow-sm gap-0 py-0">
                                        <div className={cn(ROW_GRID, 'hidden bg-secondary/50 px-5 py-3 text-xs font-bold text-muted-foreground')}>
                                            <span>Contest</span>
                                            <span>Status</span>
                                            <span>Result</span>
                                            <span>Certificate</span>
                                            <span>Payment</span>
                                            <span className="sr-only">Details</span>
                                        </div>
                                        <div className="divide-y divide-border/50">
                                            {items.map((item) => (
                                                <ParticipationRow
                                                    key={item.participantId}
                                                    item={item}
                                                    messages={messagesByContest[item.contestId] ?? []}
                                                    open={expanded.has(item.participantId)}
                                                    onToggle={() => toggle(item.participantId)}
                                                />
                                            ))}
                                        </div>
                                    </Card>
                                )}
                            </SectionErrorBoundary>
                        </TabsContent>

                        <TabsContent value="payments" className="space-y-3">
                            {isLoadingHistory ? <Skeleton /> : payments.length === 0 ? (
                                <Empty text="No payment records for this contact." />
                            ) : payments.map((item) => (
                                <Card key={item.participantId} className="rounded-2xl border-border/50 p-4 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm">{item.contestTitle}</p>
                                            <p className="text-[11px] text-muted-foreground font-mono">{item.registrationRef}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black">{formatInr(item.payment!.amount)}</span>
                                            <PaymentBadge item={item} />
                                        </div>
                                    </div>
                                    <PaymentDetails payment={item.payment!} />
                                </Card>
                            ))}
                        </TabsContent>

                        <TabsContent value="messages">
                            {isLoadingMessages ? <Skeleton /> : allMessages.length === 0 ? (
                                <Empty text="No messages have been sent to this contact." />
                            ) : (
                                <Card className="rounded-2xl border-border/50 divide-y divide-border/50 overflow-hidden">
                                    {allMessages.map((m) => <MessageRow key={m.id} m={m} showContest />)}
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="certificates" className="space-y-3">
                            {isLoadingHistory ? <Skeleton /> : certificates.length === 0 ? (
                                <Empty text="No certificates issued to this contact yet." />
                            ) : certificates.map((item) => (
                                <Card key={item.participantId} className="rounded-2xl border-border/50 p-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm">{item.contestTitle}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Generated {fmt(item.certificate!.generatedAt)}
                                            {item.certificate!.deliveredAt && ` · Delivered ${fmt(item.certificate!.deliveredAt)}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CertificateBadge certificate={item.certificate} />
                                        {item.certificate!.fileUrl && (
                                            <Button variant="outline" size="sm" className="rounded-lg" asChild>
                                                <a href={item.certificate!.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    <Download className="h-4 w-4 mr-1.5" /> Download
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {isMessageOpen && (
                <SendMessageModal open onOpenChange={setIsMessageOpen} contestId="" contactId={contact.id} />
            )}

            {/* Edit Contact Dialog */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Contact Information</DialogTitle>
                        <DialogDescription>
                            Update the institutional, personal, or location details for this user.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSave} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="college">Institutional Affiliation</Label>
                            <Combobox
                                options={collegeOptions}
                                value={selectedCollegeId}
                                onChange={handleCollegeSelect}
                                placeholder="Select college"
                                searchPlaceholder="Search colleges..."
                            />
                            {selectedCollegeId === OTHER_VALUE && (
                                <Input
                                    placeholder="Enter college name"
                                    value={formData.college}
                                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="department">Department</Label>
                            {selectedCollegeId && selectedCollegeId !== OTHER_VALUE ? (
                                <>
                                    <Combobox
                                        options={departmentOptions}
                                        value={selectedDepartmentId}
                                        onChange={handleDepartmentSelect}
                                        placeholder="Select department"
                                        searchPlaceholder="Search departments..."
                                    />
                                    {selectedDepartmentId === OTHER_VALUE && (
                                        <Input
                                            placeholder="Enter department"
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        />
                                    )}
                                </>
                            ) : (
                                <Input
                                    id="department"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="city">City</Label>
                                <Input
                                    id="city"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="state">State</Label>
                                <Input
                                    id="state"
                                    value={formData.state}
                                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setIsEditModalOpen(false)}
                                disabled={isUpdating}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isUpdating}>
                                {isUpdating ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" /> Are you absolutely sure?
                        </DialogTitle>
                        <DialogDescription>
                            This will permanently delete this contact and all their associated records. This action cannot be undone.
                            Please type <strong className="text-foreground">delete</strong> to confirm this action.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input 
                            placeholder="Type delete to confirm" 
                            value={deleteConfirmText} 
                            onChange={(e) => setDeleteConfirmText(e.target.value)} 
                        />
                    </div>
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            disabled={deleteConfirmText.toLowerCase() !== 'delete' || isDeleting}
                            onClick={handleDelete}
                        >
                            {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
            <p className={cn('text-sm font-medium break-words', !value && 'text-muted-foreground italic font-normal')}>
                {value || 'Not specified'}
            </p>
        </div>
    );
}

function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            title={`Copy ${label}`}
            aria-label={`Copy ${label}`}
            className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-secondary hover:text-foreground transition-colors"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    toast.success(`Copied ${label}`);
                    setTimeout(() => setCopied(false), 1500);
                } catch {
                    toast.error('Could not copy to clipboard');
                }
            }}
        >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
    );
}

function Skeleton() {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-secondary/30 animate-pulse" />)}</div>;
}

function Empty({ text }: { text: string }) {
    return (
        <Card className="rounded-2xl border-dashed border-border/60 h-40 flex items-center justify-center text-sm text-muted-foreground italic shadow-none">
            {text}
        </Card>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium break-words">{children}</dd>
        </div>
    );
}

function Panel({ icon: Icon, title, action, children }: { icon: React.ElementType; title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border/50 bg-background p-4 space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {title}
                </p>
                {action}
            </div>
            {children}
        </div>
    );
}

function PaymentDetails({ payment }: { payment: NonNullable<ContactHistoryItem['payment']> }) {
    return (
        <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3">
                <Field label="Amount">{formatInr(payment.amount)} {payment.currency !== 'INR' && payment.currency}</Field>
                <Field label="Paid at">{fmt(payment.paidAt)}</Field>
                <Field label="Order ID"><span className="font-mono text-xs">{payment.razorpayOrderId || '—'}</span></Field>
                <Field label="Payment ID"><span className="font-mono text-xs">{payment.razorpayPaymentId || '—'}</span></Field>
                <Field label="Attempts">{payment.attempts}</Field>
                <Field label="Started">{fmt(payment.createdAt)}</Field>
            </dl>
            {payment.failureReason && payment.status !== 'SUCCESS' && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {payment.failureReason}
                </p>
            )}
            {payment.orders.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Checkout attempts</p>
                    <div className="rounded-lg border border-border/50 divide-y divide-border/50 text-xs">
                        {payment.orders.map((o) => (
                            <div key={o.id} className="p-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                <span className="font-mono">{o.razorpayOrderId}</span>
                                <span className="text-muted-foreground">{fmt(o.createdAt)}</span>
                                <span className="text-muted-foreground">{o.method ?? ''}</span>
                                <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                                {(o.errorReason || o.failureReason) && (
                                    <span className="basis-full text-red-600 dark:text-red-400">{o.failureReason || o.errorReason}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function MessageRow({ m, showContest }: { m: ContactMessageItem; showContest?: boolean }) {
    return (
        <div className="p-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
            <div className="min-w-0 flex-1">
                <p className="font-semibold break-words">{m.subject || m.template.replace(/_/g, ' ')}</p>
                <p className="text-[11px] text-muted-foreground">
                    {m.channel} → {m.recipient}
                    {showContest && m.contestTitle && ` · ${m.contestTitle}`}
                </p>
                {m.status === 'FAILED' && m.failureReason && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">{m.failureReason}</p>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground">{fmt(m.sentAt ?? m.createdAt)}</span>
                <Badge className={cn('text-[10px] font-bold', MESSAGE_TONE[m.status] ?? 'bg-secondary text-muted-foreground')}>{m.status}</Badge>
            </div>
        </div>
    );
}

function ParticipationRow({ item, messages, open, onToggle }: { item: ContactHistoryItem; messages: ContactMessageItem[]; open: boolean; onToggle: () => void }) {
    const s = item.submission;
    const date = item.contestStartTime ?? item.registeredAt;
    return (
        <div>
            <div
                role="button"
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
                aria-expanded={open}
                className={cn(ROW_GRID, 'flex flex-col gap-3 px-5 py-4 cursor-pointer hover:bg-secondary/20 transition-colors', open && 'bg-secondary/20')}
            >
                <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight">{item.contestTitle}</p>
                    <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-1">
                        <Calendar className="h-3 w-3" /> {fmt(date, 'MMM d, yyyy')}
                        <span>·</span><span className="font-mono">{item.registrationRef}</span>
                    </p>
                </div>
                <div><ParticipantStatusBadge status={item.status} /></div>
                <div>
                    {s ? (
                        <div className="leading-tight">
                            <p className="text-sm font-black">{s.score} <span className="text-xs font-semibold text-muted-foreground">({s.percentage}%)</span></p>
                            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                <Trophy className="h-3 w-3 text-amber-500" /> {s.rank ? `Rank #${s.rank}` : 'Unranked'}
                            </p>
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground italic">No result</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <CertificateBadge certificate={item.certificate} />
                    {item.certificate?.fileUrl && (
                        <a
                            href={item.certificate.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download certificate"
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-secondary"
                        >
                            <Download className="h-3.5 w-3.5" />
                        </a>
                    )}
                </div>
                <div className="leading-tight space-y-1">
                    <PaymentBadge item={item} />
                    {!!item.contestPrice && (
                        <p className="text-[11px] text-muted-foreground">
                            {formatInr(item.payment?.amount ?? item.contestPrice)}
                            {item.payment?.paidAt && ` · ${fmt(item.payment.paidAt, 'MMM d')}`}
                        </p>
                    )}
                </div>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform justify-self-end', open && 'rotate-180')} />
            </div>

            {open && (
                <div className="border-t border-border/50 bg-secondary/10 p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Panel
                        icon={History}
                        title="Registration"
                        action={
                            <Link href={`/org/contests/${item.contestId}/registrations`} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                                Contest registrations <ExternalLink className="h-3 w-3" />
                            </Link>
                        }
                    >
                        <dl className="grid grid-cols-2 gap-3">
                            <Field label="Registered">{fmt(item.registeredAt)}</Field>
                            <Field label="Contest date">{fmt(item.contestStartTime)}</Field>
                            <Field label="Checked in">{fmt(item.checkedInAt)}</Field>
                            <Field label="Joined quiz">{fmt(item.joinedAt)}</Field>
                        </dl>
                        {item.disqualificationReason && (
                            <p className="text-xs text-red-600 dark:text-red-400">Disqualified: {item.disqualificationReason}</p>
                        )}
                    </Panel>

                    <Panel
                        icon={FileText}
                        title="Submission"
                        action={s && (
                            <Link href={`/org/contests/${item.contestId}/submissions?subId=${s.id}`} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                                View answers <ExternalLink className="h-3 w-3" />
                            </Link>
                        )}
                    >
                        {s ? (
                            <dl className="grid grid-cols-3 gap-3">
                                <Field label="Score">{s.score}</Field>
                                <Field label="Percent">{s.percentage}%</Field>
                                <Field label="Rank">{s.rank ? `#${s.rank}` : '—'}</Field>
                                <Field label="Correct">{s.correct ?? '—'}</Field>
                                <Field label="Wrong">{s.wrong ?? '—'}</Field>
                                <Field label="Skipped">{s.skipped ?? '—'}</Field>
                                <Field label="Attempted">{s.attempted ?? '—'}{s.totalQuestions ? ` / ${s.totalQuestions}` : ''}</Field>
                                <Field label="Time taken">{fmtDuration(s.timeTakenSecs)}</Field>
                                <Field label="Result">{s.isPassed == null ? s.status : s.isPassed ? 'Passed' : 'Not passed'}</Field>
                                <div className="col-span-3"><Field label="Submitted">{fmt(s.submittedAt)}</Field></div>
                            </dl>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No submission for this contest.</p>
                        )}
                    </Panel>

                    <Panel icon={CreditCard} title="Payment" action={<PaymentBadge item={item} />}>
                        {item.payment ? (
                            <PaymentDetails payment={item.payment} />
                        ) : (
                            <p className="text-sm text-muted-foreground italic">
                                {item.contestPrice ? `No payment started (fee ${formatInr(item.contestPrice)}).` : 'Free contest — no payment required.'}
                            </p>
                        )}
                    </Panel>

                    <Panel
                        icon={Award}
                        title="Certificate"
                        action={item.certificate?.fileUrl && (
                            <a href={item.certificate.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                                <Download className="h-3 w-3" /> Download
                            </a>
                        )}
                    >
                        <dl className="grid grid-cols-2 gap-3">
                            <Field label="Status"><CertificateBadge certificate={item.certificate} /></Field>
                            <Field label="Generated">{fmt(item.certificate?.generatedAt)}</Field>
                            <Field label="Delivered">{fmt(item.certificate?.deliveredAt)}</Field>
                        </dl>
                    </Panel>

                    <div className="lg:col-span-2">
                        <Panel icon={MessageSquare} title={`Messages (${messages.length})`}>
                            {messages.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No messages sent for this contest.</p>
                            ) : (
                                <div className="rounded-lg border border-border/50 divide-y divide-border/50 -mx-1">
                                    {messages.map((m) => <MessageRow key={m.id} m={m} />)}
                                </div>
                            )}
                        </Panel>
                    </div>
                </div>
            )}
        </div>
    );
}
