import React from 'react';

interface AdMobInterstitialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Real AdMob Interstitial: Sirf Native Android se aayega.
 * Web me fake / dummy ad nahi dikhayenge.
 */
export const AdMobInterstitialModal: React.FC<AdMobInterstitialModalProps> = () => {
  return null;
};
