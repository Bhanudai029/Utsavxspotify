import React from 'react';
import type { ReactNode } from 'react';
import { useUser } from '../contexts/UserContext';
import ProfileAuth from './ProfileAuth';

interface ProtectedComponentProps {
  children: ReactNode;
  requireAuth?: boolean;
  authMessage?: string;
  authTitle?: string;
}

const ProtectedComponent: React.FC<ProtectedComponentProps> = ({ 
  children, 
  requireAuth = true,
  authMessage = "Enter your credentials to access your music profile",
  authTitle = "Welcome Back"
}) => {
  const { currentUser } = useUser();

  const handleAuth = (name: string, _passkey: string) => {
    console.log('Authentication completed for:', name);
    // The actual login is handled by ProfileAuth component internally
  };

  if (requireAuth && !currentUser) {
    return (
      <div className="h-full bg-spotify-black">
        <ProfileAuth 
          onAuth={handleAuth}
          customMessage={authMessage}
          customTitle={authTitle}
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedComponent;