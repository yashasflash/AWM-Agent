import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { AlertBanner } from '../../components/common/Error';
import { ShieldAlert, KeyRound, User, Mail, Lock, Building2, ArrowLeft } from 'lucide-react';

export const SetupManagerPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [organization, setOrganization] = useState('Municipal Headquarters');
  const [district, setDistrict] = useState('Central District');
  const [designation, setDesignation] = useState('Chief Administrator');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { success } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await authService.setupInitialManager({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        organization: organization.trim(),
        district: district.trim(),
        designation: designation.trim(),
        setup_key: setupKey.trim() || undefined,
      });

      success('Initial Manager provisioned successfully! You can now log in.');
      navigate('/auth/login?portal=manager');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Setup failed. Please check the backend configuration.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
      <div className="w-full max-w-lg">
        <Link
          to="/auth/login?portal=manager"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#103D35] mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>

        <Card variant="flat" className="shadow-card p-6 sm:p-8">
          <div className="mb-6 pb-4 border-b border-[#DCE8E2]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#103D35] text-white flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-[#FF6848]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#103D35]">Initialize Administrator</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bootstrap the primary municipal manager account for this deployment.
                </p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <AlertBanner
              message={errorMsg}
              variant="error"
              onDismiss={() => setErrorMsg(null)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Manager Full Name"
              placeholder="e.g. Chief Executive Officer"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="Manager Official Email"
              type="email"
              placeholder="manager@awm.gov"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                leftIcon={<Building2 className="w-4 h-4" />}
              />
              <Input
                label="Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              />
            </div>

            <Input
              label="Setup Secret Key (Optional if exempt)"
              type="password"
              placeholder="Optional backend setup key"
              value={setupKey}
              onChange={(e) => setSetupKey(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              Provision Initial Manager Account
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
