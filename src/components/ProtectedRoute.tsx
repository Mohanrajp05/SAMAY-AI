import { ReactNode, useEffect } from "react";

interface ProtectedRouteProps {
  user: any;
  authLoading: boolean;
  onRedirect: (view: string) => void;
  children: ReactNode;
}

export default function ProtectedRoute({
  user,
  authLoading,
  onRedirect,
  children,
}: ProtectedRouteProps) {
  useEffect(() => {
    if (!authLoading && !user) {
      onRedirect("login");
    }
  }, [user, authLoading, onRedirect]);

  if (authLoading) {
    return (
      <div id="auth-loading" className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center gap-4 text-white">
        <div className="w-12 h-12 rounded-full border-t-2 border-[#4F46E5] animate-spin"></div>
        <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">Initializing Secure Connection...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
