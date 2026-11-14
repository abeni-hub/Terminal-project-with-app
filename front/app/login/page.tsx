'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bus, Eye, EyeOff } from 'lucide-react';
import { api, type ApiError } from '@/src/services/api';
import { useAuthStore } from '@/src/store/auth-store';
import { APP_NAME, APP_TAGLINE } from '@/src/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

const demoAccounts = [
  { email: 'abebe@aato.gov.et', role: 'Super Administrator' },
  { email: 'sara@aato.gov.et', role: 'Municipal Planner' },
  { email: 'dawit@aato.gov.et', role: 'Dispatcher' },
];

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: api.auth.login,
    onSuccess: (session) => {
      setSession(session);
      toast.success('Welcome back, ' + session.user.name);
      router.push('/dashboard');
    },
    onError: (err: ApiError) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-info/5 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Bus className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{APP_NAME}</h1>
            <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Sign in to your account</CardTitle>
            <CardDescription>Enter your credentials to access the roster system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="name@aato.gov.et" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" onClick={() => router.push('/forgot-password')} className="text-xs text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6 space-y-2">
              <p className="text-center text-xs font-medium text-muted-foreground">Demo accounts (password: password123)</p>
              <div className="grid gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => { setValue('email', acc.email); setValue('password', 'password123'); }}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs transition-colors hover:bg-muted"
                  >
                    <span className="font-medium text-foreground">{acc.role}</span>
                    <span className="text-muted-foreground">{acc.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">Addis Ababa Transport Office - All rights reserved</p>
      </div>
    </div>
  );
}
