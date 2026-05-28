import { ParticipantProfile, ApiResponse } from '@/lib/types';

class ParticipantService {
  async getProfile(participantId: string): Promise<ApiResponse<ParticipantProfile>> {
    return {
      success: true,
      data: {
        id: 'profile-empty',
        participantId,
        fullName: 'Participant',
        email: 'participant@example.com',
        phone: '',
        notificationPreferences: { emailReminders: false, whatsappReminders: false, emailResults: false },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      message: 'Profile retrieved',
    };
  }

  async updateProfile(participantId: string, updates: Partial<ParticipantProfile>): Promise<ApiResponse<ParticipantProfile>> {
    return { success: true, data: updates as ParticipantProfile, message: 'Profile updated successfully' };
  }

  async updateNotificationPreferences(participantId: string, preferences: ParticipantProfile['notificationPreferences']): Promise<ApiResponse<ParticipantProfile>> {
    return { success: true, data: { notificationPreferences: preferences } as ParticipantProfile, message: 'Notification preferences updated' };
  }

  async uploadAvatar(participantId: string, imageUrl: string): Promise<ApiResponse<ParticipantProfile>> {
    return { success: true, data: { avatar: imageUrl } as ParticipantProfile, message: 'Avatar updated successfully' };
  }
}

export const participantService = new ParticipantService();
