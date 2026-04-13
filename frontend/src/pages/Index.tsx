import { FolderOpen, Info, Sword, TrendingUp } from "lucide-react";
import CombinedAnalysisPanel from "@/components/CombinedAnalysisPanel";

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="fixed inset-0 opacity-5 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')]" />

      <main className="relative z-10 py-10 sm:py-16">
        <div className="container mx-auto px-4 sm:px-8 mb-10 sm:mb-12">
          <header className="text-center">
            <h1
              className="font-pixel text-5xl sm:text-6xl md:text-8xl text-primary mb-4"
              style={{ textShadow: "4px 4px 0px hsl(120 48% 20%)" }}
            >
              JSON CRAFT
            </h1>
            <p className="font-mono text-sm text-muted-foreground max-w-[60ch] mx-auto leading-relaxed mb-8 sm:mb-10">
              Import player stats, advancements, and player data (.dat) together for one combined report with synced
              health, inventory, and world context.
            </p>
          </header>

          <section className="max-w-[800px] mx-auto">
            <div className="mc-panel-outset">
              <div className="mc-panel-header flex items-center gap-2">
                <Info className="w-4 h-4" />
                Where to find your files
              </div>
              <div className="mc-panel-inset p-6">
                <div className="space-y-5">
                  <div>
                    <p className="font-pixel text-sm text-primary mb-1 flex items-center gap-2">
                      <Sword className="w-4 h-4" /> Player stats file
                    </p>
                    <code className="font-mono text-xs text-muted-foreground break-all">
                      {`C:\\Users\\<user>\\AppData\\Roaming\\.minecraft\\saves\\<world>\\stats\\<uuid>.json`}
                    </code>
                  </div>

                  <div>
                    <p className="font-pixel text-sm text-primary mb-1 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" /> Advancements file
                    </p>
                    <code className="font-mono text-xs text-muted-foreground break-all">
                      {`C:\\Users\\<user>\\AppData\\Roaming\\.minecraft\\saves\\<world>\\advancements\\<uuid>.json`}
                    </code>
                  </div>

                  <div>
                    <p className="font-pixel text-sm text-primary mb-1 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Player data file
                    </p>
                    <code className="font-mono text-xs text-muted-foreground break-all">
                      {`C:\\Users\\<user>\\AppData\\Roaming\\.minecraft\\saves\\<world>\\playerdata\\<uuid>.dat`}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="w-full min-w-0 px-2 sm:px-3 md:px-4 lg:px-5 mb-12 sm:mb-16">
          <CombinedAnalysisPanel />
        </div>
      </main>
    </div>
  );
};

export default Index;
