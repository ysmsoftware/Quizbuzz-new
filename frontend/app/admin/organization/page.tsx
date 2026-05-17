'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { ColorPicker } from '@/components/features/shared/ColorPicker';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { MaskedInput } from '@/components/features/shared/MaskedInput';

export default function OrganizationSettingsPage() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id || '';
  const { org, loading, error, updateOrgMutation } = useOrganization(orgId);
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    website: '',
    industry: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    razorpayKeyId: '',
    razorpayKeySecret: '',
    testMode: false,
    aisensynAPIKey: '',
    whatsappNumber: '',
  });

  // Sync form data when org is loaded
  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || '',
        slug: org.slug || '',
        description: org.description || '',
        website: org.website || '',
        industry: org.industry || '',
        primaryColor: org.primaryColor || '#3B82F6',
        secondaryColor: org.secondaryColor || '#10B981',
        razorpayKeyId: org.razorpayKeyId || '',
        razorpayKeySecret: org.razorpayKeySecret || '',
        testMode: org.testMode || false,
        aisensynAPIKey: org.aisensynAPIKey || '',
        whatsappNumber: org.whatsappNumber || '',
      });
    }
  }, [org]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (tab: string) => {
    setIsSaving(true);
    try {
      const updates = {
        ...(tab === 'general' && {
          name: formData.name,
          description: formData.description,
          website: formData.website,
          industry: formData.industry,
        }),
        ...(tab === 'branding' && {
          primaryColor: formData.primaryColor,
          secondaryColor: formData.secondaryColor,
        }),
        ...(tab === 'payment' && {
          razorpayKeyId: formData.razorpayKeyId,
          razorpayKeySecret: formData.razorpayKeySecret,
          testMode: formData.testMode,
        }),
        ...(tab === 'notifications' && {
          aisensynAPIKey: formData.aisensynAPIKey,
          whatsappNumber: formData.whatsappNumber,
        }),
      };

      await updateOrgMutation.mutateAsync(updates);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('An error occurred while saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!org) {
    return <div>Organization not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">Manage your organization configuration</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="danger">Danger</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic organization information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug (Read-only)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={() => handleSave('general')}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Customize your organization's appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-4 block">Logo</Label>
                <FileUpload
                  label="Organization Logo"
                  onFileSelect={(file, preview) => {
                    console.log('[v0] Logo selected:', file.name);
                  }}
                  accept="image/*"
                  maxSizeMB={2}
                  helperText="Recommended: 200x200px, max 2MB"
                />
              </div>

              <div>
                <Label className="mb-4 block">Favicon</Label>
                <FileUpload
                  label="Favicon"
                  onFileSelect={(file, preview) => {
                    console.log('[v0] Favicon selected:', file.name);
                  }}
                  accept="image/*"
                  maxSizeMB={1}
                  helperText="Recommended: 32x32px, max 1MB"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <ColorPicker
                  label="Primary Color"
                  value={formData.primaryColor}
                  onChange={(color) => handleInputChange('primaryColor', color)}
                />
                <ColorPicker
                  label="Secondary Color"
                  value={formData.secondaryColor}
                  onChange={(color) => handleInputChange('secondaryColor', color)}
                />
              </div>

              <Button
                onClick={() => handleSave('branding')}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
              <CardDescription>Configure Razorpay integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.testMode}
                    onChange={(e) => handleInputChange('testMode', e.target.checked)}
                  />
                  <span className="text-sm font-medium">Enable Test Mode</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Use test credentials for development
                </p>
              </div>

              <MaskedInput
                label="Razorpay Key ID"
                value={formData.razorpayKeyId}
                onChange={(value) => handleInputChange('razorpayKeyId', value)}
                placeholder="Enter your Razorpay Key ID"
                helperText="Your API Key ID (will be masked)"
              />

              <MaskedInput
                label="Razorpay Key Secret"
                value={formData.razorpayKeySecret}
                onChange={(value) => handleInputChange('razorpayKeySecret', value)}
                placeholder="Enter your Razorpay Key Secret"
                helperText="Your API Key Secret (will be masked)"
              />

              <Button
                onClick={() => handleSave('payment')}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure messaging integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MaskedInput
                label="Aisensy API Key"
                value={formData.aisensynAPIKey}
                onChange={(value) => handleInputChange('aisensynAPIKey', value)}
                placeholder="Enter your Aisensy API Key"
                helperText="For WhatsApp messaging integration"
              />

              <div>
                <Label htmlFor="whatsapp">WhatsApp Business Number</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsappNumber}
                  onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                  placeholder="+91 9876543210"
                />
              </div>

              <Button
                onClick={() => handleSave('notifications')}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone */}
        <TabsContent value="danger" className="space-y-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  These actions cannot be undone. Please proceed with caution.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Delete Organization</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete this organization and all associated data.
                  </p>
                  <Button variant="destructive">Delete Organization</Button>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Transfer Ownership</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Transfer ownership to another team member.
                  </p>
                  <Button variant="outline">Transfer Ownership</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
