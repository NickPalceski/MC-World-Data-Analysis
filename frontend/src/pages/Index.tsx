import { Link } from "react-router-dom";
import { Sword, Globe, TrendingUp, FolderOpen, Info } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Noise overlay */}
      <div className="fixed inset-0 opacity-5 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')]" />

      <main className="container mx-auto px-8 py-16 relative z-10">
        {/* Hero */}
        <header className="text-center mb-16">
          <h1 className="font-pixel text-6xl md:text-8xl text-primary mb-4" style={{ textShadow: '4px 4px 0px hsl(120 48% 20%)' }}>
            JSON CRAFT
          </h1>
          <p className="font-mono text-sm text-muted-foreground max-w-[60ch] mx-auto leading-relaxed">
            Import any Minecraft player, world, or achievement files to be transformed into meaningful insights on your journeys!
          </p>
        </header>

        {/* Navigation Grid */}
        <nav className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1000px] mx-auto">
          <Link to="/player" className="mc-button py-12 px-8 flex flex-col items-center gap-4 group">
            <Sword className="w-10 h-10 text-mc-text-dark" />
            <span className="font-pixel text-3xl text-mc-text-dark">Player Analysis</span>
            <span className="font-mono text-xs text-mc-text-dark opacity-70">
              K/D, Distance Traveled, & Most Mined Block
            </span>
          </Link>

          <Link to="/world" className="mc-button py-12 px-8 flex flex-col items-center gap-4 group">
            <Globe className="w-10 h-10 text-mc-text-dark" />
            <span className="font-pixel text-3xl text-mc-text-dark">World Analysis</span>
            <span className="font-mono text-xs text-mc-text-dark opacity-70">
              World Map & Mining Heatmaps
            </span>
          </Link>

          <Link to="/progression" className="mc-button py-12 px-8 flex flex-col items-center gap-4 group">
            <TrendingUp className="w-10 h-10 text-mc-text-dark" />
            <span className="font-pixel text-3xl text-mc-text-dark">Progression</span>
            <span className="font-mono text-xs text-mc-text-dark opacity-70">
              Inventory, Player Movement, & Advancements
            </span>
          </Link>
        </nav>

        {/* Footer accent */}
        <div className="mt-16 text-center">
          <p className="font-pixel text-sm text-muted-foreground animate-pulse-glow">
            &gt; CHOOSE DATA ANALYSIS OPTION...
          </p>
        </div>

        {/* Helpful Tips */}
        <section className="mt-12 max-w-[800px] mx-auto">
          <div className="mc-panel-outset">
            <div className="mc-panel-header flex items-center gap-2">
              <Info className="w-4 h-4" />
              Where To Find Your Files
            </div>
            <div className="mc-panel-inset p-6">
              <div className="space-y-5">
                <div>
                  <p className="font-pixel text-sm text-primary mb-1 flex items-center gap-2">
                    <Sword className="w-4 h-4" /> Player Stats File
                  </p>
                  <code className="font-mono text-xs text-muted-foreground break-all">
                    C:\Users\&lt;user&gt;\AppData\Roaming\.minecraft\saves\&lt;world&gt;\stats\&lt;json file&gt;
                  </code>
                </div>

                <div>
                  <p className="font-pixel text-sm text-primary mb-1 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> World Data Folder
                  </p>
                  <code className="font-mono text-xs text-muted-foreground break-all">
                    C:\Users\&lt;user&gt;\AppData\Roaming\.minecraft\saves\&lt;world&gt;\region\
                  </code>
                </div>

                <div>
                  <p className="font-pixel text-sm text-primary mb-1 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" /> Advancements File
                  </p>
                  <code className="font-mono text-xs text-muted-foreground break-all">
                    C:\Users\&lt;user&gt;\AppData\Roaming\.minecraft\saves\&lt;world&gt;\advancements\&lt;json file&gt;
                  </code>
                </div>

                <div>
                  <p className="font-pixel text-sm text-primary mb-1 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Player Data File
                  </p>
                  <code className="font-mono text-xs text-muted-foreground break-all">
                    C:\Users\&lt;user&gt;\AppData\Roaming\.minecraft\saves\&lt;world&gt;\playerdata\&lt;dat file&gt;
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
