'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useContact } from '@/lib/hooks/useContact';
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
    MessageSquare,
    Award,
    Download,
    AlertCircle
} from 'lucide-react';
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
import { SectionErrorBoundary } from '@/components/admin/contacts/section-error-boundary';

export default function ContactProfilePage() {
    const { id: contactId } = useParams() as { id: string };
    const router = useRouter();

    // Centralized contact queries through useContact hook
    const {
        contact,
        isLoadingContact,
        history,
        isLoadingHistory,
        updateContact,
        isUpdating,
        deleteContact,
        isDeleting,
    } = useContact(contactId, { loadHistory: true });

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        college: '',
        city: '',
        state: '',
    });

    useEffect(() => {
        if (contact) {
            setFormData({
                firstName: contact.firstName || '',
                lastName: contact.lastName || '',
                email: contact.email || '',
                phone: contact.phone || '',
                college: contact.college || '',
                city: contact.city || '',
                state: contact.state || '',
            });
        }
    }, [contact]);

    if (isLoadingContact) {
        return <div className="p-8 flex items-center justify-center">Loading profile...</div>;
    }

    if (!contact) {
        return <div className="p-8 text-center text-muted-foreground">Contact not found.</div>;
    }

    // Helper function to get payment badge
    const getPaymentBadge = (item: any) => {
        // If contest is free, show FREE badge
        if (!item.contestPrice || item.contestPrice === 0) {
            return (
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                    <ShieldCheck className="h-3 w-3" /> FREE
                </Badge>
            );
        }

        const paymentStatus = item.payment?.status?.toUpperCase() || 'PENDING';

        // If paid contest, check payment status
        if (paymentStatus === 'SUCCESS' || paymentStatus === 'PAID') {
            return (
                <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                    <ShieldCheck className="h-3 w-3" /> PAID
                </Badge>
            );
        }

        // Pending or failed payment
        return (
            <Badge variant="destructive" className="gap-1 px-2 py-0.5 text-[10px] font-bold">
                <Activity className="h-3 w-3" /> {paymentStatus}
            </Badge>
        );
    };

    // Helper function to get certificate badge
    const getCertificateBadge = (certificate: any) => {
        if (!certificate) {
            return (
                <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[10px] font-bold">
                    <AlertCircle className="h-3 w-3" /> Not Issued
                </Badge>
            );
        }

        const certStatus = certificate.status?.toUpperCase() || 'NOT_ISSUED';

        switch (certStatus) {
            case 'GENERATED':
            case 'ISSUED':
                return (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                        <Award className="h-3 w-3" /> Generated
                    </Badge>
                );
            case 'FAILED':
                return (
                    <Badge variant="destructive" className="gap-1 px-2 py-0.5 text-[10px] font-bold">
                        <AlertCircle className="h-3 w-3" /> Failed
                    </Badge>
                );
            case 'QUEUED':
            case 'GENERATING':
                return (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                        <Activity className="h-3 w-3 animate-spin" /> Processing
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[10px] font-bold">
                        {certStatus}
                    </Badge>
                );
        }
    };

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
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto w-full">
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
                <div className="space-y-8 max-w-md mx-auto lg:max-w-none w-full">
                    <SectionErrorBoundary sectionTitle="Contact Profile">
                        <Card className="bg-background/50 border-border/50 rounded-4xl overflow-hidden shadow-sm">
                            <CardHeader className="p-8 pb-0 text-center">
                                <div className="h-24 w-24 rounded-[2.5rem] bg-primary/10 mx-auto flex items-center justify-center text-2xl font-black text-primary shadow-2xl shadow-primary/10 mb-6">
                                    {(contact.firstName?.[0] || '').toUpperCase()}{(contact.lastName?.[0] || '').toUpperCase()}
                                </div>
                                <CardTitle className="text-2xl font-black">{contact.firstName} {contact.lastName}</CardTitle>
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
                                            <p className="text-sm font-medium">
                                                {[contact.city, contact.state].filter(Boolean).join(', ') || 'Not Specified'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-border/50 space-y-3">
                                    <Button 
                                        className="w-full rounded-xl h-12 bg-primary font-bold shadow-lg shadow-primary/20"
                                        onClick={() => setIsEditModalOpen(true)}
                                    >
                                        Edit Information
                                    </Button>
                                    <Button variant="outline" className="w-full rounded-xl h-12 border-border/50 font-bold group">
                                        <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
                                        Send Private Message
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        className="w-full rounded-xl h-12 text-destructive hover:text-destructive hover:bg-destructive/10 font-bold"
                                        onClick={() => {
                                            setDeleteConfirmText('');
                                            setIsDeleteModalOpen(true);
                                        }}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? 'Deleting...' : 'Delete Contact'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </SectionErrorBoundary>

                    {/* Quick Stats */}
                    <SectionErrorBoundary sectionTitle="Quick Stats">
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="bg-secondary/20 border-border/50 rounded-2xl p-6">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Contests</p>
                                <p className="text-3xl font-black">{history?.length || 0}</p>
                            </Card>
                            <Card className="bg-secondary/20 border-border/50 rounded-2xl p-6">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Success Rate</p>
                                <p className="text-3xl font-black text-green-500">
                                    {history && history.length > 0
                                        ? Math.round((history.filter(h => h.submission && parseFloat(h.submission.percentage) >= 60).length / history.length) * 100)
                                        : 0}%
                                </p>
                            </Card>
                        </div>
                    </SectionErrorBoundary>
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

                    <SectionErrorBoundary sectionTitle="Participation History">
                        <Card className="bg-background/50 border-border/50 rounded-4xl overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-secondary/50">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="font-bold h-14 pl-8">Contest</TableHead>
                                        <TableHead className="font-bold">Status</TableHead>
                                        <TableHead className="font-bold text-center">Result</TableHead>
                                        <TableHead className="font-bold text-center">Certificate</TableHead>
                                        <TableHead className="font-bold text-center">Payment</TableHead>
                                        <TableHead className="font-bold text-right pr-8">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingHistory ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <TableRow key={i} className="animate-pulse">
                                                <TableCell colSpan={6} className="h-20 bg-secondary/10" />
                                            </TableRow>
                                        ))
                                    ) : history?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                                                No participation records found for this contact.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        history?.map((item) => (
                                            <TableRow key={item.participantId} className="hover:bg-secondary/20 transition-colors group border-border/20">
                                                <TableCell className="pl-8">
                                                    <div>
                                                        <p className="font-bold text-sm leading-tight mb-1">{item.contestTitle}</p>
                                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
                                                            <Calendar className="h-3 w-3" />
                                                            {format(new Date(item.registeredAt), 'MMM dd, yyyy')} • {item.registrationRef}
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
                                                    {getCertificateBadge(item.certificate)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {getPaymentBadge(item)}
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {item.certificate?.fileUrl && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-9 w-9 rounded-lg hover:bg-muted hover:text-foreground cursor-pointer"
                                                                asChild
                                                            >
                                                                <a href={item.certificate.fileUrl} target="_blank" rel="noopener noreferrer" title="Download Certificate">
                                                                    <Download className="h-4 w-4" />
                                                                </a>
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" asChild>
                                                            <Link href={`/org/contests/${item.contestId}/registrations`} title="View Registration Details">
                                                                <ArrowRight className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </SectionErrorBoundary>
                </div>
            </div>

            {/* Edit Contact Dialog */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="max-w-md">
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
                            <Input
                                id="college"
                                value={formData.college}
                                onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                            />
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
