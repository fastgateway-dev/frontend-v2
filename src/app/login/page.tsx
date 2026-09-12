'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/stores/auth';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { ssoApi } from '@/lib/api/sso';
import type { SSOPublicConfig } from '@/types';

interface LoginForm {
  username: string;
  password: string;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ssoConfig, setSSOConfig] = useState<SSOPublicConfig | null>(null);

  const ssoError = searchParams?.get('error');

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  useEffect(() => {
    ssoApi.getPublicConfig().then(setSSOConfig).catch(() => {});
  }, []);

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setIsLoading(true);

    try {
      await login(data.username, data.password);
      router.push('/projects');
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSOLogin = () => {
    window.location.href = ssoApi.getAuthorizeUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/android-chrome-192x192.png"
            alt="FastGateway"
            width={80}
            height={80}
            className="mx-auto mb-4"
            priority
          />
          <h1 className="text-3xl font-bold text-gray-900">FastGateway</h1>
          <p className="text-gray-600 mt-2">Kubernetes Gateway API Management</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <Input
                id="username"
                label="Username"
                placeholder="Enter your username"
                {...register('username', { required: 'Username is required' })}
                error={errors.username?.message}
              />

              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="Enter your password"
                {...register('password', { required: 'Password is required' })}
                error={errors.password?.message}
              />

              <Button type="submit" className="w-full" isLoading={isLoading}>
                Sign In
              </Button>
            </form>

            {ssoConfig?.enabled && (
              <div className="mt-4">
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSSOLogin}
                  className="w-full"
                >
                  Login with {ssoConfig.providerName || 'SSO'}
                </Button>
              </div>
            )}

            {ssoError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                SSO login failed: {decodeURIComponent(ssoError)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
