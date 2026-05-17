import type { Contest, ContestFilters, ApiResponse } from '@/lib/types';
import { MockDB } from '@/lib/mock/db';

// Simulated API delay for realistic UX
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ContestService {
  private get contests(): Contest[] {
    return MockDB.contests;
  }

  async getContests(filters?: ContestFilters): Promise<ApiResponse<Contest[]>> {
    await delay(300);
    
    let filtered = [...this.contests];
    
    if (filters?.status) {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    
    if (filters?.category) {
      filtered = filtered.filter(c => c.category === filters.category);
    }
    
    if (filters?.difficulty) {
      filtered = filtered.filter(c => c.difficulty === filters.difficulty);
    }
    
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(searchLower) ||
        c.description.toLowerCase().includes(searchLower) ||
        c.category.toLowerCase().includes(searchLower)
      );
    }
    
    return {
      success: true,
      data: filtered
    };
  }

  async getContestBySlug(slug: string): Promise<ApiResponse<Contest>> {
    await delay(200);
    
    const contestData = this.contests.find(c => c.slug === slug);
    
    if (!contestData) {
      return {
        success: false,
        error: 'Contest not found'
      };
    }
    
    return {
      success: true,
      data: this._transformContest(contestData)
    };
  }

  async getContestById(id: string): Promise<ApiResponse<Contest>> {
    await delay(200);
    
    const contestData = this.contests.find(c => c.id === id);
    
    if (!contestData) {
      return {
        success: false,
        error: 'Contest not found'
      };
    }

    return {
      success: true,
      data: this._transformContest(contestData)
    };
  }

  private _transformContest(contestData: any): Contest {
    return {
      ...contestData,
      orgId: contestData.organizerId || 'org-123',
      orgSlug: 'quiz-pro', // Mock
      shortDescription: contestData.description?.substring(0, 100) || '',
      topic: contestData.category || '',
      tags: contestData.tags || [contestData.category, contestData.difficulty].filter(Boolean),
      coverImage: contestData.bannerImage,
      startTime: contestData.contestDate && contestData.contestStartTime ? 
        `${contestData.contestDate}T${contestData.contestStartTime}:00Z` : 
        new Date().toISOString(),
      registrationDeadline: contestData.registrationEndDate || new Date().toISOString(),
      timezone: 'UTC',
      fee: contestData.registrationFee || 0,
      registrationFee: contestData.registrationFee || 0,
      currency: 'INR',
      publishedAt: contestData.status === 'published' || contestData.status === 'active' ? contestData.createdAt : null,
      cancelledAt: contestData.status === 'cancelled' ? contestData.updatedAt : null,
      resultsPublishedAt: contestData.status === 'completed' ? contestData.updatedAt : null,
      duration: contestData.durationMinutes || 60,
      rules: contestData.rules || [
        "Maintain a stable internet connection throughout the contest.",
        "Browser tab switching is monitored and limited.",
        "Ensure your webcam is functional if required.",
        "Submit your answers before the time expires."
      ],
      allowedDevices: contestData.allowedDevices || ["Desktop", "Laptop"],
      razorpayKeyId: contestData.razorpayKeyId || "rzp_test_1234567890",
      _counts: contestData._counts || {
        registered: contestData.currentParticipants || 0,
        confirmed: Math.floor((contestData.currentParticipants || 0) * 0.9),
        paid: Math.floor((contestData.currentParticipants || 0) * 0.8),
        submitted: contestData.status === 'completed' ? Math.floor((contestData.currentParticipants || 0) * 0.7) : 0,
      }
    } as Contest;
  }

  async getCategories(): Promise<ApiResponse<string[]>> {
    await delay(100);
    
    const categories = [...new Set(this.contests.map(c => c.category))];
    
    return {
      success: true,
      data: categories
    };
  }

  async getPublishedContests(): Promise<ApiResponse<Contest[]>> {
    return this.getContests({ status: 'published' });
  }

  async getActiveContests(): Promise<ApiResponse<Contest[]>> {
    return this.getContests({ status: 'active' });
  }

  async getFeaturedContests(limit: number = 3): Promise<ApiResponse<Contest[]>> {
    await delay(300);
    
    const featured = this.contests
      .filter(c => c.status === 'published' || c.status === 'active')
      .sort((a, b) => b.currentParticipants - a.currentParticipants)
      .slice(0, limit);
    
    return {
      success: true,
      data: featured
    };
  }
}

export const contestService = new ContestService();
