"use client";

import { useState, useEffect } from "react";
import DownloadAnimation3D from "./DownloadAnimation3D";

export default function DownloadAnimationWrapper({ isOpen, onClose, onDownloadStart }) {
  const [wrapperOpen, setWrapperOpen] = useState(isOpen);

  useEffect(() => {
    setWrapperOpen(isOpen);
  }, [isOpen]);

  const handleClose = () => {
    setWrapperOpen(false);
    if (onClose) onClose();
  };

  const handleDownloadStart = () => {
    if (onDownloadStart) onDownloadStart();
  };

  if (!wrapperOpen) return null;

  return (
    <DownloadAnimation3D
      isOpen={true}
      onClose={handleClose}
      onDownloadStart={handleDownloadStart}
    />
  );
}