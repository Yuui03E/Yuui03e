export default function ProfileLoading() {
  return (
    <div className="p-8 space-y-6 h-full overflow-y-auto">
      <div className="h-16 glass bg-yuui-surface/20 border border-white/[0.05] rounded-3xl animate-pulse" />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-96 glass bg-yuui-surface/20 border border-white/[0.05] rounded-3xl animate-pulse" />
        <div className="h-96 glass bg-yuui-surface/20 border border-white/[0.05] rounded-3xl animate-pulse" />
      </div>
    </div>
  );
}
