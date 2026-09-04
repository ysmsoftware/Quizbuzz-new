'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { uploadOrgLogo } from '@/lib/api/organization.api';

interface GeneralSettingsTabContentProps {
    orgId: string;
    formData: {
        orgName: string;
        logoUrl: string;
    };
    org: {
        name?: string | null;
        slug: string;
        logoUrl?: string | null;
    };
    admin?: {
        firstName: string;
        lastName: string;
        email: string;
    } | null;
    isSaving: boolean;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onLogoChange: (logoUrl: string | null) => void;
    handleSaveGeneral: (e: React.FormEvent) => void;
}

export function GeneralSettingsTabContent({
    orgId,
    formData,
    org,
    admin,
    isSaving,
    handleInputChange,
    onLogoChange,
    handleSaveGeneral,
}: GeneralSettingsTabContentProps) {
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    const handleLogoSelect = async (file: File, preview: string) => {
        setIsUploadingLogo(true);
        try {
            const res = await uploadOrgLogo(orgId, { fileData: preview, fileName: file.name });
            onLogoChange(res.data.url);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to upload logo');
        } finally {
            setIsUploadingLogo(false);
        }
    };
    return (
        <div className="space-y-6">
            <form onSubmit={handleSaveGeneral} className="space-y-6">
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle>Organization Settings</CardTitle>
                        <CardDescription>Manage your workspace details and branding metadata</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4">
                            <div>
                                <label className="text-sm font-medium text-foreground">Organization Name</label>
                                <Input
                                    name="orgName"
                                    value={formData.orgName}
                                    onChange={handleInputChange}
                                    placeholder="Your organization name"
                                    className="mt-2"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-foreground flex justify-between">
                                    <span>Workspace URL Slug</span>
                                    <span className="text-xs text-muted-foreground font-normal">Read-only</span>
                                </label>
                                <div className="mt-2 flex items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                    <span className="select-none text-muted-foreground/60 pr-1">ysmquizbuzz.com/org/</span>
                                    <span className="font-semibold text-foreground">{org.slug}</span>
                                </div>
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                    The workspace slug is established during registration and cannot be modified.
                                </p>
                            </div>

                            <div>
                                <FileUpload
                                    label="Organization Logo"
                                    aspectRatio="square"
                                    maxSizeMB={2}
                                    helperText="PNG, JPG or SVG · square image recommended · up to 2MB. Shown on certificates and anywhere your branding appears."
                                    preview={formData.logoUrl || null}
                                    onFileSelect={handleLogoSelect}
                                    onClear={() => onLogoChange(null)}
                                />
                                {isUploadingLogo && (
                                    <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={isSaving} className="gap-2">
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>

            {/* Admin Profile Details Card */}
            {admin && (
                <Card className="border-border/50 bg-secondary/10">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-primary">
                            <ShieldCheck className="h-5 w-5" />
                            <CardTitle className="text-lg font-bold">Admin Profile Account</CardTitle>
                        </div>
                        <CardDescription>Details of the authenticated user currently managing this workspace</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg border bg-background/50">
                                <span className="text-xs font-medium text-muted-foreground block">Admin User</span>
                                <span className="text-sm font-semibold text-foreground block mt-1">
                                    {admin.firstName} {admin.lastName}
                                </span>
                            </div>
                            <div className="p-3 rounded-lg border bg-background/50">
                                <span className="text-xs font-medium text-muted-foreground block">Email Address</span>
                                <span className="text-sm font-semibold text-foreground block mt-1">
                                    {admin.email}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default GeneralSettingsTabContent;
