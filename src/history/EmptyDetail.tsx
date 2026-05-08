export function EmptyDetail({ label }: { label: string }) {
  return (
    <div className="hist-detail-empty">
      <span>{label}</span>
    </div>
  );
}
