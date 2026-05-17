import type { ApiResponse, Registration } from '@/lib/types';
import { registrationService } from './registration-service';
import { MockDB } from '@/lib/mock/db';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Session token storage key
const SESSION_KEY = 'quizcraft_session';

interface SessionData {
  participantId: string;
  contestId: string;
  token: string;
  deviceId: string;
  expiresAt: string;
}

interface OTPSendResponse {
  sent: boolean;
  maskedContact: string;
  expiresIn: number;
}

interface OTPVerifyResponse {
  sessionToken: string;
  registration: Registration;
  deviceId: string;
}

class AuthService {
  private otpStore: Map<string, { otp: string; expiresAt: Date; attempts: number }> = new Map();
  
  // Generate device ID
  private getDeviceId(): string {
    let deviceId = typeof window !== 'undefined' ? localStorage.getItem('quizcraft_device_id') : null;
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('quizcraft_device_id', deviceId);
      }
    }
    return deviceId;
  }

  // Mask phone/email for display
  private maskPhone(phone: string): string {
    if (phone.length < 4) return '****';
    return phone.slice(0, 3) + '*'.repeat(phone.length - 6) + phone.slice(-3);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '****';
    const maskedLocal = local.slice(0, 2) + '*'.repeat(Math.max(0, local.length - 2));
    return `${maskedLocal}@${domain}`;
  }

  // Send OTP to phone or email
  async sendOTP(
    contact: string,
    contactType: 'phone' | 'email',
    contestId: string
  ): Promise<ApiResponse<OTPSendResponse>> {
    await delay(400);

    // In seed mode, always use "123456" as OTP
    const otp = '123456';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP
    const key = `${contact}-${contestId}`;
    this.otpStore.set(key, { otp, expiresAt, attempts: 0 });

    const maskedContact = contactType === 'phone' 
      ? this.maskPhone(contact) 
      : this.maskEmail(contact);

    return {
      success: true,
      data: {
        sent: true,
        maskedContact,
        expiresIn: 60 // seconds for resend timer
      },
      message: `OTP sent to ${maskedContact}`
    };
  }

  // Verify OTP and create session
  async verifyOTP(
    contact: string,
    contactType: 'phone' | 'email',
    otp: string,
    contestId: string
  ): Promise<ApiResponse<OTPVerifyResponse>> {
    await delay(300);

    const key = `${contact}-${contestId}`;
    const stored = this.otpStore.get(key);

    // Validate OTP format
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return {
        success: false,
        error: 'INVALID_OTP_FORMAT'
      };
    }

    // Check if OTP exists
    if (!stored) {
      return {
        success: false,
        error: 'OTP_NOT_FOUND'
      };
    }

    // Check if expired
    if (new Date() > stored.expiresAt) {
      this.otpStore.delete(key);
      return {
        success: false,
        error: 'OTP_EXPIRED'
      };
    }

    // Check attempts
    if (stored.attempts >= 3) {
      this.otpStore.delete(key);
      return {
        success: false,
        error: 'MAX_ATTEMPTS_EXCEEDED'
      };
    }

    // Normalize OTP
    const cleanOtp = otp.trim();

    // Verify OTP (in seed mode, accept "123456" always)
    const isValid = cleanOtp === '123456' || (stored && cleanOtp === stored.otp);

    if (!isValid) {
      if (stored) stored.attempts++;
      return {
        success: false,
        error: 'INCORRECT_OTP',
        message: `Incorrect OTP. ${stored ? 3 - stored.attempts : 3} attempts remaining.`
      };
    }

    // Find registration by contact
    // For demo, we'll lookup by phone or email in all registrations
    const registrations = await this.findRegistrationByContact(contact, contactType, contestId);
    
    if (!registrations.success || !registrations.data) {
      return {
        success: false,
        error: 'NOT_REGISTERED',
        message: 'This phone/email is not registered for this contest.'
      };
    }

    // Clear OTP
    this.otpStore.delete(key);

    // Generate session token
    const deviceId = this.getDeviceId();
    const sessionToken = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
    
    // Store session
    const sessionData: SessionData = {
      participantId: registrations.data.participantId,
      contestId,
      token: sessionToken,
      deviceId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    }

    return {
      success: true,
      data: {
        sessionToken,
        registration: registrations.data,
        deviceId
      }
    };
  }

  // Helper to find registration by contact
  private async findRegistrationByContact(
    contact: string,
    contactType: 'phone' | 'email',
    contestId: string
  ): Promise<ApiResponse<Registration>> {
    // Use MockDB for registrations
    const registrations = MockDB.registrations;

    const registration = registrations.find(r => {
      if (r.contestId !== contestId) return false;
      if (contactType === 'phone') {
        return r.participantDetails.phone === contact || 
               r.participantDetails.phone.replace(/\D/g, '') === contact.replace(/\D/g, '');
      }
      return r.participantDetails.email.toLowerCase() === contact.toLowerCase();
    });

    if (!registration) {
      return { success: false, error: 'NOT_REGISTERED' };
    }

    return { success: true, data: registration };
  }

  // Get current session
  getSession(): SessionData | null {
    if (typeof window === 'undefined') return null;
    const data = sessionStorage.getItem(SESSION_KEY);
    if (!data) return null;
    
    try {
      const session = JSON.parse(data) as SessionData;
      if (new Date(session.expiresAt) < new Date()) {
        this.clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  // Clear session
  clearSession(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  // Check for session conflict (another device)
  async checkSessionConflict(
    participantId: string,
    contestId: string
  ): Promise<ApiResponse<{ hasConflict: boolean; currentDeviceId?: string }>> {
    await delay(100);
    
    // In a real app, this would check with the server
    // For seed mode, we'll simulate no conflict
    return {
      success: true,
      data: { hasConflict: false }
    };
  }

  // Force session on this device (override other sessions)
  async forceSession(
    participantId: string,
    contestId: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    await delay(200);
    
    // In a real app, this would invalidate other sessions on the server
    return {
      success: true,
      data: { success: true }
    };
  }
}

export const authService = new AuthService();
