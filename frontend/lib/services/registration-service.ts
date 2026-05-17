import type { Registration, RegistrationFormData, ApiResponse } from '@/lib/types';
import { MockDB } from '@/lib/mock/db';
import { getRegistrationsForContest } from '@/lib/mock/relations';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const generateParticipantId = () => `QZCP${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

class RegistrationService {
  private get registrations(): Registration[] {
    return MockDB.registrations;
  }

  async createRegistration(
    contestId: string,
    formData: RegistrationFormData
  ): Promise<ApiResponse<Registration>> {
    await delay(500);
    
    // Check if already registered
    const existing = this.registrations.find(
      r => r.contestId === contestId && 
           r.participantDetails.email === formData.email
    );
    
    if (existing) {
      return {
        success: false,
        error: 'You are already registered for this contest'
      };
    }
    
    const registration: Registration = {
      id: `reg-${generateId()}`,
      contestId,
      participantId: generateParticipantId(),
      status: 'pending',
      registeredAt: new Date().toISOString(),
      paymentStatus: 'pending',
      participantDetails: {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        institution: formData.institution,
        city: formData.city,
        state: formData.state,
        country: formData.country
      }
    };
    
    this.registrations.push(registration);
    
    return {
      success: true,
      data: registration,
      message: 'Registration created successfully'
    };
  }

  async processPayment(
    registrationId: string,
    _paymentDetails: { method: string }
  ): Promise<ApiResponse<Registration>> {
    await delay(1000); // Simulate payment processing
    
    const registration = this.registrations.find(r => r.id === registrationId);
    
    if (!registration) {
      return {
        success: false,
        error: 'Registration not found'
      };
    }
    
    // Simulate successful payment
    registration.paymentId = `pay-${generateId()}`;
    registration.paymentStatus = 'completed';
    registration.status = 'confirmed';
    
    return {
      success: true,
      data: registration,
      message: 'Payment processed successfully'
    };
  }

  async getRegistrationById(id: string): Promise<ApiResponse<Registration>> {
    await delay(200);
    
    const registration = this.registrations.find(r => r.id === id);
    
    if (!registration) {
      return {
        success: false,
        error: 'Registration not found'
      };
    }
    
    return {
      success: true,
      data: registration
    };
  }

  async getRegistrationByParticipantId(participantId: string): Promise<ApiResponse<Registration>> {
    await delay(200);
    
    const registration = this.registrations.find(r => r.participantId === participantId);
    
    if (!registration) {
      return {
        success: false,
        error: 'Registration not found'
      };
    }
    
    return {
      success: true,
      data: registration
    };
  }

  async verifyOTP(participantId: string, otp: string): Promise<ApiResponse<Registration>> {
    await delay(300);
    
    // For demo, accept any 6-digit OTP or "123456"
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return {
        success: false,
        error: 'Invalid OTP format'
      };
    }
    
    const registration = this.registrations.find(r => r.participantId === participantId);
    
    if (!registration) {
      return {
        success: false,
        error: 'Participant not found'
      };
    }
    
    if (registration.status !== 'confirmed') {
      return {
        success: false,
        error: 'Registration is not confirmed'
      };
    }
    
    return {
      success: true,
      data: registration,
      message: 'OTP verified successfully'
    };
  }

  async sendOTP(email: string): Promise<ApiResponse<{ sent: boolean }>> {
    await delay(400);
    
    // Simulate sending OTP
    return {
      success: true,
      data: { sent: true },
      message: `OTP sent to ${email}`
    };
  }

  async getRegistrationsByContestId(contestId: string): Promise<ApiResponse<Registration[]>> {
    await delay(300);
    return {
      success: true,
      data: getRegistrationsForContest(contestId)
    };
  }

  // Admin methods
  async getRegistrations(contestId: string, filters?: {
    status?: string;
    payment?: string;
    search?: string;
    dateRange?: { from: string; to: string };
  }): Promise<ApiResponse<Registration[]>> {
    await delay(300);
    
    let filtered = this.registrations.filter(r => r.contestId === contestId);
    
    if (filters) {
      if (filters.status) {
        filtered = filtered.filter(r => r.status === filters.status);
      }
      if (filters.payment) {
        filtered = filtered.filter(r => r.paymentStatus === filters.payment);
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(r => 
          r.participantDetails.fullName.toLowerCase().includes(search) ||
          r.participantDetails.email.toLowerCase().includes(search) ||
          r.participantDetails.phone.includes(search) ||
          r.participantId.toLowerCase().includes(search)
        );
      }
      if (filters.dateRange) {
        const from = new Date(filters.dateRange.from);
        const to = new Date(filters.dateRange.to);
        filtered = filtered.filter(r => {
          const regDate = new Date(r.registeredAt);
          return regDate >= from && regDate <= to;
        });
      }
    }
    
    return {
      success: true,
      data: filtered
    };
  }

  async exportRegistrationsCSV(registrations: Registration[]): Promise<string> {
    const headers = ['Participant ID', 'Full Name', 'Email', 'Phone', 'Institution', 'City', 'State', 'Country', 'Status', 'Payment Status', 'Registered At'];
    const rows = registrations.map(r => [
      r.participantId,
      r.participantDetails.fullName,
      r.participantDetails.email,
      r.participantDetails.phone,
      r.participantDetails.institution || '',
      r.participantDetails.city || '',
      r.participantDetails.state || '',
      r.participantDetails.country,
      r.status,
      r.paymentStatus,
      new Date(r.registeredAt).toLocaleDateString()
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csv;
  }

  async bulkRevokeRegistrations(registrationIds: string[], reason: string): Promise<ApiResponse<{ revoked: number }>> {
    await delay(500);
    
    let count = 0;
    registrationIds.forEach(id => {
      const reg = this.registrations.find(r => r.id === id);
      if (reg) {
        reg.status = 'revoked';
        count++;
      }
    });
    
    return {
      success: true,
      data: { revoked: count },
      message: `${count} registrations revoked. Reason: ${reason}`
    };
  }

  async markAsPaid(registrationId: string, reference: string): Promise<ApiResponse<Registration>> {
    await delay(500);
    const reg = this.registrations.find(r => r.id === registrationId);
    if (!reg) return { success: false, error: 'Registration not found' };
    
    reg.paymentStatus = 'completed';
    reg.status = 'confirmed';
    reg.paymentId = reference;
    reg.paymentMethod = 'Manual/Offline';
    
    return { success: true, data: reg };
  }

  async allowFreeEntry(registrationId: string): Promise<ApiResponse<Registration>> {
    await delay(500);
    const reg = this.registrations.find(r => r.id === registrationId);
    if (!reg) return { success: false, error: 'Registration not found' };
    
    reg.paymentStatus = 'completed'; // Mark as completed to bypass payment checks
    reg.status = 'confirmed';
    reg.paymentMethod = 'Admin Bypass';
    
    return { success: true, data: reg };
  }
}

export const registrationService = new RegistrationService();
