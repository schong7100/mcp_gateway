'use client';

import Keycloak from 'keycloak-js';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  roles: string[];
}

export interface AuthContextValue {
  token: string;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: '',
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAdmin: false,
  login: () => {},
  logout: () => {},
});

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

const DEV_USER: AuthUser = {
  id: 'dev-user',
  username: 'developer',
  email: 'dev@localhost',
  roles: ['admin'],
};

function parseUser(kc: Keycloak): AuthUser {
  const parsed = kc.tokenParsed as Record<string, unknown> | undefined;
  const realmAccess = parsed?.['realm_access'] as { roles?: string[] } | undefined;
  const roles = realmAccess?.roles ?? [];
  return {
    id: (parsed?.['sub'] as string) ?? '',
    username: (parsed?.['preferred_username'] as string) ?? '',
    email: (parsed?.['email'] as string | undefined) ?? null,
    roles,
  };
}

export function KeycloakProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(!DEV_MODE);
  const kcRef = useRef<Keycloak | null>(null);

  useEffect(() => {
    if (DEV_MODE) {
      setToken('');
      setUser(DEV_USER);
      setIsLoading(false);
      return;
    }

    const kc = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? 'http://localhost:8080',
      realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? 'mcp-gateway',
      clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'mcp-gateway-web',
    });
    kcRef.current = kc;

    kc.onTokenExpired = () => {
      kc.updateToken(30).catch(() => {
        kc.login();
      });
    };

    kc.onAuthRefreshSuccess = () => {
      setToken(kc.token ?? '');
    };

    kc.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    })
      .then((authenticated) => {
        if (authenticated) {
          setToken(kc.token ?? '');
          setUser(parseUser(kc));
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const login = () => kcRef.current?.login();
  const logout = () =>
    kcRef.current?.logout({ redirectUri: window.location.origin });

  const roles = user?.roles ?? [];
  const isAdmin = roles.includes('admin');

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: user !== null,
        isLoading,
        isAdmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
