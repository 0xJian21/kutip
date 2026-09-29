import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { PaymentFlip } from "./payment-flip";
import dashboardLight from "@/public/landing/dashboard-light.png";
import dashboardDark from "@/public/landing/dashboard-dark.png";
import payLight from "@/public/landing/pay-light.png";
import payDark from "@/public/landing/pay-dark.png";

/** Both themes ship; the page's data-theme picks one (the dark variant is attribute-based). */
function Themed({ light, dark, alt, sizes, priority = false }: { light: typeof dashboardLight; dark: typeof dashboardLight; alt: string; sizes: string; priority?: boolean }) {
  return (
    <>
      <Image src={light} alt={alt} sizes={sizes} priority={priority} placeholder="blur" className="block h-auto w-full dark:hidden" />
      <Image src={dark} alt="" aria-hidden="true" sizes={sizes} placeholder="blur" className="hidden h-auto w-full dark:block" />
    </>
  );
}

/**
 * Landing hero: the promise on the left; on the right the real product (the owner's Overview
 * and the buyer's pay page, screenshots of the live app) with one payment settling at the speed
 * it really did on mainnet.
 */
export function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-10 lg:pb-28 lg:pt-16">
      <div>
        <h1 className="max-w-[13ch] text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em] text-ink sm:text-6xl lg:text-[4.25rem]">
          Overseas invoices, paid in seconds.
        </h1>
        <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-ink-2">
          Kutip emails the invoice, chases your buyer in their own time zone, and lands the money in a treasury only you control. Made for Malaysian exporters selling on 30 to 60 day terms.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/onboarding" className={buttonClass("primary", "lg")}>Get started</Link>
          <Link href="/pay/inv_demo" className={buttonClass("ghost", "lg")}>
            See it live <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-5 text-sm text-ink-3">No seed phrase. No exchange account. No ringgit ever touches Kutip.</p>
      </div>

      <div className="relative lg:pl-6">
        <div className="relative pb-10 sm:pb-14">
        {/* The owner's side: the Overview, in a quiet window frame. */}
        <figure className="animate-rise overflow-hidden rounded-xl bg-surface shadow-float ring-1 ring-line">
          <div className="flex items-center gap-2 border-b border-line bg-paper-2/70 px-3.5 py-2">
            <span className="h-2 w-2 rounded-full bg-line-strong" />
            <span className="mx-auto rounded-full bg-surface px-3 py-0.5 text-[11px] tabular text-ink-3 ring-1 ring-line">kutip-app.vercel.app/dashboard</span>
            <span className="h-2 w-2" />
          </div>
          <Themed light={dashboardLight} dark={dashboardDark} alt="Kutip's Overview: received this month, outstanding and overdue in ringgit, the collections funnel and the treasury card" sizes="(min-width: 1024px) 620px, 100vw" priority />
        </figure>

        {/* The buyer's side: the pay page on a phone, in front. */}
        <figure className="animate-rise absolute -bottom-2 right-2 w-[34%] min-w-[124px] max-w-[210px] overflow-hidden rounded-[1.6rem] bg-surface p-1.5 shadow-float ring-1 ring-line-strong [animation-delay:220ms] sm:right-6 lg:-right-4">
          <div className="overflow-hidden rounded-[1.2rem]">
            <Themed light={payLight} dark={payDark} alt="The buyer's pay page on a phone: the invoice, the amount due and Confirm and pay" sizes="210px" />
          </div>
        </figure>

        </div>

        {/* One payment, flipping at its real mainnet speed. Under the picture on phones, over its corner from 640px. */}
        <PaymentFlip className="animate-rise relative mx-auto mt-4 [animation-delay:420ms] sm:absolute sm:bottom-0 sm:left-3 sm:mx-0 sm:mt-0 lg:-left-8" />
      </div>
    </section>
  );
}
