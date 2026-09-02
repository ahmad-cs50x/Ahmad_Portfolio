"use client";

import { useEffect, useState } from "react";

export default function TypeWriter({
  words,
  typeSpeed = 80,
  deleteSpeed = 45,
  pause = 1600,
}) {
  const [index, setIndex] = useState(0);
  const [sub, setSub] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[index % words.length];
    let timer;

    if (!deleting && sub < word.length) {
      timer = setTimeout(() => setSub(sub + 1), typeSpeed);
    } else if (!deleting && sub === word.length) {
      timer = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && sub > 0) {
      timer = setTimeout(() => setSub(sub - 1), deleteSpeed);
    } else {
      timer = setTimeout(() => {
        setDeleting(false);
        setIndex((index + 1) % words.length);
      }, 350);
    }

    return () => clearTimeout(timer);
  }, [sub, deleting, index, words, typeSpeed, deleteSpeed, pause]);

  return (
    <span>
      {words[index % words.length].substring(0, sub)}
      <span className="animate-pulse text-cyan-400">|</span>
    </span>
  );
}
