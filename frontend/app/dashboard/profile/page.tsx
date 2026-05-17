'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useParticipantProfile } from '@/lib/hooks/useParticipantProfile';
import { FileUpload } from '@/components/features/shared/FileUpload';

const PARTICIPANT_ID = 'QZCP12345ABC';

export default function ProfilePage() {
  const { profile, loading, updateProfile, updateNotifications, uploadAvatar } =
    useParticipantProfile(PARTICIPANT_ID);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    fullName: profile?.fullName || '',
    phone: profile?.phone || '',
    bio: profile?.bio || '',
    linkedin: profile?.socialLinks?.linkedin || '',
    twitter: profile?.socialLinks?.twitter || '',
    github: profile?.socialLinks?.github || '',
  });

  const [notifications, setNotifications] = useState<{
    emailReminders: boolean;
    whatsappReminders: boolean;
    emailResults: boolean;
  }>({
    emailReminders: profile?.notificationPreferences?.emailReminders ?? true,
    whatsappReminders: profile?.notificationPreferences?.whatsappReminders ?? true,
    emailResults: profile?.notificationPreferences?.emailResults ?? true,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const result = await updateProfile({
        fullName: formData.fullName,
        phone: formData.phone,
        bio: formData.bio,
        socialLinks: {
          linkedin: formData.linkedin,
          twitter: formData.twitter,
          github: formData.github,
        },
      });

      if (result) {
        toast.success('Profile updated successfully');
      } else {
        toast.error('Failed to update profile');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      const result = await updateNotifications(notifications);
      if (result) {
        toast.success('Notification preferences updated');
      } else {
        toast.error('Failed to update preferences');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File, preview: string) => {
    setIsSaving(true);
    try {
      const result = await uploadAvatar(preview);
      if (result) {
        toast.success('Avatar updated successfully');
      } else {
        toast.error('Failed to upload avatar');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Manage your profile information and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="social">Social Links</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your basic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-4 block">Profile Picture</Label>
                <FileUpload
                  label="Avatar"
                  onFileSelect={handleAvatarUpload}
                  accept="image/*"
                  maxSizeMB={2}
                  preview={profile?.avatar}
                  helperText="Recommended: Square image, max 2MB"
                />
              </div>

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={4}
                  />
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Links Tab */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Social Links</CardTitle>
              <CardDescription>Connect your social media profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="linkedin">LinkedIn Profile</Label>
                <Input
                  id="linkedin"
                  type="url"
                  placeholder="https://linkedin.com/in/yourname"
                  value={formData.linkedin}
                  onChange={(e) => handleInputChange('linkedin', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="twitter">Twitter/X Profile</Label>
                <Input
                  id="twitter"
                  type="url"
                  placeholder="https://twitter.com/yourname"
                  value={formData.twitter}
                  onChange={(e) => handleInputChange('twitter', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="github">GitHub Profile</Label>
                <Input
                  id="github"
                  type="url"
                  placeholder="https://github.com/yourname"
                  value={formData.github}
                  onChange={(e) => handleInputChange('github', e.target.value)}
                />
              </div>

              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Links'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to receive updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.emailReminders}
                    onChange={(e) =>
                      setNotifications(prev => ({
                        ...prev,
                        emailReminders: e.target.checked,
                      }))
                    }
                  />
                  <div>
                    <p className="font-medium text-sm">Email Reminders</p>
                    <p className="text-xs text-muted-foreground">
                      Get email reminders for upcoming contests
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.whatsappReminders}
                    onChange={(e) =>
                      setNotifications(prev => ({
                        ...prev,
                        whatsappReminders: e.target.checked,
                      }))
                    }
                  />
                  <div>
                    <p className="font-medium text-sm">WhatsApp Reminders</p>
                    <p className="text-xs text-muted-foreground">
                      Get WhatsApp messages for contest updates
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications.emailResults}
                    onChange={(e) =>
                      setNotifications(prev => ({
                        ...prev,
                        emailResults: e.target.checked,
                      }))
                    }
                  />
                  <div>
                    <p className="font-medium text-sm">Email Results</p>
                    <p className="text-xs text-muted-foreground">
                      Get your results via email when published
                    </p>
                  </div>
                </label>
              </div>

              <Button onClick={handleSaveNotifications} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
