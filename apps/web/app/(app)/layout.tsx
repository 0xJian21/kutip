import { cookies } from "next/headers";
import { CommandPalette } from "@/components/agent/command-palette";
import { SideNav, TopBar } from "@/components/shell/nav";
import { RAIL_COOKIE } from "@/lib/ui/rail";
import { ownerData } from "@/lib/server/data";
import { Providers } from "@/app/providers";

// Privy lives here and on onboarding only: the landing and pay pages never load it.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [data, jar] = await Promise.all([ownerData(), cookies()]);
  const exporter = await data.getExporter();
  return (
    <Providers>
      <div className="flex min-h-full flex-1 flex-col lg:flex-row">
        <SideNav exporterName={exporter.name} ownerName={exporter.ownerName} logoUrl={exporter.logoUrl} initialCollapsed={jar.get(RAIL_COOKIE)?.value === "collapsed"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar exporterName={exporter.name} ownerName={exporter.ownerName} logoUrl={exporter.logoUrl} />
          <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
        </div>
        <CommandPalette />
      </div>
    </Providers>
  );
}
