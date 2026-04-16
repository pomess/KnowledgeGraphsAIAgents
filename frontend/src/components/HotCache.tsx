import { useState, useEffect } from "react";
import { fetchHot } from "../lib/api";

export default function HotCache() {
  const [hot, setHot] = useState<string>("");

  useEffect(() => {
    fetchHot().then((data) => setHot(data.content || "")).catch(() => {});
  }, []);

  if (!hot) return null;

  const statsMatch = hot.match(/> (.+)/);
  const stats = statsMatch ? statsMatch[1] : "";

  return (
    <div
      style={{
        fontSize: 11,
        color: "var(--text-muted)",
        padding: "8px 12px",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      {stats}
    </div>
  );
}
