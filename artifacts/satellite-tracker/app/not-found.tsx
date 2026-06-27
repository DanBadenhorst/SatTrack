import Link from "next/link";
import { Satellite } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 mb-6">
          <Satellite className="w-8 h-8 text-slate-500" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">404</h1>
        <p className="text-slate-400 mb-6">This page is out of orbit.</p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg bg-space-600 hover:bg-space-700 text-white font-medium transition-colors"
        >
          Return to ground control
        </Link>
      </div>
    </div>
  );
}
