
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { userService } from '../services/userService';

interface UserContextType {
  currentUser: User | null;
  users: User[];
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  signup: (userData: Omit<User, 'id' | 'lastLogin'>) => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const SESSION_KEY = 'freightguard_active_session';

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize from localStorage
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        console.warn("Failed to restore session", e);
        return null;
      }
    }
    return null;
  });

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userService.getAllUsers();
      setUsers(data);

      // Sync active session with latest data (e.g. role changes)
      setCurrentUser(prev => {
        if (!prev) return null;
        const fresh = data.find(u => u.id === prev.id);
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(prev)) {
           localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
           return fresh;
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to load users", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  const login = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const signup = async (userData: Omit<User, 'id' | 'lastLogin'>) => {
    await userService.createUser(userData);
    await refreshUsers();
  };

  return (
    <UserContext.Provider value={{ currentUser, users, loading, login, logout, signup, refreshUsers }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
