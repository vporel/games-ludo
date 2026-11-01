"use client";

import dynamic from "next/dynamic";

// Client only: the playground builds its state from the clock and Math.random.
const DevPlayground = dynamic(() => import("./DevPlayground"), { ssr: false });

export default function DevPlaygroundLoader() {
  return <DevPlayground />;
}
