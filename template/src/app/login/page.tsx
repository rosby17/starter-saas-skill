import AuthUI from "@/components/AuthUI";
import { googleEnabled } from "@/lib/auth/providers";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  return <AuthUI initialMode="login" google={await googleEnabled()} />;
}
