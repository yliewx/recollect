import { apiRequest } from './client';
import type { CreateUserResponse, User } from './types';

export async function createUser(username: string, email: string): Promise<User> {
  const result = await apiRequest<CreateUserResponse>('/users', {
    method: 'POST',
    body: { username, email },
  });
  return result.user;
}
