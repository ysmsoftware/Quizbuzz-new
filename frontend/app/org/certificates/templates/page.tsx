'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    useCertificateTemplates,
    useDeleteCertificateTemplate,
} from '@/lib/hooks/useCertificateTemplates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Award, ChevronLeft, Plus, Edit2, Trash2, MoreVertical, FlaskConical } from 'lucide-react';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { CertificateTemplateModal } from '@/components/features/certificates/CertificateTemplateModal';
import { TestGenerateDialog } from '@/components/features/certificates/TestGenerateDialog';

export default function CertificateTemplatesPage() {
    const { data: templates = [], isLoading } = useCertificateTemplates();
    const deleteMutation = useDeleteCertificateTemplate();

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Delete dialog state
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Test-generate dialog state
    const [testGenerateId, setTestGenerateId] = useState<string | null>(null);

    const handleOpenCreate = () => {
        setEditingId(null);
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (id: string) => {
        setEditingId(id);
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        await deleteMutation.mutateAsync(deleteId);
        setDeleteId(null);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="inline-block">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                    <p className="text-muted-foreground">Loading certificate templates...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-primary">
                        <Award className="h-6 w-6" />
                        <h1 className="text-3xl font-bold">Certificate Template Library</h1>
                    </div>
                    <p className="text-muted-foreground max-w-2xl">
                        Upload and manage custom HTML certificate templates for your organization. Saved templates can be selected when issuing certificates for any contest.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" asChild className="rounded-xl h-11">
                        <Link href="/org/certificates">
                            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Certificates
                        </Link>
                    </Button>
                    <Button onClick={handleOpenCreate} className="rounded-xl h-11 bg-primary text-primary-foreground gap-2">
                        <Plus className="h-4 w-4" /> New Template
                    </Button>
                </div>
            </div>

            <WidgetErrorBoundary name="Certificate Templates Table">
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="h-5 w-5" />
                            Saved Templates ({templates.length})
                        </CardTitle>
                        <CardDescription>
                            All custom certificate templates owned by your organization.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {templates.length === 0 ? (
                            <div className="text-center py-12">
                                <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                                <p className="text-muted-foreground mb-4">No custom templates uploaded yet.</p>
                                <Button onClick={handleOpenCreate} className="gap-2">
                                    <Plus className="h-4 w-4" /> Create your first template
                                </Button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[25%] font-semibold">Template Name</TableHead>
                                            <TableHead className="w-[50%] font-semibold">Detected Variables</TableHead>
                                            <TableHead className="w-[15%] font-semibold">Updated</TableHead>
                                            <TableHead className="w-[10%] text-right font-semibold">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {templates.map((tpl) => (
                                            <TableRow key={tpl.id}>
                                                <TableCell className="font-medium">
                                                    <div className="font-semibold text-foreground">{tpl.name}</div>
                                                    {tpl.description && (
                                                        <div className="text-xs font-normal text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">
                                                            {tpl.description}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {tpl.variables.length === 0 ? (
                                                            <span className="text-xs text-muted-foreground">None</span>
                                                        ) : (
                                                            tpl.variables.map((v) => (
                                                                <Badge key={v} variant="secondary" className="text-xs font-mono">
                                                                    {`{{${v}}}`}
                                                                </Badge>
                                                            ))
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {new Date(tpl.updatedAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                                                <MoreVertical className="h-4 w-4" />
                                                                <span className="sr-only">Actions</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem onClick={() => handleOpenEdit(tpl.id)} className="gap-2 cursor-pointer">
                                                                <Edit2 className="h-4 w-4 text-muted-foreground" /> Edit Template
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => setTestGenerateId(tpl.id)} className="gap-2 cursor-pointer">
                                                                <FlaskConical className="h-4 w-4 text-muted-foreground" /> Test Generate PDF
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => setDeleteId(tpl.id)} className="gap-2 text-destructive focus:text-destructive cursor-pointer">
                                                                <Trash2 className="h-4 w-4" /> Delete Template
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </WidgetErrorBoundary>

            {/* Reusable Certificate Template Modal Component */}
            <CertificateTemplateModal
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                editingId={editingId}
            />

            {/* Test Generate PDF Dialog — runs the real queue/worker/Puppeteer pipeline */}
            <TestGenerateDialog
                open={!!testGenerateId}
                onOpenChange={(open) => { if (!open) setTestGenerateId(null); }}
                templateId={testGenerateId}
                templateName={templates.find((t) => t.id === testGenerateId)?.name}
            />

            {/* Delete Alert Dialog */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Certificate Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this custom template? This action cannot be undone. Certificates previously issued using this template will retain their generated PDFs.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
