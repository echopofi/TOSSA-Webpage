"use client";

import Card from "@/components/ui/Card";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Skeleton,
  SkText,
  SkTitle,
  SkInput,
  SkButton,
  SkPill,
  SkCircle,
  SkImage,
} from "@/components/ui/Skeleton";

/**
 * Page-level skeleton loading states.
 *
 * Each skeleton mirrors the eventual layout of its page (headers, grid
 * columns, cards, tables) using greyed-out shimmering placeholders instead of
 * a spinner or a blank screen.
 */

// ─── Shared building blocks ──────────────────────────────────────────────────

function HeaderSkeleton({ titleW = "w-52", subW = "w-80", pill = true }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-2.5">
        <Skeleton className={titleW} />
        <Skeleton className={subW} />
      </div>
      {pill && <SkPill className="shrink-0" />}
    </div>
  );
}

function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2.5">
              <SkText className="w-24" />
              <SkTitle className="w-28 h-6" />
            </div>
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function RectCardsSkeleton({ count = 4, cols = 2 }: { count?: number; cols?: 2 | 4 }) {
  const colClass = cols === 4 ? "md:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-2";
  return (
    <div className={`grid grid-cols-1 ${colClass} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-2.5">
              <SkText className="w-24" />
              <SkTitle className="w-24 h-6" />
            </div>
            <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ titleW = "w-36", rows = 4 }: { titleW?: string; rows?: number }) {
  return (
    <Card padding="none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
        <SkTitle className={titleW} />
        <SkText className="w-12" />
      </div>
      <div aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 border-b border-[var(--border-subtle)] last:border-0 px-5 py-4"
          >
            <SkText className="w-1/4" />
            <SkText className="w-1/6" />
            <SkText className="w-1/6" />
            <Skeleton className="h-6 w-20 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ListCardSkeleton({ titleW = "w-36", rows = 3, fixed = false }: { titleW?: string; rows?: number; fixed?: boolean }) {
  return (
    <Card padding="none" className={fixed ? "h-full flex flex-col" : ""}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
        <SkTitle className={titleW} />
        <SkText className="w-12" />
      </div>
      <div className={fixed ? "flex-1" : ""}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-4 border-b border-[var(--border-subtle)] last:border-0 flex flex-col gap-2">
            <SkText className="w-2/5" />
            <SkText className="w-1/3" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function AvatarRowsSkeleton({ rows = 3, pill = false }: { rows?: number; pill?: boolean }) {
  return (
    <div aria-hidden="true" className="divide-y divide-[var(--border-subtle)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <SkCircle className="w-9 h-9 shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <SkText className="w-1/3" />
            <SkText className="w-1/4" />
          </div>
          {pill && <Skeleton className="h-6 w-20 rounded-full ml-auto" />}
          <Skeleton className="h-8 w-20 rounded-lg ml-auto" />
        </div>
      ))}
    </div>
  );
}

function FormCardSkeleton({ titleW = "w-44", fields = 3, button = true }: { titleW?: string; fields?: number; button?: boolean }) {
  return (
    <Card>
      <SkTitle className={`${titleW} mb-5`} />
      <div className="flex flex-col gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <SkInput key={i} />
        ))}
        {button && <SkButton className="w-36 mt-1" />}
      </div>
    </Card>
  );
}

function IdCardFrontSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="flex flex-col gap-1.5">
              <SkText className="w-14" />
              <SkText className="w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
          <div className="min-w-0 flex-1 flex flex-col gap-2.5">
            <SkTitle className="w-3/4" />
            <SkText className="w-1/2" />
            <SkText className="w-1/3" />
          </div>
        </div>
      </div>
    </div>
  );
}

function IdCardBackSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SkText className="w-24" />
        <SkText className="w-20" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex items-center justify-between">
        <SkText className="w-14" />
        <SkText className="w-24" />
      </div>
      <div className="flex items-center justify-between">
        <SkText className="w-12" />
        <SkText className="w-28" />
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <HeaderSkeleton titleW="w-64 h-7" subW="w-40" />

      {/* Bio Data banner */}
      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex flex-col gap-2">
            <SkText className="w-44" />
            <SkText className="w-64" />
          </div>
        </div>
        <Skeleton className="h-8 w-28 rounded-lg shrink-0" />
      </Card>

      {/* Member ID card + elections */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 flex flex-col items-center gap-4">
          <div className="w-full max-w-xs md:max-w-sm flex flex-col gap-3">
            <IdCardFrontSkeleton />
            <IdCardBackSkeleton />
          </div>
          <SkText className="w-28" />
        </div>
        <div className="lg:col-span-3">
          <ListCardSkeleton titleW="w-48" rows={3} fixed />
        </div>
      </div>

      <StatCardsSkeleton count={3} />

      <TableSkeleton titleW="w-40" rows={4} />

      {/* National exco */}
      <div className="flex flex-col gap-3">
        <SkText className="w-28" />
        <div className="flex gap-4">
          <Skeleton className="w-24 h-24 rounded-xl" />
          <Skeleton className="w-24 h-24 rounded-xl" />
          <Skeleton className="w-24 h-24 rounded-xl" />
          <Skeleton className="w-24 h-24 rounded-xl hidden sm:block" />
          <Skeleton className="w-24 h-24 rounded-xl hidden md:block" />
        </div>
      </div>

      {/* Quick links + announcements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ListCardSkeleton titleW="w-28" rows={4} />
        <ListCardSkeleton titleW="w-36" rows={3} />
      </div>
    </div>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <HeaderSkeleton titleW="w-40" subW="w-64" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Identity card */}
        <Card className="flex flex-col items-center text-center gap-4 py-8 px-5">
          <SkCircle className="w-28 h-28" />
          <div className="flex flex-col items-center gap-2">
            <SkTitle className="w-40" />
            <SkPill className="w-24" />
            <SkPill className="w-20" />
          </div>
          <div className="w-full flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkText key={i} className="w-3/4 mx-auto" />
            ))}
          </div>
          <SkText className="w-40 mt-2" />
        </Card>

        {/* Forms column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <SkTitle className="w-36 mb-5" />
            <div className="flex flex-col gap-2 mb-5">
              <SkText className="w-28" />
              <SkText className="w-44" />
              <SkText className="w-40" />
              <SkText className="w-36" />
            </div>
            <div className="flex flex-col gap-4">
              <SkInput />
              <SkInput />
              <SkButton className="w-32 mt-1" />
            </div>
          </Card>
          <Card>
            <SkTitle className="w-48 mb-4" />
            <SkText className="w-72 mb-4" />
            <div className="flex flex-col gap-4">
              <SkInput />
              <SkInput />
              <SkInput />
              <SkButton className="w-40 mt-1" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Bio Data ────────────────────────────────────────────────────────────────

export function BioDataSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <HeaderSkeleton titleW="w-52" subW="w-64" />

      <div className="flex flex-col gap-6">
        {/* Personal details */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Skeleton className="w-5 h-5 rounded-md" />
            <SkTitle className="w-44" />
          </div>
          <div className="flex flex-col gap-4">
            <SkInput />
            <SkInput />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkInput />
              <SkInput />
            </div>
          </div>
        </Card>

        {/* Contact & location */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Skeleton className="w-5 h-5 rounded-md" />
            <SkTitle className="w-52" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkInput />
              <SkInput />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SkInput />
              <SkInput />
              <SkInput />
            </div>
          </div>
        </Card>

        {/* Medical information */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Skeleton className="w-5 h-5 rounded-md" />
            <SkTitle className="w-56" />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <SkInput />
            <SkText className="w-72" />
          </div>
        </Card>

        {/* Professional info */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Skeleton className="w-5 h-5 rounded-md" />
            <SkTitle className="w-48" />
          </div>
          <div className="flex flex-col gap-4">
            <SkInput />
            <SkInput />
          </div>
        </Card>

        {/* Section I — declaration & consent */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="w-5 h-5 rounded-md" />
            <SkTitle className="w-64" />
          </div>
          <SkText className="w-80 mb-4" />
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <SkText className="w-4 h-4 mt-0.5" />
              <div className="flex flex-col gap-2 flex-1">
                <SkText className="w-full" />
                <SkText className="w-5/6" />
              </div>
            </div>
            <Skeleton className="h-px w-full" />
            <div className="flex items-start gap-3">
              <SkText className="w-4 h-4 mt-0.5" />
              <div className="flex flex-col gap-2 flex-1">
                <SkText className="w-full" />
                <SkText className="w-5/6" />
              </div>
            </div>
          </div>
        </Card>

        {/* Submit bar */}
        <Card padding="md" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-2 max-w-md">
            <Skeleton className="w-6 h-6 rounded-md shrink-0 mt-0.5" />
            <div className="flex flex-col gap-2 flex-1">
              <SkText className="w-72" />
              <SkText className="w-52" />
            </div>
          </div>
          <SkButton className="w-40 shrink-0" />
        </Card>
      </div>
    </div>
  );
}

// ─── ID Card ─────────────────────────────────────────────────────────────────

export function IdCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center flex flex-col items-center gap-2">
        <Skeleton className="w-64 h-8" />
        <Skeleton className="w-80 h-4" />
        <Skeleton className="w-56 h-4" />
      </div>

      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <SkButton className="w-36" />
        <SkButton className="w-44" />
      </div>
    </div>
  );
}

// ─── Admin panel ─────────────────────────────────────────────────────────────

export function AdminSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <HeaderSkeleton titleW="w-48" subW="w-72" pill={false} />

      <RectCardsSkeleton count={4} cols={4} />

      {/* Pending members */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <SkTitle className="w-44" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <AvatarRowsSkeleton rows={3} />
      </Card>

      {/* Broadcast compose + sent list */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Skeleton className="w-5 h-5 rounded-md" />
              <SkTitle className="w-52" />
            </div>
            <div className="flex flex-col gap-4">
              <SkInput />
              <Skeleton className="h-28 w-full rounded-lg" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
              <SkInput />
              <SkButton className="w-32 mt-1" />
            </div>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <ListCardSkeleton titleW="w-32" rows={4} fixed />
        </div>
      </div>

      {/* Elections & exco */}
      <div className="flex flex-col gap-6">
        <SkTitle className="w-56 h-6" />
        <div className="flex gap-4">
          <Skeleton className="w-28 h-28 rounded-xl" />
          <Skeleton className="w-28 h-28 rounded-xl" />
          <Skeleton className="w-28 h-28 rounded-xl hidden sm:block" />
          <Skeleton className="w-28 h-28 rounded-xl hidden md:block" />
          <Skeleton className="w-28 h-28 rounded-xl hidden lg:block" />
        </div>
        <ListCardSkeleton titleW="w-44" rows={3} />
        <ListCardSkeleton titleW="w-40" rows={3} />
      </div>
    </div>
  );
}

// ─── Admin settings ──────────────────────────────────────────────────────────

export function AdminSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <HeaderSkeleton titleW="w-52" subW="w-72" pill={false} />

      <div className="flex flex-col gap-6">
        <Card>
          <SkTitle className="w-36 mb-5" />
          <div className="flex flex-col gap-4">
            <SkInput />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkInput />
              <SkInput />
            </div>
            <SkInput />
            <Skeleton className="h-20 w-full rounded-lg" />
            <SkButton className="w-32 mt-1" />
          </div>
        </Card>
        <Card>
          <SkTitle className="w-48 mb-4" />
          <SkText className="w-80 mb-4" />
          <div className="flex flex-col gap-4">
            <SkInput />
            <SkInput />
            <SkInput />
            <SkButton className="w-40 mt-1" />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Elections ───────────────────────────────────────────────────────────────

export function ElectionsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <HeaderSkeleton titleW="w-64" subW="w-56" pill={false} />

      {/* Open positions */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SkTitle className="w-48" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <div className="flex flex-col gap-2.5">
                <SkTitle className="w-3/4" />
                <SkText className="w-1/2" />
                <SkText className="w-2/3" />
              </div>
              <Skeleton className="h-9 w-28 rounded-lg mt-4" />
            </Card>
          ))}
        </div>
      </div>

      {/* My applications */}
      <ListCardSkeleton titleW="w-40" rows={3} />

      {/* How it works */}
      <Card>
        <SkTitle className="w-36 mb-3" />
        <div className="flex flex-col gap-2">
          <SkText className="w-full" />
          <SkText className="w-11/12" />
          <SkText className="w-2/3" />
        </div>
      </Card>
    </div>
  );
}

// ─── Payments ────────────────────────────────────────────────────────────────

export function PaymentsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <HeaderSkeleton titleW="w-56" subW="w-72" pill={false} />

      <StatCardsSkeleton count={3} />

      <Card>
        <SkTitle className="w-40 mb-3" />
        <SkText className="w-3/4 mb-4" />
        <SkButton className="w-44" />
        <SkText className="w-64 mt-3" />
      </Card>

      <TableSkeleton titleW="w-44" rows={3} />
      <TableSkeleton titleW="w-52" rows={3} />
    </div>
  );
}

// ─── Public: member profile (/members/[id]) ─────────────────────────────────

export function MemberPageSkeleton() {
  return (
    <>
      <Navbar variant="public" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col gap-6">
          <SkText className="w-24" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="flex flex-col items-center text-center gap-4 py-8 px-5 self-start">
              <SkCircle className="w-24 h-24" />
              <div className="flex flex-col items-center gap-2">
                <SkTitle className="w-40" />
                <SkText className="w-24" />
              </div>
              <div className="flex gap-2">
                <SkPill className="w-20" />
              </div>
              <div className="w-full flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkText key={i} className="w-4/5 mx-auto" />
                ))}
              </div>
            </Card>

            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card>
                <SkTitle className="w-24 mb-3" />
                <div className="flex flex-col gap-2">
                  <SkText className="w-full" />
                  <SkText className="w-11/12" />
                  <SkText className="w-3/4" />
                </div>
              </Card>
              <Card padding="none">
                <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                  <SkTitle className="w-28" />
                </div>
                <div aria-hidden="true" className="flex flex-col">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-subtle)] last:border-0">
                      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                      <div className="flex flex-col gap-2 flex-1">
                        <SkText className="w-1/3" />
                        <SkText className="w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <SkTitle className="w-32 mb-4" />
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="aspect-square rounded-xl" />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// ─── Public: set detail (/sets/[id]) ─────────────────────────────────────────

export function SetDetailSkeleton() {
  return (
    <>
      <Navbar variant="public" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col gap-10">
          {/* Intro */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-2">
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              <Skeleton className="h-6 w-40 mt-3 mx-auto rounded-md" />
            </div>
            <div className="lg:col-span-3 flex flex-col gap-3">
              <SkText className="w-32" />
              <Skeleton className="h-9 w-64" />
              <SkText className="w-52" />
              <SkText className="w-full mt-2" />
              <SkText className="w-5/6" />
              <SkText className="w-2/3" />
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card padding="none">
                <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                  <SkTitle className="w-28" />
                </div>
                <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="aspect-square rounded-xl" />
                </div>
              </Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <SkCircle className="w-12 h-12 shrink-0" />
                        <div className="flex flex-col gap-2 min-w-0">
                          <SkText className="w-28" />
                          <SkText className="w-20" />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <Card>
                <SkTitle className="w-40 mb-3" />
                <SkText className="w-full" />
                <SkText className="w-3/4" />
                <SkButton className="w-full mt-4" />
              </Card>
              <Card>
                <SkTitle className="w-40 mb-3" />
                <div className="flex flex-col gap-2.5">
                  <SkText className="w-1/2" />
                  <SkText className="w-3/5" />
                  <SkText className="w-1/3" />
                </div>
              </Card>
              <Card>
                <SkTitle className="w-36 mb-3" />
                <SkText className="w-full" />
                <SkText className="w-2/3" />
                <SkButton className="w-full mt-4" />
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// ─── Public: all sets grid (/sets) — inline after the page header ────────────

export function SetsGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-hidden="true">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card flex flex-col overflow-hidden">
          <Skeleton className="aspect-[3/4] w-full rounded-none border-0" />
          <div className="p-5 flex flex-col gap-2.5">
            <Skeleton className="h-5 w-2/3 rounded-md" />
            <SkText className="w-1/3" />
            <SkText className="w-full mt-1" />
            <SkText className="w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Public: login / register (Suspense fallback) ────────────────────────────

export function LoginSkeleton() {
  return (
    <>
      <Navbar variant="public" />
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[850px] flex flex-col gap-3">
          <Skeleton className="h-[460px] w-full rounded-3xl" />
        </div>
      </main>
      <Footer />
    </>
  );
}

// ─── Public: verify payment (Suspense fallback) ──────────────────────────────

export function VerifyPaymentSkeleton() {
  return (
    <>
      <Navbar variant="public" />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="card max-w-md w-full p-8 text-center flex flex-col items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full" />
          <Skeleton className="h-7 w-48" />
          <SkText className="w-80" />
          <SkText className="w-64" />
        </div>
      </main>
      <Footer />
    </>
  );
}

// ─── Shared: admin panel bodies ──────────────────────────────────────────────

/** Table body with avatar rows (Pending Members / Election Review panels). */
export function PanelRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return <AvatarRowsSkeleton rows={rows} pill />;
}

/** Full Exco assignment panel placeholder. */
export function ExcoAssignSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <FormCardSkeleton titleW="w-48" fields={3} button />
      <ListCardSkeleton titleW="w-36" rows={3} />
    </div>
  );
}

/** Set management panel body placeholder. */
export function SetManageSkeleton() {
  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
        <SkTitle className="w-52" />
        <SkText className="w-64 mt-1.5" />
      </div>
      <div className="p-5 flex flex-col gap-6">
        <SkInput />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <SkButton className="w-40" />
          </div>
          <div className="flex flex-col gap-3">
            <SkTitle className="w-32" />
            <SkText className="w-full" />
            <SkText className="w-4/5" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <SkButton className="w-32" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SkText className="w-24" />
            <SkButton className="w-28 h-9" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton className="aspect-[3/4] rounded-lg" />
            <Skeleton className="aspect-[3/4] rounded-lg" />
            <Skeleton className="aspect-[3/4] rounded-lg hidden sm:block" />
            <Skeleton className="aspect-[3/4] rounded-lg hidden sm:block" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Dashboard / home strip placeholders ─────────────────────────────────────

/** Bio Data banner on the dashboard. */
export function BioBannerSkeleton() {
  return (
    <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex flex-col gap-2">
          <SkText className="w-44" />
          <SkText className="w-64" />
        </div>
      </div>
      <Skeleton className="h-8 w-28 rounded-lg shrink-0" />
    </Card>
  );
}

/** Auto-rotating set spotlight on the home page. */
export function SetStripSkeleton() {
  return (
    <div className="card p-6 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
        <div className="flex flex-col gap-3 max-w-xl">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-8 w-56" />
          <SkText className="w-full" />
          <SkText className="w-3/4" />
          <div className="flex items-center justify-between mt-2">
            <SkText className="w-24" />
            <SkText className="w-20" />
          </div>
        </div>
        <Skeleton className="w-full md:w-56 aspect-[4/3] rounded-2xl" />
      </div>
      <div className="flex items-center justify-center gap-4 mt-6">
        <Skeleton className="w-10 h-10 rounded-full" />
        <SkText className="w-16" />
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>
    </div>
  );
}

// Keep the imports used so lint doesn't flag them in shorter consumers.
export { Skeleton as _Skeleton };