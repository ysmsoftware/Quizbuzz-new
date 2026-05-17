import { ParticipantProfile, ApiResponse } from '@/lib/types';
import { MockDB } from '@/lib/mock/db';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ParticipantService {
  private get profiles(): ParticipantProfile[] {
    // Safely access contacts - fallback to empty array if undefined
    const contacts = MockDB?.contacts || [];
    
    if (contacts.length === 0) {
      // Return default profiles if no contacts available
      return this._profiles;
    }

    return contacts.map((c, i) => ({
      id: `profile-${String(i + 1).padStart(3, '0')}`,
      participantId: `PART-${c?.id?.split('-')?.[1] || String(i + 1)}`,
      fullName: c?.fullName || `Participant ${i + 1}`,
      email: c?.email || `participant${i + 1}@example.com`,
      phone: c?.phone || `+91 98000000${String(i + 1).padStart(2, '0')}`,
      notificationPreferences: {
        emailReminders: true,
        whatsappReminders: true,
        emailResults: true,
      },
      createdAt: c?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  private _profiles: ParticipantProfile[] = [
    {
      id: 'profile-001',
      participantId: 'QZCP12345ABC',
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+91 9876543210',
      avatar: '/images/avatar.jpg',
      bio: 'Passionate about competitive exams',
      socialLinks: {
        linkedin: 'https://linkedin.com/in/johndoe',
        twitter: 'https://twitter.com/johndoe',
      },
      notificationPreferences: {
        emailReminders: true,
        whatsappReminders: true,
        emailResults: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  async getProfile(participantId: string): Promise<ApiResponse<ParticipantProfile>> {
    await delay(300);
    const profile = this.profiles.find(p => p.participantId === participantId);
    return {
      success: !!profile,
      data: profile,
      message: profile ? 'Profile found' : 'Profile not found',
    };
  }

  async updateProfile(participantId: string, updates: Partial<ParticipantProfile>): Promise<ApiResponse<ParticipantProfile>> {
    await delay(500);
    const profile = this.profiles.find(p => p.participantId === participantId);
    
    if (!profile) {
      return { success: false, message: 'Profile not found' };
    }

    const updated = {
      ...profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const index = this.profiles.indexOf(profile);
    this.profiles[index] = updated;

    return {
      success: true,
      data: updated,
      message: 'Profile updated successfully',
    };
  }

  async updateNotificationPreferences(
    participantId: string,
    preferences: ParticipantProfile['notificationPreferences']
  ): Promise<ApiResponse<ParticipantProfile>> {
    await delay(400);
    
    const profile = this.profiles.find(p => p.participantId === participantId);
    if (!profile) {
      return { success: false, message: 'Profile not found' };
    }

    profile.notificationPreferences = preferences;
    profile.updatedAt = new Date().toISOString();

    return {
      success: true,
      data: profile,
      message: 'Notification preferences updated',
    };
  }

  async uploadAvatar(participantId: string, imageUrl: string): Promise<ApiResponse<ParticipantProfile>> {
    await delay(800);
    
    const profile = this.profiles.find(p => p.participantId === participantId);
    if (!profile) {
      return { success: false, message: 'Profile not found' };
    }

    profile.avatar = imageUrl;
    profile.updatedAt = new Date().toISOString();

    return {
      success: true,
      data: profile,
      message: 'Avatar updated successfully',
    };
  }
}

export const participantService = new ParticipantService();
