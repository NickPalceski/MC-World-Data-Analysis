import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, FolderOpen } from "lucide-react";
import { uploadMultipleFiles } from "@/lib/api";

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
              <div className="flex-1 font-mono text-sm tabular-nums">{renderValue(val, depth + 1)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
};

const WorldAnalysis = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [analysisResult, setAnalysisResult] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDirectoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setError("");
    setAnalysisResult(null);
    const mcaFiles = Array.from(fileList).filter((f) => f.name.endsWith(".mca"));

    if (mcaFiles.length === 0) {
      setError("NO_MCA_FILES: No .mca region files found in the selected folder.");
      setFiles([]);
      return;
    }

    setFiles(mcaFiles);

    setIsLoading(true);
    try {
      const result = await uploadMultipleFiles("/world", "files", mcaFiles);
      setAnalysisResult(result);
    } catch (uploadError) {
      setError(`API_ERROR: ${(uploadError as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <nav className="bg-mc-inset border-b-4 border-border px-6 py-3 flex items-center gap-6">
        <Link to="/" className="mc-button py-2 px-4 text-sm flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <span className="font-pixel text-xl text-foreground tracking-wider">WORLD_ANALYSIS.PY</span>
      </nav>

      <main className="container mx-auto px-8 py-8">
        {/* Upload Zone */}
        <section className="mb-8">
          <div className="mc-panel-inset p-8 text-center">
            <FolderOpen className="w-10 h-10 text-primary mx-auto mb-4" />
            <p className="font-pixel text-lg text-foreground mb-4">
              Select region folder to begin analysis
            </p>
            <p className="font-mono text-xs text-muted-foreground mb-6">
              Import your world's region folder containing .mca files
            </p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleDirectoryUpload}
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mc-button py-3 px-8 inline-flex items-center gap-3"
            >
              <Upload className="w-5 h-5" />
              Import Region Folder
            </button>
            {files.length > 0 && (
              <p className="font-mono text-xs text-primary mt-4">
                &gt; Loaded {files.length} .mca file{files.length !== 1 ? "s" : ""}
              </p>
            )}
            {error && (
              <p className="font-mono text-xs text-destructive mt-4">{error}</p>
            )}
          </div>
        </section>

        {/* Results Zone */}
        <section>
          <div className="mc-panel-outset">
            <div className="mc-panel-header">Analysis Output</div>
            <div className="mc-panel-inset min-h-[400px] p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">
                    Running analysis...
                  </span>
                </div>
              ) : analysisResult ? (
                <div className="font-mono text-sm">{renderValue(analysisResult)}</div>
              ) : files.length > 0 ? (
                <div className="font-mono text-sm">
                  <div className="mb-4">
                    <span className="font-pixel text-foreground uppercase text-sm">Region Files Loaded:</span>
                  </div>
                  {files.map((file, i) => (
                    <div key={i} className="flex gap-3 py-2 border-b border-border/30">
                      <span className="text-muted-foreground min-w-[2rem]">[{i}]</span>
                      <span className="text-primary">{file.name}</span>
                      <span className="text-muted-foreground ml-auto">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">
                    No data loaded. Waiting for input...
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

export default WorldAnalysis;
