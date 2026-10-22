import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { AlertBanner } from '../../components/common/Error';
import { ShieldCheck, ShieldAlert, Loader2, ArrowRight } from 'lucide-react';

export const AuthCallbackPage: React.FC = () => {
  const { syncGoogleSession } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Verifying Google credentials with Supabase Auth...');
  const processedRef = React.useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      if (processedRef.current) return;

      try {
        // Retrieve session established by Supabase Google OAuth
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.access_token) {
          // If session is not immediately ready, listen for auth state change
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (isMounted && !processedRef.current && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && newSession?.access_token) {
              processedRef.current = true;
              authListener.subscription.unsubscribe();
              await processSession(newSession.access_token);
            }
          });

          // Timeout after 8 seconds if no session is captured
          setTimeout(() => {
            if (isMounted && !processedRef.current) {
              setErrorMsg('Authentication session timed out. Please try logging in again.');
            }
          }, 8000);
          return;
        }

        processedRef.current = true;
        await processSession(session.access_token);
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Google authentication failed.';
          setErrorMsg(msg);
        }
      }
    }

    async function processSession(accessToken: string) {
      if (!isMounted) return;
      setStatusMessage('Synchronizing municipal clearance and authorizations...');

      const requestedRole = localStorage.getItem('awm_oauth_role') || undefined;
      localStorage.removeItem('awm_oauth_role');
      const user = await syncGoogleSession(accessToken, requestedRole);

      setStatusMessage('Authorization verified. Launching operational console...');

      // Role-based routing as defined in specifications:
      // Missing or pending role -> /auth/pending-approval
      // Manager -> /manager
      // Municipal Staff -> /municipal
      // Citizen -> /user
      if (user.approval_status === 'pending' || user.is_pending_approval) {
        navigate('/auth/pending-approval', { replace: true });
      } else if (user.role === 'manager' || user.is_manager) {
        navigate('/manager', { replace: true });
      } else if (user.role === 'municipal_staff' || user.is_staff) {
        navigate('/municipal', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    }

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [syncGoogleSession, navigate]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card variant="flat" className="max-w-md w-full shadow-card p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#103D35] text-white flex items-center justify-center mx-auto shadow-sm">
          {errorMsg ? (
            <ShieldAlert className="w-8 h-8 text-[#FF6848]" />
          ) : (
            <ShieldCheck className="w-8 h-8 text-[#16836A]" />
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#103D35]">
            {errorMsg ? 'Authentication Interrupted' : 'Verifying Civic Credentials'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Autonomous AI Waste Management Agent • Municipal OAuth Gateway
          </p>
        </div>

        {errorMsg ? (
          <div className="space-y-4">
            <AlertBanner variant="error" message={errorMsg} />
            <Button
              variant="primary"
              className="w-full"
              onClick={() => navigate('/portals')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Return to Portal Selection
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center gap-3 text-sm font-medium text-[#16836A]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{statusMessage}</span>
            </div>
            <p className="text-xs text-slate-400">
              Please wait while your session tokens and role metadata are verified against the municipal registry.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
