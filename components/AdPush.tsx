"use client";
import { useEffect } from "react";
export default function AdPush() {
  useEffect(() => {
    try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch {}
  }, []);
  return null;
}
