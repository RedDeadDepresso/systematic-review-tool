'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import {
  useDeleteUser,
  useFetchUser,
  useUpdateUser,
} from '@/features/users/hooks/use-auth';

// Loading skeleton component
function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Avatar Card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <Skeleton className="h-24 w-24 rounded-full shrink-0" />
              <div className="flex flex-col gap-3 flex-1">
                <div>
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Info Card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Skeleton className="h-10 w-36" />
        </div>

        {/* Danger Zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <Skeleton className="h-5 w-28 mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-36" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Avatar section component
interface AvatarSectionProps {
  avatarPreview: string | null;
  initials: string;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAvatar: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  error?: string;
}

function AvatarSection({
  avatarPreview,
  initials,
  onAvatarChange,
  onRemoveAvatar,
  fileInputRef,
  error,
}: AvatarSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile Photo</CardTitle>
        <CardDescription>
          Upload a profile picture to personalise your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          {/* Avatar with hover effect */}
          <div className="relative group shrink-0">
            <Avatar className="h-24 w-24 border-2 border-border shadow-sm">
              <AvatarImage src={avatarPreview || undefined} alt="Profile" />
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Hover overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
              aria-label="Change profile photo"
            >
              <Camera className="h-6 w-6 text-white" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onAvatarChange}
              className="hidden"
              aria-label="Upload profile photo"
            />
          </div>

          {/* Actions and info */}
          <div className="flex flex-col gap-3 flex-1">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {avatarPreview ? 'Update your photo' : 'Add a photo'}
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max size 5MB.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="bg-background hover:bg-accent"
              >
                <Camera className="h-4 w-4 mr-2" />
                {avatarPreview ? 'Change Photo' : 'Upload Photo'}
              </Button>

              {avatarPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemoveAvatar}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive flex items-start gap-1.5">
                <span className="mt-0.5">⚠</span>
                <span>{error}</span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Personal info section component
interface PersonalInfoSectionProps {
  firstName: string;
  lastName: string;
  email: string;
  errors: Record<string, string>;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
}

function PersonalInfoSection({
  firstName,
  lastName,
  email,
  errors,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
}: PersonalInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Personal Information</CardTitle>
        <CardDescription>Update your name and email address.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
              placeholder="Enter first name"
              className={errors.firstName ? 'border-destructive' : ''}
            />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              placeholder="Enter last name"
              className={errors.lastName ? 'border-destructive' : ''}
            />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName}</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="Enter email address"
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Danger zone section component
interface DangerZoneSectionProps {
  onDeleteClick: () => void;
}

function DangerZoneSection({ onDeleteClick }: DangerZoneSectionProps) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">
          Danger Zone
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="bg-transparent border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={onDeleteClick}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
      </CardContent>
    </Card>
  );
}

// Main component
export function EditProfileForm() {
  const { data: user, isLoading } = useFetchUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      });
      setAvatarPreview(user.avatar);
    }
  }, [user]);

  const getInitials = useCallback(() => {
    const f = formData.firstName?.[0] || '';
    const l = formData.lastName?.[0] || '';
    return (f + l).toUpperCase() || 'U';
  }, [formData.firstName, formData.lastName]);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
        clearError('avatar');
      }
    },
    [clearError]
  );

  const handleRemoveAvatar = useCallback(() => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof typeof formData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      clearError(field);
    },
    [clearError]
  );

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    const variables: {
      email?: string;
      firstName?: string;
      lastName?: string;
      avatar?: File | null;
    } = {
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
    };

    if (!avatarPreview) {
      variables.avatar = null;
    } else if (avatarFile) {
      variables.avatar = avatarFile;
    }

    updateUser.mutate(variables);
  }, [validate, formData, avatarPreview, avatarFile, updateUser]);

  const handleDeleteAccount = useCallback(() => {
    deleteUser.mutate();
  }, [deleteUser]);

  // Show loading skeleton
  if (isLoading || !user) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Edit Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update your personal information and profile photo.
          </p>
        </div>

        {/* Avatar Section */}
        <AvatarSection
          avatarPreview={avatarPreview}
          initials={getInitials()}
          onAvatarChange={handleAvatarChange}
          onRemoveAvatar={handleRemoveAvatar}
          fileInputRef={fileInputRef}
          error={errors.avatar}
        />

        {/* Personal Info Section */}
        <PersonalInfoSection
          firstName={formData.firstName}
          lastName={formData.lastName}
          email={formData.email}
          errors={errors}
          onFirstNameChange={(value) => handleFieldChange('firstName', value)}
          onLastNameChange={(value) => handleFieldChange('lastName', value)}
          onEmailChange={(value) => handleFieldChange('email', value)}
        />

        {/* Error banner */}
        {errors.form && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errors.form}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={updateUser.isPending}
            className="min-w-[140px]"
          >
            {updateUser.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>

        {/* Danger Zone */}
        <DangerZoneSection onDeleteClick={() => setShowDeleteConfirm(true)} />
      </div>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? All of your data,
              including reviews, labels, and extraction answers will be
              permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUser.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteUser.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteUser.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Account'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
