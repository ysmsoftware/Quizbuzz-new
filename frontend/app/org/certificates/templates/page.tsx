'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    useCertificateTemplates,
    useDeleteCertificateTemplate,
} from '@/lib/hooks/useCertificateTemplates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CertificateTemplateThumbnail } from '@/components/features/certificates/CertificateTemplateThumbnail';
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
                        {templates.length === 0 && (
                            <p className="text-sm text-muted-foreground mb-4">
                                No custom templates uploaded yet — click the tile below to create your first one.
                            </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {/* Always-present "Add New Template" tile — first row, first column */}
                            <button
                                type="button"
                                onClick={handleOpenCreate}
                                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all duration-200 min-h-[220px] text-muted-foreground hover:text-primary cursor-pointer"
                            >
                                <div className="h-11 w-11 rounded-full bg-background border border-border/70 flex items-center justify-center">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <span className="text-sm font-medium">Add New Template</span>
                            </button>

                            {templates.map((tpl) => (
                                <div
                                    key={tpl.id}
                                    className="group flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-200"
                                >
                                    {/* Certificate preview thumbnail */}
                                    <button
                                        type="button"
                                        onClick={() => handleOpenEdit(tpl.id)}
                                        className="block p-3 pb-0 text-left cursor-pointer"
                                        title="Click to edit this template"
                                    >
                                        <CertificateTemplateThumbnail templateId={tpl.id} />
                                    </button>

                                    {/* Card body */}
                                    <div className="flex flex-1 flex-col gap-2.5 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-semibold text-sm text-foreground truncate" title={tpl.name}>
                                                    {tpl.name}
                                                </h3>
                                                {tpl.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                                        {tpl.description}
                                                    </p>
                                                )}
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-lg">
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
                                        </div>

                                        <div className="mt-auto pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                                            Updated {new Date(tpl.updatedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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
