"use client";

import { Suspense } from 'react';
import AuthUI from "@/components/AuthUI";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" /></div>}>
      <AuthUI initialMode="login" />
    </Suspense>
  );
}
