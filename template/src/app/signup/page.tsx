import AuthUI from "@/components/AuthUI";
import { googleEnabled } from "@/lib/auth/providers";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  return <AuthUI initialMode="signup" google={await googleEnabled()} />;
}
