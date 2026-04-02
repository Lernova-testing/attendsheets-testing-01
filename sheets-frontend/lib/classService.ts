const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
import { Class } from '@/types';
import { fetchWithRetry } from './fetchWithTimeout';

export interface AttendanceCounts {
  P: number;
  A: number;
  L: number;
}

class ClassService {
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private getAuthHeaders(): Record<string, string> {
    // ✅ FIX: Check BOTH sessionStorage AND localStorage (same as auth-context)
    const token = typeof window !== 'undefined' 
      ? (sessionStorage.getItem('access_token') || localStorage.getItem('access_token'))
      : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  private async apiCall<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...(options.headers as Record<string, string>),
        },
        timeout: 30000, // 30 seconds for class operations
        maxRetries: 3,
        baseDelay: 1000,
      });
  
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || error.message || `API Error: ${response.statusText}`);
      }
  
      return (await response.json()) as T;
    } catch (error: unknown) {
      const hint = `Network error: ${
        this.getErrorMessage(error).includes('timeout') 
          ? 'Request timed out - server may be slow' 
          : this.getErrorMessage(error).includes('Network')
          ? 'Check your internet connection'
          : this.getErrorMessage(error)
      }`;
      
      console.error('API call failed:', { endpoint, error: this.getErrorMessage(error), hint });
      throw new Error(hint);
    }
  }

  async getAllClasses(): Promise<Class[]> {
    try {
      const result = await this.apiCall<{ classes: Class[] }>('/classes');
      return result.classes;
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  }

  async getClass(classId: string): Promise<Class> {
    try {
      const result = await this.apiCall<{ class: Class }>(`/classes/${classId}`);
      return result.class;
    } catch (error) {
      console.error('Error fetching class:', error);
      throw error;
    }
  }

  async createClass(classData: Class): Promise<Class> {
    try {
      const result = await this.apiCall<{ success: boolean; class: Class }>('/classes', {
        method: 'POST',
        body: JSON.stringify(classData),
      });
      return result.class;
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  }

  async updateClass(classId: string, classData: Class): Promise<Class> {
    try {
      const result = await this.apiCall<{ success: boolean; class: Class }>(`/classes/${classId}`, {
        method: 'PUT',
        body: JSON.stringify(classData),
      });
      return result.class;
    } catch (error) {
      console.error('Error updating class:', error);
      throw error;
    }
  }

  async deleteClass(classId: string): Promise<boolean> {
    try {
      const result = await this.apiCall<{ success: boolean; message: string }>(`/classes/${classId}`, {
        method: 'DELETE',
      });
      return result.success;
    } catch (error) {
      console.error('Error deleting class:', error);
      throw error;
    }
  }

  async syncClasses(localClasses: Class[]): Promise<Class[]> {
    try {
      const backendClasses = await this.getAllClasses();
      const backendClassIds = new Set(backendClasses.map(c => c.id));
      for (const localClass of localClasses) {
        if (!backendClassIds.has(localClass.id)) {
          await this.createClass(localClass);
        } else {
          await this.updateClass(String(localClass.id), localClass);
        }
      }
      return await this.getAllClasses();
    } catch (error) {
      console.error('Error syncing classes:', error);
      throw error;
    }
  }

  async loadClasses(): Promise<Class[]> {
    try {
      return await this.getAllClasses();
    } catch (error) {
      console.error('Error loading classes:', error);
      return [];
    }
  }
}

export const classService = new ClassService();
