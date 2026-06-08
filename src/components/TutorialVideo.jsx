import React, { useState } from 'react';

export default function TutorialVideo() {
  const [error, setError] = useState(false);

  if (error) {
    return <p className="tutorial-video-fallback">Playback unavailable — here's how it works:</p>;
  }

  return (
    <video
      className="tutorial-video"
      controls
      preload="metadata"
      poster="/tutorial-poster-v1.jpg"
      onError={() => setError(true)}
    >
      <source src="/tutorial-v1.mp4" type="video/mp4" />
      <track kind="captions" src="/tutorial-captions-v1.vtt" srcLang="en" label="English" default />
    </video>
  );
}
