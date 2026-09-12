import apiClient from './client';
import { User } from '@/types';

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  role: 'owner' | 'super_admin' | 'admin' | 'user';
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  password?: string;
  role?: 'owner' | 'super_admin' | 'admin' | 'user';
  isActive?: boolean;
}

export interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export const usersApi = {
  list: async (page = 1, limit = 20): Promise<UsersResponse> => {
    const response = await apiClient.get('/users', {
      params: { page, limit },
    });
    return response.data;
  },

  get: async (userId: string): Promise<User> => {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  },

  create: async (input: CreateUserInput): Promise<User> => {
    const response = await apiClient.post('/users', input);
    return response.data;
  },

  update: async (userId: string, input: UpdateUserInput): Promise<User> => {
    const response = await apiClient.patch(`/users/${userId}`, input);
    return response.data;
  },

  delete: async (userId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}`);
  },
};
