'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceFingerprint, DeviceInfo } from './deviceFingerprint';
import { fetchWithRetry } from './fetchWithTimeout';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signup: (email: string, password: string, name: string, role?: string) => Promise<{ success: boolean; message: string }>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; message: string; role?: string; user?: User }>;
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  requestChangePassword: () => Promise<{ success: boolean; message: string }>;
  changePassword: (code: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  updateProfile: (name: string) => Promise<{ success: boolean; user: User }>;
  refreshUser: () => Promise<void>;
  resendVerificationCode: (email: string) => Promise<{ success: boolean; message: string }>;
  deleteAccount: () => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface AuthApiResponse {
  access_token: string;
  user: User & { role?: string };
}

interface ProfileResponse {
  name: string;
}

interface MeResponse {
  id: string;
  email: string;
  name: string;
  role?: string;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

async function apiCall<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' 
    ? (sessionStorage.getItem('access_token') || localStorage.getItem('access_token'))
    : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
      },
      timeout: 20000, // 20 seconds
      maxRetries: 3,
      baseDelay: 1000,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || `API Error: ${response.statusText}`);
    }

    return response.json();
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error, 'Request failed');
    if (errorMessage.includes('timeout')) {
      throw new Error('Request timed out. Please check your connection.');
    }
    if (errorMessage.includes('Network')) {
      throw new Error('Network error. Please check your internet.');
    }
    throw new Error(errorMessage);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      console.log('🔍 Checking existing session...');

      // Check sessionStorage first (current browser session)
      let storedToken = sessionStorage.getItem('access_token');
      let storedUser = sessionStorage.getItem('user');
      let storedRole = sessionStorage.getItem('user_role');
      let source = 'sessionStorage';

      // If not in sessionStorage, check localStorage (Remember Me was checked)
      if (!storedToken || !storedUser) {
        storedToken = localStorage.getItem('access_token');
        storedUser = localStorage.getItem('user');
        storedRole = localStorage.getItem('user_role');
        source = 'localStorage';
      }

      console.log(`📦 Token found in: ${source}`);
      console.log(`🔑 Token exists: ${!!storedToken}`);
      console.log(`👤 User exists: ${!!storedUser}`);

      if (storedToken && storedUser) {
        try {
          // Verify token is still valid
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const userData = JSON.parse(storedUser);
            if (storedRole && !userData.role) {
              userData.role = storedRole;
            }
            setToken(storedToken);
            setUser(userData);

            // ✅ CRITICAL FIX: Always sync to BOTH storages
            // This ensures tokens are available in both places during active session
            sessionStorage.setItem('access_token', storedToken);
            sessionStorage.setItem('user', storedUser);
            if (storedRole) {
              sessionStorage.setItem('user_role', storedRole);
            }

            // If token was in localStorage, keep it there (Remember Me)
            if (source === 'localStorage') {
              localStorage.setItem('access_token', storedToken);
              localStorage.setItem('user', storedUser);
              if (storedRole) {
                localStorage.setItem('user_role', storedRole);
              }
            }

            console.log('✅ Session restored successfully');

            // Auto-redirect to dashboard if on auth page
            const currentPath = window.location.pathname;
            if (currentPath === '/auth' || currentPath === '/') {
              const redirectPath = userData.role === 'student' ? '/student/dashboard' : '/dashboard';
              router.push(redirectPath);
            }
          } else {
            console.log('❌ Token validation failed');
            // Token invalid, clear everything
            clearAllStorage();
          }
        } catch (error) {
          console.error('❌ Session check error:', error);
          clearAllStorage();
        }
      } else {
        console.log('ℹ️ No existing session found');
      }
      
      setLoading(false);
    };

    checkExistingSession();
  }, [router]);

  // ✅ Handle browser close: Clear localStorage if Remember Me wasn't checked
  useEffect(() => {
    const handleBeforeUnload = () => {
      const rememberMe = localStorage.getItem('remember_me') === 'true';
      
      if (!rememberMe) {
        console.log('🧹 Browser closing without Remember Me - Clearing localStorage');
        // Clear localStorage on browser close (sessionStorage clears automatically)
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        localStorage.removeItem('remember_me');
      } else {
        console.log('💾 Browser closing with Remember Me - Keeping localStorage');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const clearAllStorage = () => {
    if (typeof window === 'undefined') return;
    
    console.log('🧹 Clearing all storage...');
    
    // Clear sessionStorage
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('user_role');
    
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('pending_signup_role');
  };

  const signup = async (email: string, password: string, name: string, role: string = 'teacher') => {
    try {
      const endpoint = role === 'student' ? '/auth/student/signup' : '/auth/signup';

      // Only collect device fingerprint for students
      let deviceInfo = null;
      if (role === 'student') {
        deviceInfo = await getDeviceFingerprint();
        console.log('📱 Student signup - Device fingerprint collected:', deviceInfo);
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pending_signup_role', role);
      }

      const body: Record<string, unknown> = { email, password, name, role };

      // Only add device info for students
      if (role === 'student' && deviceInfo) {
        body.device_id = deviceInfo.id;
        body.device_info = deviceInfo;
      }

      await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return { success: true, message: 'Verification code sent to your email' };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, 'Signup failed') };
    }
  };

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      let response: AuthApiResponse;
      let role: string = 'teacher';
      let deviceInfo: DeviceInfo | null = null;

      // Try teacher login first (NO device fingerprinting)
      try {
        response = await apiCall('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        role = 'teacher';
      } catch {
        // Try student login WITH device fingerprinting
        try {
          deviceInfo = await getDeviceFingerprint();

          response = await apiCall('/auth/student/login', {
            method: 'POST',
            body: JSON.stringify({
              email,
              password,
              device_id: deviceInfo.id,
              device_info: deviceInfo,
            }),
          });
          role = 'student';
        } catch (studentError: unknown) {
          // Check if it's a device authorization error
          const studentErrorMessage = getErrorMessage(studentError, 'Login failed');
          if (studentErrorMessage.includes('not authorized') ||
            studentErrorMessage.includes('trusted device')) {
            throw new Error('🚫 Login blocked: This device is not authorized. Please use the trusted device that was used to create this student account.');
          }
          throw new Error('Invalid email or password');
        }
      }

      // Save login data
      const userData = { ...response.user, role };

      // Always keep an active session token in sessionStorage.
      sessionStorage.setItem('access_token', response.access_token);
      sessionStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.setItem('user_role', role);

      if (rememberMe) {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('user_role', role);
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
      }

      localStorage.setItem('remember_me', rememberMe.toString());

      setToken(response.access_token);
      setUser(userData);

      return {
        success: true,
        message: 'Login successful',
        role: role,
        user: userData
      };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, 'Login failed') };
    }
  };

  const verifyEmail = async (email: string, code: string) => {
    try {
      const pendingRole = typeof window !== 'undefined' 
        ? (sessionStorage.getItem('pending_signup_role') || localStorage.getItem('pending_signup_role'))
        : null;
      const role = pendingRole || 'teacher';
      const endpoint = role === 'student' ? '/auth/student/verify-email' : '/auth/verify-email';

      const response = await apiCall<AuthApiResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });

      const userData = { ...response.user, role: response.user.role || role };

      // Keep active session in sessionStorage.
      sessionStorage.setItem('access_token', response.access_token);
      sessionStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.setItem('user_role', userData.role);

      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      localStorage.removeItem('user_role');
      localStorage.setItem('remember_me', 'false');

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pending_signup_role');
        localStorage.removeItem('pending_signup_role');
      }

      setToken(response.access_token);
      setUser(userData);

      return { success: true, message: 'Email verified successfully' };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, 'Verification failed') };
    }
  };

  const resendVerificationCode = async (email: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message || 'Verification code resent successfully' };
      } else {
        let errorMessage = 'Failed to resend verification code';
        if (data.detail) {
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            errorMessage = data.detail
              .map((err: unknown) => {
                if (typeof err === 'string') return err;
                if (typeof err === 'object' && err !== null && 'msg' in err) {
                  const msg = (err as { msg?: unknown }).msg;
                  if (typeof msg === 'string') return msg;
                }
                return 'Validation error';
              })
              .join(', ');
          } else if (typeof data.detail === 'object') {
            errorMessage = data.detail.msg || JSON.stringify(data.detail);
          }
        }
        return { success: false, message: errorMessage };
      }
    } catch (error: unknown) {
      console.error('Resend verification error:', error);
      return { success: false, message: getErrorMessage(error, 'An error occurred while resending the code') };
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      await apiCall('/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return { success: true, message: 'Reset code sent to your email' };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, 'Request failed') };
    }
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    try {
      await apiCall('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, new_password: newPassword }),
      });
      return { success: true, message: 'Password reset successfully' };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, 'Reset failed') };
    }
  };

  const requestChangePassword = async () => {
    try {
      await apiCall('/auth/request-change-password', {
        method: 'POST',
      });
      return { success: true, message: 'Verification code sent to your email' };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, 'Request failed') };
    }
  };

  const changePassword = async (code: string, newPassword: string) => {
    try {
      await apiCall('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ code, new_password: newPassword }),
      });
      return { success: true, message: 'Password changed successfully' };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, 'Change failed') };
    }
  };

  const updateProfile = async (name: string) => {
    try {
      const response = await apiCall<ProfileResponse>('/auth/update-profile', {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });

      const updatedUser = { ...user!, name: response.name };
      setUser(updatedUser);
      
      // Update both storages
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('user', JSON.stringify(updatedUser));

      return { success: true, user: updatedUser };
    } catch {
      return { success: false, user: user! };
    }
  };

  const refreshUser = async () => {
    try {
      const response = await apiCall<MeResponse>('/auth/me');
      const updatedUser = {
        id: response.id,
        email: response.email,
        name: response.name,
        role: response.role || user?.role,
      };
      setUser(updatedUser);
      
      // Update both storages
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const logout = async () => {
    try {
      await apiCall('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Clear ALL session data from both storages
      clearAllStorage();
      setToken(null);
      setUser(null);
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const endpoint = user?.role === 'student' ? '/auth/student/delete-account' : '/auth/delete-account';
      await apiCall(endpoint, {
        method: 'DELETE',
      });

      clearAllStorage();
      setToken(null);
      setUser(null);

      return { success: true, message: 'Account deleted successfully' };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, 'Delete failed') };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signup,
        login,
        verifyEmail,
        logout,
        isAuthenticated: !!token,
        requestPasswordReset,
        resetPassword,
        requestChangePassword,
        changePassword,
        updateProfile,
        refreshUser,
        resendVerificationCode,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export async function apiCallWithAuth(endpoint: string, options: RequestInit = {}) {
  return apiCall(endpoint, options);
}
