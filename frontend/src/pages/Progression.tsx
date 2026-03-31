import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, FileJson, FileArchive } from "lucide-react";
import { uploadProgressionFiles } from "@/lib/api";
import { extractUuidFromFilename, getPlayerAvatarUrls, getPlayerUsername } from "@/lib/playerAvatar";

const renderValue = (value: unknown, depth = 0): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className={value ? "text-primary" : "text-destructive"}>{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-accent">{value}</span>;
  }
  if (typeof value === "string") {
    return <span className="text-primary">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[ ]</span>;
    return (
      <div className="ml-4">
        {value.map((item, i) => (
          <div key={i} className="flex gap-2 py-1 border-b border-border/30">
            <span className="text-muted-foreground font-mono text-xs min-w-[2rem]">[{i}]</span>
            <div className="flex-1">{renderValue(item, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div className={depth > 0 ? "ml-4" : ""}>
        {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
          <div key={key} className="py-2 border-b border-border/30">
            <div className="flex gap-3 items-start">
              <span className="font-pixel text-foreground uppercase text-sm min-w-[120px] shrink-0">
                {key}:
              </span>
              <div className="flex-1 font-mono text-sm tabular-nums">
                {renderValue(val, depth + 1)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
};

const Progression = () => {
  const [analysisResult, setAnalysisResult] = useState<unknown>(null);
  const [advancementsFile, setAdvancementsFile] = useState<File | null>(null);
  const [datFile, setDatFile] = useState<File | null>(null);
  const [advancementsName, setAdvancementsName] = useState("");
  const [datName, setDatName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [playerName, setPlayerName] = useState("Unknown Player");
  const advRef = useRef<HTMLInputElement>(null);
  const datRef = useRef<HTMLInputElement>(null);

  const playerUuid = extractUuidFromFilename(datName) ?? extractUuidFromFilename(advancementsName);
  const avatarCandidates = playerUuid ? getPlayerAvatarUrls(playerUuid, 120) : null;

  const handleAdvancementsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setError("FILE_ERROR: Advancements file must be .json");
      return;
    }

    setAdvancementsName(file.name);
    setAdvancementsFile(file);
    setAnalysisResult(null);
    setAvatarIndex(0);
    setError("");
  };

  const handleDatUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".dat")) {
      setError("FILE_ERROR: Player data file must be .dat");
      return;
    }

    setDatName(file.name);
    setDatFile(file);
    setAnalysisResult(null);
    setAvatarIndex(0);
    setError("");
  };

  const bothLoaded = advancementsFile !== null && datFile !== null;

  useEffect(() => {
    if (!bothLoaded || !advancementsFile || !datFile) {
      return;
    }

    const runAnalysis = async () => {
      setIsLoading(true);
      setError("");

      try {
        const result = await uploadProgressionFiles(advancementsFile, datFile);
        setAnalysisResult(result);
      } catch (uploadError) {
        setError(`API_ERROR: ${(uploadError as Error).message}`);
        setAnalysisResult(null);
      } finally {
        setIsLoading(false);
      }
    };

    runAnalysis();
  }, [bothLoaded, advancementsFile, datFile]);

  useEffect(() => {
    let isActive = true;

    if (!playerUuid) {
      setPlayerName("Unknown Player");
      return () => {
        isActive = false;
      };
    }

    setPlayerName("Loading...");
    getPlayerUsername(playerUuid)
      .then((resolvedName) => {
        if (isActive) {
          setPlayerName(resolvedName ?? "Unknown Player");
        }
      })
      .catch(() => {
        if (isActive) {
          setPlayerName("Unknown Player");
        }
      });

    return () => {
      isActive = false;
    };
  }, [playerUuid]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <nav className="bg-mc-inset border-b-4 border-border px-6 py-3 flex items-center gap-6">
        <Link to="/" className="mc-button py-2 px-4 text-sm flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <span className="font-pixel text-xl text-foreground tracking-wider">PROGRESSION.PY</span>
      </nav>

      <main className="container mx-auto px-8 py-8">
        {/* Upload Zone */}
        <section className="mb-8">
          <div className="mc-panel-inset p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Advancements JSON */}
              <div className="text-center">
                <FileJson className="w-10 h-10 text-primary mx-auto mb-4" />
                <p className="font-pixel text-lg text-foreground mb-2">Advancements File</p>
                <p className="font-mono text-xs text-muted-foreground mb-4">.json format</p>
                <input
                  ref={advRef}
                  type="file"
                  accept=".json"
                  onChange={handleAdvancementsUpload}
                  className="hidden"
                />
                <button
                  onClick={() => advRef.current?.click()}
                  className="mc-button py-3 px-6 inline-flex items-center gap-2 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Import JSON
                </button>
                {advancementsName && (
                  <p className="font-mono text-xs text-primary mt-3">
                    &gt; {advancementsName}
                  </p>
                )}
              </div>

              {/* Player Data .dat */}
              <div className="text-center">
                <FileArchive className="w-10 h-10 text-primary mx-auto mb-4" />
                <p className="font-pixel text-lg text-foreground mb-2">Player Data File</p>
                <p className="font-mono text-xs text-muted-foreground mb-4">.dat format</p>
                <input
                  ref={datRef}
                  type="file"
                  accept=".dat"
                  onChange={handleDatUpload}
                  className="hidden"
                />
                <button
                  onClick={() => datRef.current?.click()}
                  className="mc-button py-3 px-6 inline-flex items-center gap-2 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Import DAT
                </button>
                {datName && (
                  <p className="font-mono text-xs text-primary mt-3">
                    &gt; {datName}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <p className="font-mono text-xs text-destructive mt-4 text-center">{error}</p>
            )}
          </div>
        </section>

        {/* Results Zone */}
        <section>
          <div className="mc-panel-outset">
            <div className="mc-panel-header">Progression Output</div>
            <div className="mc-panel-inset min-h-[400px] p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">
                    Running analysis...
                  </span>
                </div>
              ) : analysisResult ? (
                <div className="space-y-8">
                  {avatarCandidates && (
                    <div className="mc-panel-inset p-4 flex items-center gap-4">
                      <img
                        src={avatarCandidates[Math.min(avatarIndex, avatarCandidates.length - 1)]}
                        alt="Player avatar"
                        className="w-16 h-16 border border-border bg-mc-inset"
                        style={{ imageRendering: "pixelated" }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          setAvatarIndex((currentIndex) =>
                            currentIndex < avatarCandidates.length - 1 ? currentIndex + 1 : currentIndex,
                          );
                        }}
                      />
                      <div>
                        <p className="font-pixel text-lg text-foreground">{playerName}</p>
                        <p className="font-mono text-xs text-muted-foreground">Player Profile</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="font-pixel text-lg text-foreground mb-4 border-b border-border pb-2">
                      Backend Output
                    </h3>
                    <div className="font-mono text-sm">
                      {renderValue(analysisResult)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">
                    {!advancementsFile && !datFile
                      ? "Import both files to begin analysis..."
                      : "Waiting for remaining file..."}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Progression;
