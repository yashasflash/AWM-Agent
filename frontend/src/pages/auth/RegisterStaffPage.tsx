import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { AlertBanner } from '../../components/common/Error';
import { MUNICIPAL_DEPARTMENTS } from '../../utils/constants';
import { Truck, User, Mail, Lock, Building2, MapPin, ArrowLeft } from 'lucide-react';

export const RegisterStaffPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [placeMunicipality, setPlaceMunicipality] = useState('Central Municipality');
  const [organization, setOrganization] = useState(MUNICIPAL_DEPARTMENTS[0]);
  const [district, setDistrict] = useState('Central District');
  const [designation, setDesignation] = useState('Sanitation Crew Lead');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { registerStaff } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please verify.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerStaff({
        full_name: fullName.trim(),
        place_municipality: placeMunicipality.trim(),
        organization: organization.trim(),
        district: district.trim(),
        designation: designation.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirm_password: confirmPassword,
      });

      success('Registration request submitted! Your application is awaiting Manager authorization.');
      navigate('/auth/pending-approval');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration request failed. Please check your details.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
      <div className="w-full max-w-xl">
        <Link
          to="/auth/login?portal=municipal_staff"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#103D35] mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Staff Sign In
        </Link>

        <Card variant="flat" className="shadow-card p-6 sm:p-8">
          <div className="mb-6 pb-4 border-b border-[#DCE8E2]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF0ED] text-[#FF6848] flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#103D35]">Municipal Staff Application</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Request access for field cleansing crews, sanitation leads, and work order dispatch.
                </p>
              </div>
            </div>
          </div>

          {formError && (
            <AlertBanner
              message={formError}
              variant="error"
              onDismiss={() => setFormError(null)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="Marcus Chen"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                required
              />

              <Input
                label="Designation / Position"
                placeholder="Sanitation Lead"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Department / Crew Division"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                options={MUNICIPAL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
                required
              />

              <Input
                label="Municipality / Sector"
                placeholder="Central Municipality"
                value={placeMunicipality}
                onChange={(e) => setPlaceMunicipality(e.target.value)}
                leftIcon={<Building2 className="w-4 h-4" />}
                required
              />
            </div>

            <Input
              label="District Office"
              placeholder="Central District"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              leftIcon={<MapPin className="w-4 h-4" />}
              required
            />

            <Input
              label="Official Staff Email"
              type="email"
              placeholder="staff.name@awm.gov"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              helperText="You will receive a unique Registered Staff ID (e.g. STF-XXXXX) upon Manager approval."
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />
            </div>

            <Button
              type="submit"
              variant="emerald"
              size="lg"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              Submit Staff Registration for Approval
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#DCE8E2] text-center text-xs text-slate-600">
            Already authorized as Field Staff?{' '}
            <Link to="/auth/login?portal=municipal_staff" className="font-semibold text-[#16836A] hover:underline">
              Sign In with Staff ID / Email
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
