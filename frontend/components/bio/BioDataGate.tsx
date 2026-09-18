"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { subscribeAuth, getCurrentUserSnapshot } from "@/lib/session";
import { apiMe } from "@/lib/api";
import { GuardSkeleton } from "@/components/skeletons/PageSkeletons";

/**
 * Route-level guard for /profile (and any biodata-gated page).
 * The sidebar already hides the link until bio data is submitted, but a
 * logged-in user can still paste the URL directly — this redirects them to
 * /bio-data so the gate holds even outside the nav. It also re-syncs the
 * session via /api/auth/me so the flag is never stale in localStorage.
 */
export default function BioDataGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useSyncExternalStore(subscribeAuth, getCurrentUserSnapshot, () => null);
  const [submitted, setSubmitted] = useState<boolean | null>(
    user?.bio_data_submitted === true ? true : null
  );

  useEffect(() => {
    let active = true;
    (async () => {
      let ok = false;
      try {
        const res = await apiMe();
        ok = res.data.member?.bio_data_submitted === true;
      } catch {
        ok = user?.bio_data_submitted === true;
      }
      if (active) {
        setSubmitted(ok);
        if (!ok) router.replace("/bio-data");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (submitted !== true) {
    return <GuardSkeleton />;
  }

  return <>{children}</>;
}