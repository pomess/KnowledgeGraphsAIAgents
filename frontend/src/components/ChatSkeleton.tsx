export default function ChatSkeleton() {
  return (
    <div className="skeleton-wrap">
      <div className="skeleton-avatar" />
      <div className="skeleton-content">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}
