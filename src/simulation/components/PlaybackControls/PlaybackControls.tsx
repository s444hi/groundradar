import type { PlaybackApi } from "../Timeline/usePlayback";

export interface PlaybackControlsProps {
  playback: PlaybackApi;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "20px",
};

const buttonStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontSize: "12px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-pill)",
  padding: "5px 14px",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};

// Shared across all 3 lanes (one usePlayback clock), so this sits once above
// them instead of duplicated inside every Timeline.
export default function PlaybackControls({ playback }: PlaybackControlsProps) {
  return (
    <div style={rowStyle}>
      <button style={buttonStyle} onClick={() => (playback.isPlaying ? playback.pause() : playback.play())}>
        {playback.isPlaying ? "Pause" : "Play"}
      </button>
      <button style={buttonStyle} onClick={playback.replay}>
        Replay
      </button>
    </div>
  );
}
