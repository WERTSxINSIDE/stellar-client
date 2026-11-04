export default function Loading() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-[#0a0710] text-white">
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" />
        <span className="absolute inset-3 rounded-full bg-purple-500/20 animate-pulse" />
      </div>
      <p className="text-sm text-white/40 tracking-widest uppercase">Loading</p>
    </div>
  );
}
