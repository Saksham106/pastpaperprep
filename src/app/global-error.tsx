"use client";

import { useEffect } from "react";
import AppError from "./error";
import { captureAppException } from "@/lib/product-analytics";
import "./globals.css";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { captureAppException(error); }, [error]);
  return <html lang="en"><body><main><AppError error={error} /></main></body></html>;
}
