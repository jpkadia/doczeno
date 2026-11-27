import { AlertTriangle } from "lucide-react";

export default function CustomDomainNotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Domain Not Configured</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            This domain is not currently linked to an active website, or access to the requested path is restricted.
          </p>
        </div>
        <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
          Please contact your website administrator.
        </p>
      </div>
    </div>
  );
}
