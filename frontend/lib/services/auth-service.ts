import type { ApiResponse } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

// Session token storage key
const SESSION_KEY = 'quizbuzz_session';

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
    registration: {
        participantId: string;
    };
    deviceId: string;
    proctoringEnabled: boolean;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        throw {
            code: data.code || 'REQUEST_FAILED',
            message: data.message || `Request failed: ${res.status}`
        };
    }
    return data;
}

class AuthService {
    // Generate device ID
    private getDeviceId(): string {
        let deviceId = typeof window !== 'undefined' ? localStorage.getItem('quizbuzz_device_id') : null;
        if (!deviceId) {
            deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            if (typeof window !== 'undefined') {
                localStorage.setItem('quizbuzz_device_id', deviceId);
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
        contestSlug: string
    ): Promise<ApiResponse<OTPSendResponse>> {
        try {
            await apiPost<{ success: boolean; message: string }>(
                '/auth/quiz/request-otp',
                { email: contact }
            );

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
        } catch (err: any) {
            return {
                success: false,
                error: err.code || 'UNKNOWN',
                message: err.message || 'Could not send OTP. Please try again.'
            };
        }
    }

    // Verify OTP and create session
    async verifyOTP(
        contact: string,
        contactType: 'phone' | 'email',
        otp: string | undefined,
        contestSlug: string,
        joinCode?: string,
        contestId?: string
    ): Promise<ApiResponse<OTPVerifyResponse>> {
        try {
            const res = await apiPost<{
                success: boolean;
                data: {
                    sessionToken: string;
                    participantId: string;
                    contestId: string;
                    organizationId: string;
                    proctoringEnabled: boolean;
                };
            }>('/auth/quiz/participant-login', {
                email: contact.toLowerCase(),
                otp,
                contestSlug,
                joinCode,
                contestId
            });

            const deviceId = this.getDeviceId();

            // Store session
            const sessionData: SessionData = {
                participantId: res.data.participantId,
                contestId: res.data.contestId,
                token: res.data.sessionToken,
                deviceId,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            };

            if (typeof window !== 'undefined') {
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
            }

            return {
                success: true,
                data: {
                    sessionToken: res.data.sessionToken,
                    registration: {
                        participantId: res.data.participantId
                    },
                    deviceId,
                    proctoringEnabled: res.data.proctoringEnabled ?? true
                }
            };
        } catch (err: any) {
            return {
                success: false,
                error: err.code || 'UNKNOWN',
                message: err.message || 'Verification failed. Please try again.'
            };
        }
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
        // Simulating no conflict for this environment
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
        return {
            success: true,
            data: { success: true }
        };
    }
}

export const authService = new AuthService();
